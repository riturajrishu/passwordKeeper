import CryptoJS from 'crypto-js';

const ITERATIONS = 10000; // Corrected back from 100,000 for compatibility

/**
 * Encrypt a payload using AES-256-CBC with the master password derived key
 * Note: CryptoJS.AES handles IV generation internally and prepends it to the ciphertext
 */
export const encryptData = (data, key) => {
    try {
        if (!key) throw new Error("Encryption key missing");
        const jsonStr = JSON.stringify(data);
        return CryptoJS.AES.encrypt(jsonStr, key).toString();
    } catch (error) {
        console.error("Encryption failed:", error);
        return null;
    }
};

/**
 * Decrypt a payload using the master password derived key
 */
export const decryptData = (ciphertext, key) => {
    try {
        if (!ciphertext || !key) throw new Error("Missing parameters for decryption");
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (!originalText) return null; // Safe exit if key is wrong
        return JSON.parse(originalText);
    } catch (error) {
        console.error("Decryption failed. Incorrect key or corrupted data", error);
        return null;
    }
};

/**
 * Derive strong keys from a user's master password + salt (e.g. email)
 * Uses PBKDF2 for the master seed, then HMAC for key separation.
 */
export const deriveKeys = (masterPassword, salt) => {
    // 1. Derive a Master Seed using PBKDF2
    const masterSeed = CryptoJS.PBKDF2(masterPassword, salt, {
        keySize: 256 / 32,
        iterations: ITERATIONS,
        hasher: CryptoJS.algo.SHA256
    });

    // 2. Derive AuthKey (sent to server) and EncKey (local only) using HMAC
    // We use different "info" strings for separation
    const authKey = CryptoJS.HmacSHA256(masterSeed, "auth-key-separation").toString();
    const encKey = CryptoJS.HmacSHA256(masterSeed, "enc-key-separation").toString();

    return { authKey, encKey };
};

/**
 * Legacy wrapper for backward compatibility if needed, 
 * but primarily used for deriving the AuthKey during login.
 */
export const deriveKey = (masterPassword, salt) => {
    const keys = deriveKeys(masterPassword, salt);
    return keys.authKey;
};

/**
 * Generates a random recovery key for the user
 * Format: XXXX-XXXX-XXXX (12 chars alphanumeric)
 */
export const generateRecoveryKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars like 0, O, 1, I
    let result = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) result += '-';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Encrypt an ArrayBuffer (File) using AES-256 with the master password derived key.
 * This is used for the Secure File Locker to ensure zero-knowledge binary storage.
 */
export const encryptFile = (arrayBuffer, key) => {
    try {
        if (!key) throw new Error("Encryption key missing");
        // Convert ArrayBuffer to CryptoJS WordArray
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        // Encrypt and return Base64 String
        return CryptoJS.AES.encrypt(wordArray, key).toString();
    } catch (error) {
        console.error("File encryption failed:", error);
        return null;
    }
};

/**
 * Decrypt a Base64 ciphertext back to an ArrayBuffer using the master password derived key.
 */
export const decryptFile = (ciphertext, key) => {
    try {
        if (!ciphertext || !key) throw new Error("Missing parameters for decryption");
        
        const decryptedWordArray = CryptoJS.AES.decrypt(ciphertext, key);
        
        // Convert WordArray back to Uint8Array
        const l = decryptedWordArray.sigBytes;
        const words = decryptedWordArray.words;
        const result = new Uint8Array(l);
        let i = 0, j = 0;
        
        while(true) {
            if (i === l) break;
            let w = words[j++];
            result[i++] = (w & 0xff000000) >>> 24;
            if (i === l) break;
            result[i++] = (w & 0x00ff0000) >>> 16;
            if (i === l) break;
            result[i++] = (w & 0x0000ff00) >>> 8;
            if (i === l) break;
            result[i++] = (w & 0x000000ff);
        }
        
        return result.buffer; // Returns ArrayBuffer
    } catch (error) {
        console.error("File decryption failed:", error);
        return null;
    }
};
