// Password Keeper X - Anti-Phishing & Autofill Content Script

let currentMatches = [];

// Initialize
chrome.runtime.sendMessage({ action: 'getAutofillData', url: window.location.href }, (res) => {
    if(res && res.success && res.matches && res.matches.length > 0) {
        currentMatches = res.matches;
        observeDOM();
        scanInputs();
    }
});

function scanInputs() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(passInput => {
        if(passInput.dataset.keeperInjected) return;
        passInput.dataset.keeperInjected = "true";

        // Find associated username input
        const form = passInput.closest('form');
        let userInput = null;
        if(form) {
            userInput = form.querySelector('input[type="email"], input[type="text"]');
        } else {
            // Heuristic search nearby
            const allInputs = Array.from(document.querySelectorAll('input[type="email"], input[type="text"]'));
            userInput = allInputs.pop(); // typically preceding
        }

        injectOverlay(passInput, userInput);
    });
}

function injectOverlay(passInput, userInput) {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.right = '10px';
    overlay.style.top = '50%';
    overlay.style.transform = 'translateY(-50%)';
    overlay.style.cursor = 'pointer';
    overlay.style.zIndex = '100000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.width = '24px';
    overlay.style.height = '24px';
    overlay.style.background = '#3b82f6';
    overlay.style.borderRadius = '50%';
    overlay.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    overlay.style.fontSize = '12px';
    overlay.innerText = '🛡️';
    overlay.title = `Autofill ${currentMatches.length} matching logins via Keeper X`;

    // Ensure parent is relatively positioned for absolute overlay
    const parent = passInput.parentElement;
    if(window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }

    parent.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showAutofillMenu(overlay, passInput, userInput);
    });
}

function showAutofillMenu(overlay, passInput, userInput) {
    // Remove existing menus
    const existing = document.getElementById('keeper-autofill-menu');
    if(existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'keeper-autofill-menu';
    menu.style.position = 'absolute';
    menu.style.right = '0';
    menu.style.top = '100%';
    menu.style.marginTop = '8px';
    menu.style.background = '#020617';
    menu.style.border = '1px solid #3b82f6';
    menu.style.borderRadius = '8px';
    menu.style.padding = '8px';
    menu.style.width = '200px';
    menu.style.zIndex = '100001';
    menu.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';

    const title = document.createElement('div');
    title.innerText = 'Select Login';
    title.style.color = '#3b82f6';
    title.style.fontSize = '11px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.textTransform = 'uppercase';
    title.style.letterSpacing = '1px';
    menu.appendChild(title);

    currentMatches.forEach(match => {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.background = 'rgba(255,255,255,0.05)';
        item.style.borderRadius = '6px';
        item.style.marginBottom = '4px';
        item.style.cursor = 'pointer';
        item.style.color = '#fff';
        item.style.fontSize = '12px';
        
        item.innerHTML = `<strong style="display:block; margin-bottom:2px;">${match.appName}</strong><span style="color:#94a3b8; font-size:10px;">${match.username || 'No user'}</span>`;
        
        item.addEventListener('hover', () => item.style.background = 'rgba(59,130,246,0.2)');
        item.addEventListener('click', () => {
            if(userInput && match.username) userInput.value = match.username;
            passInput.value = match.password;
            
            // Dispatch events to trigger JS frameworks (React/Angular) state updates
            if(userInput) userInput.dispatchEvent(new Event('input', { bubbles: true }));
            passInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            menu.remove();
        });
        menu.appendChild(item);
    });

    overlay.parentElement.appendChild(menu);

    // Click outside to close
    document.addEventListener('click', function closeMenu(e) {
        if(!menu.contains(e.target) && e.target !== overlay) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });

}

// Observe dynamically added forms (e.g. SPAs)
function observeDOM() {
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for(let mut of mutations) {
            if(mut.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if(shouldScan) scanInputs();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
