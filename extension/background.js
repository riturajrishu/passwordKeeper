const API_URL = "http://localhost:5000/api";
let sessionCookie = ""; // Manifest V3 service workers use Fetch which usually carries cookies automatically if credentials: 'include'. However, for extension to localhost cross-origin, we must ensure it.
// Use chrome.storage.session for decryptedVault to persist across service worker suspensions

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'login') {
        fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: request.email, loginPassword: request.loginPass, authHash: request.authHash })
        })
        .then(res => {
            if(!res.ok) throw new Error("Login failed");
            return res.json();
        })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        return true; 
    }
    
    if (request.action === 'verifyMaster') {
        fetch(`${API_URL}/auth/verify-master`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ masterAuthHash: request.masterAuthHash })
        })
        .then(res => {
            if(!res.ok) throw new Error("Master verification failed");
            return res.json();
        })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === 'fetchVault') {
        fetch(`${API_URL}/vault`, { method: 'GET' })
        .then(res => {
            if(!res.ok) throw new Error("Failed to fetch vault");
            return res.json();
        })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
    
    if (request.action === 'cacheDecryptedVault') {
        const vault = request.vault || [];
        chrome.storage.session.set({ decryptedVault: vault }, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'getAutofillData') {
        const url = request.url;
        // Anti-phishing algorithm: extract domain and match loosely
        try {
            const domainUrl = new URL(url).hostname.replace('www.', '');
            chrome.storage.session.get(['decryptedVault'], (result) => {
                const vault = result.decryptedVault || [];
                const matches = vault.filter(item => {
                    if(!item.url) return false;
                    try {
                        const itemDomain = new URL(item.url).hostname.replace('www.', '');
                        if (domainUrl === itemDomain || domainUrl.endsWith(itemDomain)) {
                            return true;
                        }
                        return false;
                    } catch(e) { return false; }
                });
                sendResponse({ success: true, matches });
            });
        } catch(e) {
            sendResponse({ success: false, error: "Invalid URL" });
        }
        return true; // Keep message port open for async response
    }

    if (request.action === 'logout') {
        fetch(`${API_URL}/auth/logout`, { method: 'POST' })
        .then(() => {
            chrome.storage.session.remove('decryptedVault');
            sendResponse({ success: true });
        }).catch(() => sendResponse({ success: true }));
        return true;
    }
});
