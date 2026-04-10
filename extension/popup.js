const API_URL = "http://localhost:5000/api";

const emailInput = document.getElementById('email');
const loginPassInput = document.getElementById('loginPass');
const masterPassInput = document.getElementById('masterPass');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');
const loginView = document.getElementById('loginView');
const loggedInView = document.getElementById('loggedInView');
const logoutBtn = document.getElementById('logoutBtn');
const vaultList = document.getElementById('vaultList');
const searchBox = document.getElementById('searchBox');
const userEmailDisplay = document.getElementById('userEmailDisplay');

let cachedVault = [];
let localEncKey = null;

// Crypto Utils
const ITERATIONS = 10000;
function deriveKeys(masterPassword, salt) {
    const masterSeed = CryptoJS.PBKDF2(masterPassword, salt, { keySize: 256 / 32, iterations: ITERATIONS, hasher: CryptoJS.algo.SHA256 });
    return {
        authKey: CryptoJS.HmacSHA256(masterSeed, "auth-key-separation").toString(),
        encKey: CryptoJS.HmacSHA256(masterSeed, "enc-key-separation").toString()
    };
}

function decryptData(ciphertext, key) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(originalText);
    } catch (e) { return null; }
}

function showError(msg) {
    errorMsg.style.display = 'block';
    errorMsg.innerText = msg;
}

// Logic
async function handleLogin() {
    errorMsg.style.display = 'none';
    const email = emailInput.value.trim();
    const loginPass = loginPassInput.value;
    const masterPass = masterPassInput.value;

    if(!email || !loginPass || !masterPass) return showError("All fields are required");

    loginBtn.innerText = "Authenticating...";
    loginBtn.disabled = true;

    try {
        // Derive Master hash to act as backward compatibility fallback
        const { authKey: loginAuthHash } = deriveKeys(loginPass, email);
        
        // Use background script to call API and get cookie session mapped transparently
        const res = await chrome.runtime.sendMessage({
            action: 'login', email, loginPass, authHash: loginAuthHash
        });

        if(!res.success) throw new Error(res.error || "Login Failed");

        // Verify Vault
        const { encKey, authKey: masterAuthHash } = deriveKeys(masterPass, email);
        const verifyRes = await chrome.runtime.sendMessage({
            action: 'verifyMaster', masterAuthHash
        });

        if(!verifyRes.success) throw new Error(verifyRes.error || "Invalid Master Password");

        // Success! Save session state in local storage
        localEncKey = encKey;
        await chrome.storage.local.set({ extensionUnlocked: true, email: email, masterEncKey: encKey });
        
        showVaultView(email);
        loadVault();
    } catch (e) {
        showError(e.message);
    } finally {
        loginBtn.innerText = "Unlock Vault";
        loginBtn.disabled = false;
    }
}

async function loadVault() {
    vaultList.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size: 12px;">Desyncing encrypted vault...</p>';
    const res = await chrome.runtime.sendMessage({ action: 'fetchVault' });
    if(!res.success) {
        vaultList.innerHTML = '<p style="color:red; font-size:12px;">Failed to fetch vault</p>';
        return;
    }

    cachedVault = res.data.filter(i => !i.isDeleted).map(item => {
        const payload = decryptData(item.encryptedBlob, localEncKey);
        if(!payload || !payload.password) return null;
        return { _id: item._id, ...payload };
    }).filter(Boolean);

    renderVault(cachedVault);
    
    // Store decrypted passwords briefly in memory for auto-fill content script to fetch
    await chrome.runtime.sendMessage({ action: 'cacheDecryptedVault', vault: cachedVault });
}

function renderVault(items) {
    vaultList.innerHTML = '';
    if(items.length === 0) {
        vaultList.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size: 12px;">No items in vault</p>';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-title">${item.appName || 'Unknown'}</div>
            <div class="item-sub">${item.username || item.url || 'No email/username'}</div>
        `;
        div.onclick = () => {
             navigator.clipboard.writeText(item.password);
             div.innerHTML = `<div class="item-title" style="color: #4ade80;">Password Copied!</div>`;
             setTimeout(() => renderVault(items), 1500);
        };
        vaultList.appendChild(div);
    });
}

function showVaultView(email) {
    loginView.style.display = 'none';
    loggedInView.style.display = 'block';
    userEmailDisplay.innerText = email;
}

function showLoginView() {
    loginView.style.display = 'block';
    loggedInView.style.display = 'none';
    emailInput.value = '';
    loginPassInput.value = '';
    masterPassInput.value = '';
    localEncKey = null;
}

// Events
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'logout' });
    await chrome.storage.local.clear();
    showLoginView();
});

searchBox.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = cachedVault.filter(i => 
        (i.appName && i.appName.toLowerCase().includes(q)) || 
        (i.url && i.url.toLowerCase().includes(q)) || 
        (i.username && i.username.toLowerCase().includes(q))
    );
    renderVault(filtered);
});

// Initialization
chrome.storage.local.get(['extensionUnlocked', 'email', 'masterEncKey'], (res) => {
    if(res.extensionUnlocked && res.masterEncKey) {
        localEncKey = res.masterEncKey;
        showVaultView(res.email);
        loadVault();
    }
});
