export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const defaultOptions = {
    credentials: 'include', // Ensures cookies are always sent
    headers: {
        'Content-Type': 'application/json'
    }
};

// --- AUTH ROUTES ---
export const registerUser = async (name, email, phoneNumber, loginPassword, masterAuthHash, passwordHint, recoveryHash) => {
    const res = await fetch(`${API_URL}/auth/register`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ name, email, phoneNumber, loginPassword, masterAuthHash, passwordHint, recoveryHash })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to register');
    return data;
};

export const loginUser = async (email, loginPassword, authHash) => {
    const res = await fetch(`${API_URL}/auth/login`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ email, loginPassword, authHash })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to login');
    return data;
};

export const logoutUser = async () => {
    const res = await fetch(`${API_URL}/auth/logout`, {
        ...defaultOptions,
        method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to logout');
    return res.json();
};

export const verifySession = async () => {
    const res = await fetch(`${API_URL}/auth/verify`, {
        ...defaultOptions,
        method: 'GET'
    });
    if (!res.ok) throw new Error('Session invalid');
    return res.json();
};

export const syncSecurityStats = async (stats) => {
    const res = await fetch(`${API_URL}/auth/stats`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify(stats)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to sync stats');
    return data;
};

export const verifyMasterPassword = async (authHash) => {
    const res = await fetch(`${API_URL}/auth/verify-master`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ authHash })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Incorrect master password');
    return data;
};

export const updateProfile = async (name, phoneNumber) => {
    const res = await fetch(`${API_URL}/auth/profile`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify({ name, phoneNumber })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update profile');
    return data;
};

export const getHint = async (email) => {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Account not found');
    return data;
};

export const resetPassword = async (email, recoveryKey, newLoginPassword) => {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ email, recoveryKey, newLoginPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset password');
    return data;
};

export const regenerateRecoveryHash = async (loginPassword, newRecoveryHash) => {
    const res = await fetch(`${API_URL}/auth/regenerate-recovery-hash`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify({ loginPassword, newRecoveryHash })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to regenerate recovery key');
    return data;
};

export const updateSecurity = async (currentLoginPassword, currentAuthHash, newEmail, newLoginPassword, newMasterAuthHash) => {
    const res = await fetch(`${API_URL}/auth/update-security`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify({ currentLoginPassword, currentAuthHash, newEmail, newLoginPassword, newMasterAuthHash })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Security update failed');
    return data;
};

// --- VAULT ROUTES ---
export const fetchVaultItems = async () => {
    const res = await fetch(`${API_URL}/vault`, {
        ...defaultOptions,
        method: 'GET'
    });
    if (!res.ok) throw new Error('Failed to fetch items');
    return res.json();
};

export const reEncryptVault = async (items) => {
    const res = await fetch(`${API_URL}/vault/re-encrypt-all`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bulk update failed');
    return data;
};

export const createVaultItem = async (encryptedBlob, category, isFavorite, itemType, tags) => {
    const res = await fetch(`${API_URL}/vault`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ encryptedBlob, category, isFavorite, itemType, tags })
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.message || 'Failed to create item');
    }
    return res.json();
};

export const updateVaultItem = async (id, ObjectUpdates) => {
    // Expected ObjectUpdates: { encryptedBlob, category, isFavorite, itemType, tags, isDeleted }
    const res = await fetch(`${API_URL}/vault/${id}`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify(ObjectUpdates)
    });
    if (!res.ok) throw new Error('Failed to update item');
    return res.json();
};

export const deleteVaultItem = async (id) => {
    const res = await fetch(`${API_URL}/vault/${id}`, {
        ...defaultOptions,
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
};

export const revokeAllOtherSessions = async () => {
    const res = await fetch(`${API_URL}/sessions/revoke-others`, {
        ...defaultOptions,
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to revoke sessions');
    return res.json();
};

export const adminResetUserPassword = async (userId, newLoginPassword) => {
    const res = await fetch(`${API_URL}/admin/users/${userId}/reset-login-password`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify({ newLoginPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset user password');
    return data;
};

export const permanentDeleteVaultItem = async (id) => {
    const res = await fetch(`${API_URL}/vault/${id}/permanent`, {
        ...defaultOptions,
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to permanently delete item');
    return res.json();
};

export const restoreVaultItem = async (id) => {
    const res = await fetch(`${API_URL}/vault/${id}/restore`, {
        ...defaultOptions,
        method: 'PUT'
    });
    if (!res.ok) throw new Error('Failed to restore item');
    return res.json();
};

// --- SHARE ROUTES ---

/**
 * Create a new one-time share link
 * @param {string} encryptedShareBlob - Item re-encrypted with shareKey
 * @param {string|null} pin - Optional 4-8 digit PIN
 * @param {number} expiresInHours - Must be one of: 1, 6, 24, 168
 * @param {string} itemLabel - Human-readable name for the item (e.g. "GitHub")
 */
export const createShareLink = async (encryptedShareBlob, pin, expiresInHours, itemLabel) => {
    const res = await fetch(`${API_URL}/share`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ encryptedShareBlob, pin: pin || null, expiresInHours, itemLabel })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create share link');
    return data;
};

/**
 * Fetch a shared item by token (public, no auth required)
 * @param {string} token - The 64-char hex token from the URL
 * @param {string|null} pin - Optional PIN if the link is PIN-protected
 */
export const fetchSharedItem = async (token, pin) => {
    const url = pin
        ? `${API_URL}/share/${token}?pin=${encodeURIComponent(pin)}`
        : `${API_URL}/share/${token}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
        // No credentials — this is a public endpoint
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch shared item');
    return data;
};

/**
 * Get all active share links created by the authenticated user
 */
export const getMyShareLinks = async () => {
    const res = await fetch(`${API_URL}/share/my-links`, {
        ...defaultOptions,
        method: 'GET'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch share links');
    return data;
};

/**
 * Revoke (delete) a share link by its token
 * @param {string} token - The token of the link to revoke
 */
export const revokeShareLink = async (token) => {
    const res = await fetch(`${API_URL}/share/${token}`, {
        ...defaultOptions,
        method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to revoke share link');
    return data;
};

// --- EMERGENCY ACCESS ROUTES ---

/** Add a new emergency contact */
export const addEmergencyContact = async (contactEmail, contactName, delayDays) => {
    const res = await fetch(`${API_URL}/emergency/contacts`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ contactEmail, contactName, delayDays })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add emergency contact');
    return data;
};

/** Get all emergency contacts for the logged-in owner */
export const getEmergencyContacts = async () => {
    const res = await fetch(`${API_URL}/emergency/contacts`, { ...defaultOptions, method: 'GET' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch emergency contacts');
    return data;
};

/** Remove an emergency contact by ID */
export const removeEmergencyContact = async (id) => {
    const res = await fetch(`${API_URL}/emergency/contacts/${id}`, { ...defaultOptions, method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to remove emergency contact');
    return data;
};

/** Fetch invite details (PUBLIC — no auth) */
export const getInviteDetails = async (token) => {
    const res = await fetch(`${API_URL}/emergency/invite/${token}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invalid or expired invite');
    return data;
};

/** Accept invite — contact submits their RSA public key (PUBLIC — no auth) */
export const acceptEmergencyInvite = async (token, contactPublicKey) => {
    const res = await fetch(`${API_URL}/emergency/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactPublicKey })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to accept invite');
    return data;
};

/** Contact requests emergency vault access (PUBLIC) */
export const requestEmergencyAccess = async (contactId) => {
    const res = await fetch(`${API_URL}/emergency/request/${contactId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    // 202 = waiting (approval window not passed) — not an error
    if (!res.ok && res.status !== 202 && res.status !== 409) {
        throw new Error(data.message || 'Failed to request emergency access');
    }
    return { ...data, status: res.status };
};

/** Owner denies an access request within the 24h window */
export const denyEmergencyAccess = async (contactId) => {
    const res = await fetch(`${API_URL}/emergency/deny/${contactId}`, {
        ...defaultOptions,
        method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to deny access');
    return data;
};

/** Contact polls/gets vault access after approval window (PUBLIC) */
export const getEmergencyVaultAccess = async (contactId) => {
    const res = await fetch(`${API_URL}/emergency/access/${contactId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    // 202 = still in approval window — not a hard error
    if (!res.ok && res.status !== 202) {
        throw new Error(data.message || 'Failed to get emergency vault access');
    }
    return { ...data, httpStatus: res.status };
};

/** Owner uploads RSA-encrypted master key bundle for a contact */
export const uploadEncryptedMasterKey = async (contactId, encryptedMasterKeyBundle) => {
    const res = await fetch(`${API_URL}/emergency/contacts/${contactId}/key`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify({ encryptedMasterKeyBundle })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to share emergency key');
    return data;
};

// --- SECURE FILE LOCKER ROUTES ---

/** Upload a securely encrypted file to the backend */
export const uploadSecureFile = async (fileBlob) => {
    // We cannot use JSON headers for FormData
    const formData = new FormData();
    formData.append('file', fileBlob);
    
    // Copy options and headers deeply to avoid mutating the original
    const options = { 
        ...defaultOptions, 
        headers: { ...defaultOptions.headers } 
    };
    delete options.headers['Content-Type']; // Let the browser set Content-Type to multipart/form-data with boundary

    const res = await fetch(`${API_URL}/files/upload`, {
        ...options,
        method: 'POST',
        body: formData
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload secure file');
    return data;
};

/** Download an encrypted file from the backend as Blob */
export const downloadSecureFile = async (fileId) => {
    const res = await fetch(`${API_URL}/files/download/${fileId}`, {
        method: 'GET',
        credentials: 'include' // Need session cookie
    });
    
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to download secure file');
    }
    
    // Return the response as text (Base64 encrypted string)
    return await res.text();
};

/** Delete a secure file from the server */
export const deleteSecureFile = async (fileId) => {
    const res = await fetch(`${API_URL}/files/${fileId}`, {
        ...defaultOptions,
        method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete secure file');
    return data;
};

// --- AI INTELLIGENCE ROUTES ---

export const analyzePhishingData = async (text) => {
    const res = await fetch(`${API_URL}/ai/analyze-phishing`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to analyze data via AI');
    return data;
};

