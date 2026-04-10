/**
 * cryptoUtils.js — Browser-native WebCrypto RSA-OAEP utilities
 * 
 * Used for Emergency Vault Access (Dead Man's Switch) feature.
 * Private keys NEVER leave the browser — only public keys are sent to server.
 * 
 * Uses Web Crypto API (window.crypto.subtle) — no external dependencies needed.
 */

// ── Key Generation ────────────────────────────────────────────────────────

/**
 * Generates an RSA-OAEP key pair (2048-bit).
 * Public key is exported to Base64 (sent to server).
 * Private key is exported to Base64 (saved only in browser/localStorage).
 * 
 * @returns {{ publicKeyB64: string, privateKeyB64: string }}
 */
export const generateRSAKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]), // 65537
            hash: 'SHA-256'
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );

    // Export public key as Base64-encoded SPKI
    const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

    // Export private key as Base64-encoded PKCS8
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyB64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));

    return { publicKeyB64, privateKeyB64 };
};

// ── Key Import ────────────────────────────────────────────────────────────

/**
 * Import a Base64 public key for RSA-OAEP encryption
 * @param {string} publicKeyB64 - Base64-encoded SPKI public key
 * @returns {CryptoKey}
 */
export const importPublicKey = async (publicKeyB64) => {
    const binaryStr = atob(publicKeyB64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return window.crypto.subtle.importKey(
        'spki',
        bytes.buffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false, // not extractable once imported
        ['encrypt']
    );
};

/**
 * Import a Base64 private key for RSA-OAEP decryption
 * @param {string} privateKeyB64 - Base64-encoded PKCS8 private key
 * @returns {CryptoKey}
 */
export const importPrivateKey = async (privateKeyB64) => {
    const binaryStr = atob(privateKeyB64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return window.crypto.subtle.importKey(
        'pkcs8',
        bytes.buffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['decrypt']
    );
};

// ── Encryption / Decryption ───────────────────────────────────────────────

/**
 * Encrypt a string with an RSA public key
 * @param {string} plaintext - Data to encrypt
 * @param {string} publicKeyB64 - Base64 public key
 * @returns {string} Base64-encoded ciphertext
 */
export const encryptWithPublicKey = async (plaintext, publicKeyB64) => {
    const publicKey = await importPublicKey(publicKeyB64);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // RSA-OAEP can only encrypt small payloads (~190 bytes for 2048-bit)
    // For large payloads we use hybrid encryption:
    // 1. Generate a random AES-256 key
    // 2. Encrypt data with AES-GCM
    // 3. Encrypt the AES key with RSA public key
    // Bundle both together

    // Generate ephemeral AES-GCM key
    const aesKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    // Encrypt data with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        data
    );

    // Export AES key as raw bytes
    const aesKeyRaw = await window.crypto.subtle.exportKey('raw', aesKey);

    // Encrypt the AES key with RSA public key
    const encryptedAesKey = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        aesKeyRaw
    );

    // Bundle: { iv, encryptedKey, encryptedData } — all Base64
    const bundle = {
        iv: btoa(String.fromCharCode(...iv)),
        encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedAesKey))),
        encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedData)))
    };

    return btoa(JSON.stringify(bundle));
};

/**
 * Decrypt a payload encrypted with encryptWithPublicKey()
 * @param {string} ciphertextB64 - Base64 bundle from encryptWithPublicKey
 * @param {string} privateKeyB64 - Base64 private key
 * @returns {string} Decrypted plaintext
 */
export const decryptWithPrivateKey = async (ciphertextB64, privateKeyB64) => {
    try {
        const bundle = JSON.parse(atob(ciphertextB64));
        const { iv: ivB64, encryptedKey: encKeyB64, encryptedData: encDataB64 } = bundle;

        // Decode all Base64 fields
        const ivStr = atob(ivB64);
        const iv = new Uint8Array(ivStr.length);
        for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);

        const encKeyStr = atob(encKeyB64);
        const encryptedAesKey = new Uint8Array(encKeyStr.length);
        for (let i = 0; i < encKeyStr.length; i++) encryptedAesKey[i] = encKeyStr.charCodeAt(i);

        const encDataStr = atob(encDataB64);
        const encryptedData = new Uint8Array(encDataStr.length);
        for (let i = 0; i < encDataStr.length; i++) encryptedData[i] = encDataStr.charCodeAt(i);

        // Import private key and decrypt AES key
        const privateKey = await importPrivateKey(privateKeyB64);
        const aesKeyRaw = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            privateKey,
            encryptedAesKey.buffer
        );

        // Import decrypted AES key
        const aesKey = await window.crypto.subtle.importKey(
            'raw',
            aesKeyRaw,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        // Decrypt data with AES-GCM
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            encryptedData.buffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch {
        return null; // Decryption failed — wrong key or corrupted data
    }
};

/**
 * Verify if a private key matches a given public key by performing a test encryption/decryption.
 * @param {string} privateKeyB64 
 * @param {string} publicKeyB64 
 * @returns {Promise<boolean>}
 */
export const verifyKeyPair = async (privateKeyB64, publicKeyB64) => {
    try {
        const testPayload = `KEEPERX_VERIFY_${Date.now()}`;
        const encrypted = await encryptWithPublicKey(testPayload, publicKeyB64);
        const decrypted = await decryptWithPrivateKey(encrypted, privateKeyB64);
        return decrypted === testPayload;
    } catch (err) {
        console.error('Key verification error:', err);
        return false;
    }
};

// ── LocalStorage Key Management ───────────────────────────────────────────

const PRIVATE_KEY_STORAGE_PREFIX = 'keeperx_emergency_pk_';

/**
 * Save contact's private key to localStorage (scoped by contactId)
 * @param {string} contactId
 * @param {string} privateKeyB64
 */
export const savePrivateKey = (contactId, privateKeyB64) => {
    try {
        localStorage.setItem(`${PRIVATE_KEY_STORAGE_PREFIX}${contactId}`, privateKeyB64);
        return true;
    } catch {
        return false;
    }
};

/**
 * Load contact's private key from localStorage
 * @param {string} contactId
 * @returns {string|null}
 */
export const loadPrivateKey = (contactId) => {
    return localStorage.getItem(`${PRIVATE_KEY_STORAGE_PREFIX}${contactId}`);
};

/**
 * Remove a private key from localStorage
 * @param {string} contactId
 */
export const removePrivateKey = (contactId) => {
    localStorage.removeItem(`${PRIVATE_KEY_STORAGE_PREFIX}${contactId}`);
};

/**
 * Check if this browser has a private key for a given contactId
 * @param {string} contactId
 * @returns {boolean}
 */
export const hasPrivateKey = (contactId) => {
    return !!localStorage.getItem(`${PRIVATE_KEY_STORAGE_PREFIX}${contactId}`);
};
