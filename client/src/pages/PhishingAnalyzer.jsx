import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ShieldAlert, ShieldCheck, Search, Loader2, AlertTriangle, Sparkles, FileWarning, RotateCcw, Clipboard, Info } from 'lucide-react';
import useToastStore from '../store/useToastStore';
import { analyzePhishingData } from '../lib/api';
import clsx from 'clsx';

const RISK_CONFIG = {
    'CRITICAL RISK': { color: 'red', gradient: 'from-red-500/20 to-red-900/10', border: 'border-red-500/40', text: 'text-red-500', bg: 'bg-red-500' },
    'HIGH RISK':     { color: 'orange', gradient: 'from-orange-500/20 to-orange-900/10', border: 'border-orange-500/40', text: 'text-orange-500', bg: 'bg-orange-500' },
    'SUSPICIOUS':    { color: 'yellow', gradient: 'from-yellow-500/20 to-yellow-900/10', border: 'border-yellow-500/40', text: 'text-yellow-500', bg: 'bg-yellow-500' },
    'LOW RISK':      { color: 'blue', gradient: 'from-blue-500/20 to-blue-900/10', border: 'border-blue-500/40', text: 'text-blue-500', bg: 'bg-blue-500' },
    'SAFE':          { color: 'green', gradient: 'from-green-500/20 to-green-900/10', border: 'border-green-500/40', text: 'text-green-500', bg: 'bg-green-500' },
};

const FLAG_STYLES = {
    critical: 'bg-red-500/5 border-red-500/20 text-red-500',
    high:     'bg-orange-500/5 border-orange-500/20 text-orange-500',
    medium:   'bg-yellow-500/5 border-yellow-500/20 text-yellow-500',
    low:      'bg-blue-500/5 border-blue-500/20 text-blue-400',
    safe:     'bg-green-500/5 border-green-500/20 text-green-500',
};

const FLAG_ICON = {
    critical: ShieldAlert,
    high: FileWarning,
    medium: AlertTriangle,
    low: Info,
    safe: ShieldCheck,
};

// ══════════════════════════════════════════════════════════════════════
// ADVANCED LOCAL HEURISTIC PHISHING ENGINE v3 — 40 Detection Categories
// ══════════════════════════════════════════════════════════════════════
const analyzeLocally = (text) => {
    const lower = text.toLowerCase();
    const original = text;
    const flags = [];
    let threatScore = 0;

    const addFlag = (type, category, msg, score) => {
        threatScore += score;
        flags.push({ type, category, text: msg });
    };

    // Helper: count pattern hits
    const matchPatterns = (patterns) => patterns.filter(w => lower.includes(w));

    // ── 1. URGENCY & PRESSURE ────────────────────────────────────────
    const urgencyHits = matchPatterns([
        'urgent', 'immediately', 'act now', 'expire', 'suspended', 'locked',
        'verify your', 'confirm your', 'within 24 hours', 'within 48 hours',
        'limited time', 'action required', 'account will be', 'final warning',
        'last chance', 'respond immediately', 'failure to', 'your account has been',
        'time sensitive', 'don\'t ignore', 'do not ignore', 'must be completed',
        'deadline', 'will be permanently', 'hours remaining', 'minutes left'
    ]);
    if (urgencyHits.length > 0) {
        addFlag(urgencyHits.length >= 3 ? 'critical' : urgencyHits.length >= 2 ? 'high' : 'medium', 'Urgency / Pressure', `Detected ${urgencyHits.length} pressure keyword(s) designed to rush you: "${urgencyHits.slice(0, 3).join('", "')}"${urgencyHits.length > 3 ? ` +${urgencyHits.length - 3} more` : ''}.`, Math.min(urgencyHits.length * 10, 30));
    }

    // ── 2. FEAR & THREAT LANGUAGE ────────────────────────────────────
    const fearHits = matchPatterns([
        'unauthorized activity', 'unusual activity', 'security alert', 'security breach',
        'compromised', 'hacked', 'stolen', 'data breach', 'identity theft',
        'fraud detected', 'suspicious login', 'unrecognized device', 'unusual sign-in',
        'we noticed', 'we detected', 'your account is at risk', 'closure notice',
        'termination', 'deactivation', 'permanently disabled', 'access revoked'
    ]);
    if (fearHits.length > 0) {
        addFlag(fearHits.length >= 3 ? 'high' : 'medium', 'Fear Inducement', `Contains ${fearHits.length} threat-based keyword(s): "${fearHits.slice(0, 3).join('", "')}"${fearHits.length > 3 ? ` +${fearHits.length - 3} more` : ''}.`, Math.min(fearHits.length * 8, 25));
    }

    // ── 3. URL SHORTENERS ────────────────────────────────────────────
    const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
    const urls = original.match(urlPattern) || [];
    const shorteners = [/bit\.ly/i, /tinyurl/i, /goo\.gl/i, /t\.co/i, /is\.gd/i, /ow\.ly/i, /buff\.ly/i, /adf\.ly/i, /shorte\.st/i, /v\.gd/i, /tiny\.cc/i, /bl\.ink/i, /rb\.gy/i, /cutt\.ly/i, /shorturl\.at/i];
    const shortenedUrls = urls.filter(u => shorteners.some(p => p.test(u)));
    if (shortenedUrls.length > 0) {
        addFlag('high', 'URL Shortener', `${shortenedUrls.length} shortened URL(s) detected — hides the true destination from the user.`, 15);
    }

    // ── 4. SUSPICIOUS TLDs ───────────────────────────────────────────
    const suspiciousTLDs = [/\.xyz/i, /\.tk/i, /\.ml/i, /\.ga/i, /\.cf/i, /\.top/i, /\.buzz/i, /\.click/i, /\.link/i, /\.club/i, /\.work/i, /\.icu/i, /\.cam/i, /\.rest/i, /\.surf/i, /\.monster/i, /\.space/i, /\.site/i, /\.online/i, /\.fun/i, /\.loan/i, /\.racing/i, /\.win/i, /\.bid/i, /\.stream/i, /\.gdn/i, /\.accountant/i, /\.date/i, /\.review/i, /\.science/i];
    const suspTldUrls = urls.filter(u => suspiciousTLDs.some(p => p.test(u)) && !shorteners.some(p => p.test(u)));
    if (suspTldUrls.length > 0) {
        addFlag('medium', 'Risky Domain TLD', `URL uses a high-risk top-level domain commonly exploited in phishing campaigns.`, 12);
    }

    // ── 5. IP-BASED URLs ─────────────────────────────────────────────
    const ipUrls = urls.filter(u => /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(u));
    if (ipUrls.length > 0) {
        addFlag('critical', 'IP-Based URL', `URL points to a raw IP address instead of a domain — strong phishing indicator.`, 25);
    }

    // ── 6. URL OBFUSCATION (@ sign) ──────────────────────────────────
    const atUrls = urls.filter(u => /https?:\/\/[^/]*@/.test(u));
    if (atUrls.length > 0) {
        addFlag('critical', 'URL @ Obfuscation', `URL contains an @ symbol which can silently redirect to a malicious server.`, 20);
    }

    // ── 7. HOMOGLYPH / IDN ATTACK ────────────────────────────────────
    const homoglyphUrls = urls.filter(u => /https?:\/\/[^/]*[а-яёÀ-ÿ]/.test(u));
    if (homoglyphUrls.length > 0) {
        addFlag('critical', 'Homoglyph / IDN Attack', `URL contains non-ASCII characters (Cyrillic/accented) impersonating a legitimate domain.`, 25);
    }

    // ── 8. EXCESSIVE SUBDOMAINS ──────────────────────────────────────
    const subdomainAbuse = urls.filter(u => (u.match(/\./g) || []).length > 4);
    if (subdomainAbuse.length > 0) {
        addFlag('medium', 'Subdomain Abuse', `URL has excessive subdomains — a tactic to disguise the real domain.`, 10);
    }

    // ── 9. HEX/ENCODED URLs ─────────────────────────────────────────
    const hexUrls = urls.filter(u => /%[0-9a-f]{2}/i.test(u));
    if (hexUrls.length > 0) {
        addFlag('medium', 'URL Encoding', `URL contains hex-encoded characters often used to bypass security filters.`, 10);
    }

    // ── 10. TYPOSQUATTING ────────────────────────────────────────────
    const typosquats = [
        { real: 'google', fakes: ['gooogle', 'googel', 'gogle', 'g00gle', 'googIe'] },
        { real: 'paypal', fakes: ['paypa1', 'paypai', 'paypall', 'paypaI', 'peypal'] },
        { real: 'amazon', fakes: ['arnaz0n', 'amaz0n', 'amazon', 'arnazon', 'amazoni'] },
        { real: 'microsoft', fakes: ['micros0ft', 'mircosoft', 'microsft', 'rnicrosoft'] },
        { real: 'facebook', fakes: ['faceb00k', 'facebok', 'faceboook', 'faceboak'] },
        { real: 'apple', fakes: ['app1e', 'appIe', 'aple', 'applle'] },
        { real: 'netflix', fakes: ['netfIix', 'netf1ix', 'nettflix', 'netfilx'] },
        { real: 'instagram', fakes: ['instagam', 'lnstagram', 'instagran', 'inst4gram'] },
    ];
    const typoHits = [];
    typosquats.forEach(({ real, fakes }) => {
        fakes.forEach(f => { if (lower.includes(f)) typoHits.push(`${f} (→ ${real})`); });
    });
    if (typoHits.length > 0) {
        addFlag('critical', 'Typosquatting', `Misspelled brand domain(s) detected: ${typoHits.slice(0, 2).join(', ')} — designed to trick users visually.`, 25);
    }

    // ── 11. CREDENTIAL HARVESTING ────────────────────────────────────
    const credHits = matchPatterns([
        'password', 'credit card', 'social security', 'ssn', 'bank account',
        'login credentials', 'pin number', 'cvv', 'routing number', 'enter your',
        'update your payment', 'billing information', 'card number', 'expiry date',
        'security code', 'account number', 'sort code', 'iban', 'swift code',
        'mother\'s maiden name', 'date of birth', 'verify your identity',
        'confirm your details', 'update your information', 're-enter your',
        'provide your', 'submit your', 'fill out', 'complete the form',
        'log in to confirm', 'sign in to verify', 'click to verify'
    ]);
    if (credHits.length > 0) {
        addFlag(credHits.length >= 3 ? 'critical' : 'high', 'Credential Harvesting', `Requests ${credHits.length} type(s) of sensitive data: "${credHits.slice(0, 4).join('", "')}"${credHits.length > 4 ? ` +${credHits.length - 4} more` : ''}.`, Math.min(credHits.length * 12, 40));
    }

    // ── 12. OTP / MFA INTERCEPTION ───────────────────────────────────
    const otpHits = matchPatterns([
        'otp', 'one-time password', 'verification code', 'authentication code',
        'two-factor', '2fa', 'mfa code', 'security token', 'sms code',
        'enter the code', 'code sent to', 'approve the login', 'verify sign-in'
    ]);
    if (otpHits.length > 0) {
        addFlag('critical', 'OTP / MFA Interception', `Attempts to capture ${otpHits.length} authentication token(s): "${otpHits.slice(0, 3).join('", "')}" — likely a real-time relay attack.`, Math.min(otpHits.length * 12, 30));
    }

    // ── 13. BRAND IMPERSONATION ──────────────────────────────────────
    const brands = [
        'paypal', 'amazon', 'microsoft', 'google', 'apple', 'netflix', 'facebook',
        'instagram', 'whatsapp', 'bank of america', 'wells fargo', 'chase', 'dhl',
        'fedex', 'irs', 'walmart', 'ebay', 'linkedin', 'twitter', 'dropbox',
        'spotify', 'uber', 'airbnb', 'coinbase', 'binance', 'stripe', 'venmo',
        'zelle', 'cash app', 'usps', 'ups', 'royal mail', 'hmrc', 'citibank',
        'barclays', 'hsbc', 'santander', 'hdfc', 'sbi', 'icici', 'steam',
        'discord', 'telegram', 'zoom', 'slack'
    ];
    const brandHits = brands.filter(b => lower.includes(b));
    if (brandHits.length > 0) {
        const hasContext = urgencyHits.length + fearHits.length + credHits.length + urls.length > 0;
        if (hasContext) {
            addFlag('high', 'Brand Impersonation', `References ${brandHits.length} known brand(s) (${brandHits.slice(0, 3).join(', ')}) alongside deceptive elements — likely spoofing.`, Math.min(brandHits.length * 10, 20));
        } else {
            flags.push({ type: 'low', category: 'Brand Mention', text: `Mentions brand(s): ${brandHits.slice(0, 4).join(', ')}. No deceptive context detected.` });
        }
    }

    // ── 14. FINANCIAL FRAUD ──────────────────────────────────────────
    const finHits = matchPatterns([
        'wire transfer', 'bitcoin', 'cryptocurrency', 'gift card', 'western union',
        'moneygram', 'payment required', 'invoice attached', 'overdue payment',
        'send money', 'transfer funds', 'processing fee', 'advance fee',
        'outstanding balance', 'reimbursement pending', 'compensation'
    ]);
    if (finHits.length > 0) {
        addFlag(finHits.length >= 3 ? 'critical' : 'high', 'Financial Fraud', `Contains ${finHits.length} financial scam indicator(s): "${finHits.slice(0, 3).join('", "')}"${finHits.length > 3 ? ` +${finHits.length - 3} more` : ''}.`, Math.min(finHits.length * 10, 30));
    }

    // ── 15. LOTTERY / PRIZE SCAM ─────────────────────────────────────
    const lotteryHits = matchPatterns([
        'lottery winner', 'prize winner', 'you have won', 'claim your prize',
        'congratulations you won', 'selected as winner', 'lucky draw',
        'free iphone', 'free gift', 'won a giveaway', 'sweepstake'
    ]);
    if (lotteryHits.length > 0) {
        addFlag('high', 'Lottery / Prize Scam', `Classic advance-fee fraud pattern: "${lotteryHits.slice(0, 2).join('", "')}" — no legitimate org contacts winners this way.`, Math.min(lotteryHits.length * 12, 25));
    }

    // ── 16. INHERITANCE / 419 SCAM ───────────────────────────────────
    const inheritHits = matchPatterns([
        'inheritance', 'beneficiary', 'unclaimed funds', 'nigerian prince',
        'offshore account', 'million dollars', 'million usd', 'next of kin',
        'deceased client', 'dormant account', 'unclaimed estate'
    ]);
    if (inheritHits.length > 0) {
        addFlag('critical', 'Advance-Fee / 419 Scam', `Contains classic Nigerian-type scam language: "${inheritHits.slice(0, 2).join('", "')}" — a well-known fraud scheme.`, Math.min(inheritHits.length * 12, 30));
    }

    // ── 17. GRAMMAR & PHRASING ANOMALIES ─────────────────────────────
    const grammarHits = matchPatterns([
        'dear customer', 'dear user', 'dear sir/madam', 'dear valued',
        'dear account holder', 'kindly', 'do the needful', 'revert back',
        'please to', 'we has', 'your the', 'we was', 'has been compromise',
        'dear friend', 'good day to you', 'with due respect', 'humbly request'
    ]);
    if (grammarHits.length > 0) {
        addFlag('medium', 'Grammar Anomaly', `Unusual phrasing typical of mass phishing: "${grammarHits.slice(0, 2).join('", "')}"${grammarHits.length > 2 ? ` +${grammarHits.length - 2} more` : ''}.`, Math.min(grammarHits.length * 6, 18));
    }

    // ── 18. EXCESSIVE CAPITALIZATION ─────────────────────────────────
    const words = original.split(/\s+/).filter(w => w.length > 3);
    const allCapsWords = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w));
    const capsRatio = words.length > 5 ? allCapsWords.length / words.length : 0;
    if (capsRatio > 0.3) {
        addFlag('medium', 'Excessive Capitalization', `${Math.round(capsRatio * 100)}% of words are ALL-CAPS — often used to create false urgency.`, 8);
    }

    // ── 19. PUNCTUATION ABUSE ────────────────────────────────────────
    const excessivePunctuation = (original.match(/[!?]{2,}/g) || []).length;
    if (excessivePunctuation > 2) {
        addFlag('low', 'Punctuation Abuse', `${excessivePunctuation} instances of repeated exclamation/question marks — unprofessional formatting.`, 5);
    }

    // ── 20. MALICIOUS CTAs ───────────────────────────────────────────
    const ctaHits = matchPatterns([
        'click here', 'download now', 'open attachment', 'see attached',
        'view document', 'enable macros', 'enable content', 'open the file',
        'review the attached', 'download immediately', 'click the link below',
        'click below', 'tap here', 'follow this link', 'visit the link',
        'access your account', 'login now', 'sign in now', 'click to unblock',
        'click to restore', 'click to unlock'
    ]);
    if (ctaHits.length > 0) {
        addFlag(ctaHits.length >= 3 ? 'high' : 'medium', 'Malicious CTA', `Contains ${ctaHits.length} risky call-to-action(s): "${ctaHits.slice(0, 3).join('", "')}"${ctaHits.length > 3 ? ' +more' : ''}.`, Math.min(ctaHits.length * 8, 25));
    }

    // ── 21. AUTHORITY IMPERSONATION ──────────────────────────────────
    const authorityHits = matchPatterns([
        'law enforcement', 'police', 'fbi', 'cia', 'interpol', 'court order',
        'legal action', 'arrest warrant', 'summons', 'subpoena', 'lawsuit',
        'government', 'official notice', 'regulatory', 'department of',
        'ministry of', 'from the desk of', 'office of the', 'board of directors'
    ]);
    if (authorityHits.length > 0 && (urgencyHits.length > 0 || fearHits.length > 0 || credHits.length > 0)) {
        addFlag('high', 'Authority Impersonation', `Claims authority (${authorityHits.slice(0, 2).join(', ')}) while demanding action — classic social engineering.`, Math.min(authorityHits.length * 10, 20));
    }

    // ── 22. EXECUTIVE IMPERSONATION (BEC / Whaling) ──────────────────
    const becHits = matchPatterns([
        'ceo', 'cfo', 'managing director', 'chief executive', 'chief financial',
        'i need you to', 'please handle this', 'keep this confidential',
        'don\'t tell anyone', 'between us', 'personal favor', 'wire the funds',
        'process this payment', 'approve this transfer', 'do this quietly'
    ]);
    if (becHits.length >= 2) {
        addFlag('critical', 'Business Email Compromise', `${becHits.length} BEC/Whaling indicators found — impersonating an executive to authorize fraudulent actions.`, Math.min(becHits.length * 10, 25));
    }

    // ── 23. EMOTIONAL MANIPULATION ───────────────────────────────────
    const emotionHits = matchPatterns([
        'congratulations', 'you\'ve been selected', 'special offer',
        'exclusive deal', 'risk-free', 'guaranteed', 'no obligation',
        'once in a lifetime', 'secret', 'confidential', 'for your eyes only',
        'do not share', 'private matter'
    ]);
    if (emotionHits.length > 0) {
        addFlag(emotionHits.length >= 3 ? 'high' : 'medium', 'Emotional Manipulation', `Uses ${emotionHits.length} persuasion trigger(s): "${emotionHits.slice(0, 3).join('", "')}"${emotionHits.length > 3 ? ' +more' : ''}.`, Math.min(emotionHits.length * 7, 20));
    }

    // ── 24. SYMPATHY / CHARITY SCAM ──────────────────────────────────
    const sympathyHits = matchPatterns([
        'help me', 'i need your help', 'family emergency', 'stranded',
        'lost wallet', 'hospital', 'accident', 'please help', 'god bless',
        'dying wish', 'charity', 'donation', 'orphan', 'refugee',
        'medical bills', 'funeral expenses', 'cancer treatment'
    ]);
    if (sympathyHits.length >= 2) {
        addFlag('medium', 'Sympathy / Charity Scam', `Contains ${sympathyHits.length} emotional appeal(s): "${sympathyHits.slice(0, 3).join('", "')}" — may exploit compassion for financial gain.`, Math.min(sympathyHits.length * 7, 18));
    }

    // ── 25. ROMANCE / DATING SCAM ────────────────────────────────────
    const romanceHits = matchPatterns([
        'i fell in love', 'love at first', 'my heart belongs', 'soulmate',
        'i want to meet you', 'send me money for ticket', 'visa application',
        'come visit me', 'marry me', 'i\'m a soldier deployed', 'oil rig',
        'need money to travel', 'i\'m stuck in', 'beautiful woman', 'handsome man'
    ]);
    if (romanceHits.length >= 2) {
        addFlag('high', 'Romance Scam', `Detected ${romanceHits.length} romance scam pattern(s) — often leads to financial exploitation over time.`, Math.min(romanceHits.length * 10, 22));
    }

    // ── 26. JOB / EMPLOYMENT SCAM ────────────────────────────────────
    const jobHits = matchPatterns([
        'work from home', 'earn money fast', 'no experience needed',
        'guaranteed income', 'make money online', 'easy money',
        'hiring immediately', 'job offer', 'we found your resume',
        'salary: $', 'commission based', 'send your id for verification',
        'training fee', 'registration fee', 'equipment deposit'
    ]);
    if (jobHits.length >= 2) {
        addFlag('high', 'Employment Scam', `${jobHits.length} fake job indicators: "${jobHits.slice(0, 2).join('", "')}" — legitimate employers never ask for upfront fees.`, Math.min(jobHits.length * 8, 20));
    }

    // ── 27. SHIPPING / DELIVERY SCAM ─────────────────────────────────
    const shippingHits = matchPatterns([
        'package delivery', 'delivery failed', 'unable to deliver',
        'reschedule delivery', 'tracking number', 'customs fee',
        'delivery charge', 'parcel is waiting', 'shipment on hold',
        'pay delivery fee', 'update delivery address', 'your order'
    ]);
    if (shippingHits.length >= 2 && (urls.length > 0 || credHits.length > 0)) {
        addFlag('high', 'Delivery Scam', `${shippingHits.length} shipping fraud pattern(s) detected alongside suspicious links — likely a fake delivery notification.`, Math.min(shippingHits.length * 8, 20));
    }

    // ── 28. TECH SUPPORT SCAM ────────────────────────────────────────
    const techSupportHits = matchPatterns([
        'your computer is infected', 'virus detected', 'malware found',
        'call microsoft support', 'call apple support', 'tech support',
        'remote access', 'teamviewer', 'anydesk', 'allow remote',
        'your windows license', 'activate your windows', 'system error'
    ]);
    if (techSupportHits.length >= 2) {
        addFlag('high', 'Tech Support Scam', `${techSupportHits.length} fake tech support indicator(s): "${techSupportHits.slice(0, 2).join('", "')}" — designed to gain remote access to your device.`, Math.min(techSupportHits.length * 10, 22));
    }

    // ── 29. INVESTMENT / CRYPTO SCAM ─────────────────────────────────
    const investHits = matchPatterns([
        'guaranteed returns', 'double your money', 'invest now',
        'crypto opportunity', 'trading bot', 'forex signal',
        'pump and dump', 'ico launch', 'token presale', 'nft drop',
        'passive income', 'high yield', '10x returns', 'risk free investment'
    ]);
    if (investHits.length >= 2) {
        addFlag('high', 'Investment / Crypto Scam', `${investHits.length} fraudulent investment pattern(s): "${investHits.slice(0, 2).join('", "')}" — no legitimate investment guarantees returns.`, Math.min(investHits.length * 10, 22));
    }

    // ── 30. SEXTORTION / BLACKMAIL ───────────────────────────────────
    const sextortionHits = matchPatterns([
        'i recorded you', 'your webcam', 'intimate video', 'explicit content',
        'browsing history', 'visited adult', 'pay bitcoin or', 'i will release',
        'i have access to your', 'embarrassing', 'your contacts will see',
        'your reputation', 'send bitcoin to', 'your dirty secret'
    ]);
    if (sextortionHits.length >= 2) {
        addFlag('critical', 'Sextortion / Blackmail', `Contains ${sextortionHits.length} blackmail indicator(s) — this is a known mass-email extortion scam. DO NOT pay.`, Math.min(sextortionHits.length * 12, 30));
    }

    // ── 31. QR CODE PHISHING (Quishing) ──────────────────────────────
    const qrHits = matchPatterns([
        'scan this qr', 'qr code', 'scan the code', 'scan to verify',
        'scan to pay', 'scan for details', 'point your camera'
    ]);
    if (qrHits.length > 0 && (urgencyHits.length > 0 || credHits.length > 0)) {
        addFlag('high', 'QR Code Phishing', `QR code reference combined with urgency/credential requests — may redirect to a phishing page.`, 15);
    }

    // ── 32. CALLBACK PHISHING (TOAD) ─────────────────────────────────
    const callbackHits = matchPatterns([
        'call us at', 'call this number', 'call immediately', 'phone us',
        'dial this number', 'contact us at', 'ring us', 'speak to an agent',
        'call to cancel', 'call to confirm', 'toll-free number'
    ]);
    if (callbackHits.length > 0 && (urgencyHits.length > 0 || fearHits.length > 0)) {
        addFlag('high', 'Callback Phishing (TOAD)', `Telephone-Oriented Attack Delivery detected — urgently directs you to call a fraudulent number.`, 15);
    }

    // ── 33. CLOUD SERVICE ABUSE ──────────────────────────────────────
    const cloudHits = matchPatterns([
        'shared a document', 'shared a file', 'google docs', 'google drive',
        'onedrive', 'sharepoint', 'icloud', 'wetransfer', 'shared folder',
        'view shared file', 'access shared document', 'shared with you'
    ]);
    if (cloudHits.length > 0 && (urls.length > 0 || ctaHits.length > 0)) {
        addFlag('medium', 'Cloud Service Abuse', `References cloud file sharing (${cloudHits.slice(0, 2).join(', ')}) with embedded links — may lead to credential harvesting pages.`, 12);
    }

    // ── 34. MFA FATIGUE / PUSH BOMBING ───────────────────────────────
    const mfaHits = matchPatterns([
        'approve the login', 'approve sign-in', 'accept the notification',
        'confirm it was you', 'tap yes on your phone', 'authorize this device',
        'we sent a push', 'please approve'
    ]);
    if (mfaHits.length > 0) {
        addFlag('critical', 'MFA Fatigue Attack', `Attempts to trick you into approving a fraudulent authentication push — "${mfaHits.slice(0, 2).join('", "')}"`, Math.min(mfaHits.length * 12, 20));
    }

    // ── 35. EMAIL HEADER ANOMALIES ───────────────────────────────────
    const headerHits = matchPatterns(['noreply@', 'no-reply@', 'donotreply@', 'mailer-daemon', 'return-path:', 'reply-to:', 'x-mailer:', 'mime-version:']);
    const hasMismatch = /from:.*?<[^>]+>/i.test(lower) && /reply-to:.*?<[^>]+>/i.test(lower);
    if (headerHits.length >= 2 || hasMismatch) {
        addFlag('medium', 'Email Header Anomaly', hasMismatch ? 'From and Reply-To addresses differ — a classic email spoofing technique.' : 'Raw email headers detected with suspicious indicators.', 10);
    }

    // ── 36. MALWARE / EXECUTABLE REFERENCES ──────────────────────────
    const malwareExts = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.jar', '.msi', '.ps1', '.dll', '.com', '.hta', '.wsf', '.iso', '.img', '.dmg', '.apk'];
    const malwareHits = malwareExts.filter(ext => lower.includes(ext));
    if (malwareHits.length > 0) {
        addFlag('critical', 'Malware Reference', `References dangerous file type(s): ${malwareHits.join(', ')} — may contain executable malware.`, malwareHits.length * 15);
    }

    // ── 37. OBFUSCATED / ENCODED CONTENT ─────────────────────────────
    const longRandom = original.match(/[a-zA-Z0-9]{30,}/g) || [];
    const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
    const base64Hits = original.match(base64Pattern) || [];
    if (longRandom.length > 0 || base64Hits.length > 2) {
        addFlag('medium', 'Obfuscated Content', `Contains ${longRandom.length + base64Hits.length} suspicious encoded string(s) — may be payloads, tracking tokens, or obfuscated URLs.`, 8);
    }

    // ── 38. SOCIAL MEDIA ACCOUNT THREAT ──────────────────────────────
    const socialHits = matchPatterns([
        'your account violated', 'community guidelines', 'terms of service violation',
        'your page will be deleted', 'your profile will be', 'account suspension',
        'verify your page', 'appeal the decision', 'copyright infringement',
        'intellectual property', 'trademark violation'
    ]);
    if (socialHits.length >= 2) {
        addFlag('high', 'Social Media Threat', `${socialHits.length} fake social media enforcement indicator(s) — platforms never ask for credentials via email/SMS.`, Math.min(socialHits.length * 8, 20));
    }

    // ── 39. SUBSCRIPTION TRAP ────────────────────────────────────────
    const subHits = matchPatterns([
        'free trial', 'auto-renewal', 'subscription confirmed',
        'your membership', 'cancel within', 'charged automatically',
        'recurring payment', 'annual fee', 'renew now', 'upgrade your plan',
        'your subscription expires', 'payment method expired'
    ]);
    if (subHits.length >= 2 && (urls.length > 0 || ctaHits.length > 0)) {
        addFlag('medium', 'Subscription Trap', `${subHits.length} fake subscription pressure tactic(s) detected — designed to panic you into clicking.`, Math.min(subHits.length * 7, 18));
    }

    // ── 40. TAX / GOVERNMENT REFUND SCAM ─────────────────────────────
    const taxHits = matchPatterns([
        'tax refund', 'owed a refund', 'file your taxes', 'irs notice',
        'tax return', 'government grant', 'stimulus check', 'benefits claim',
        'social welfare', 'pension update', 'national insurance',
        'hmrc refund', 'tax rebate', 'claim your refund'
    ]);
    if (taxHits.length >= 2) {
        addFlag('high', 'Tax / Government Scam', `${taxHits.length} government impersonation pattern(s): "${taxHits.slice(0, 2).join('", "')}" — government agencies never request payments via email.`, Math.min(taxHits.length * 10, 22));
    }

    // ══════════════════════════════════════════════════════════════════
    // MULTI-SIGNAL CORRELATION ENGINE
    // ══════════════════════════════════════════════════════════════════
    const signalCategories = [
        urgencyHits.length > 0, fearHits.length > 0, credHits.length > 0,
        otpHits.length > 0, urls.length > 0, brandHits.length > 0,
        finHits.length > 0, ctaHits.length > 0, authorityHits.length > 0,
        becHits.length >= 2, sextortionHits.length >= 2, malwareHits.length > 0,
        typoHits.length > 0, emotionHits.length > 0
    ].filter(Boolean).length;

    if (signalCategories >= 5) {
        addFlag('critical', 'Multi-Vector Attack', `This content triggers ${signalCategories} independent threat categories simultaneously — hallmark of a sophisticated, targeted attack.`, 20);
    } else if (signalCategories >= 4) {
        addFlag('critical', 'Cross-Category Correlation', `${signalCategories} distinct threat signals detected together — significantly increases confidence this is malicious.`, 12);
    } else if (signalCategories >= 3) {
        threatScore += 6;
    }

    // ══════════════════════════════════════════════════════════════════
    // SAFE CONTENT (nothing triggered)
    // ══════════════════════════════════════════════════════════════════
    if (flags.length === 0) {
        if (lower.length < 50) {
            flags.push({ type: 'safe', category: 'Benign Content', text: 'The message is very short and contains no phishing indicators. However, sender context always matters.' });
        } else {
            flags.push({ type: 'safe', category: 'Clean Content', text: 'No known phishing, social engineering, fraud, or malware indicators were detected across 40 analysis categories.' });
        }
    }

    // ── Calculate final safety score ─────────────────────────────────
    const safetyScore = Math.max(0, Math.min(100, 100 - threatScore));

    let riskLabel;
    if (safetyScore <= 15) riskLabel = 'CRITICAL RISK';
    else if (safetyScore <= 35) riskLabel = 'HIGH RISK';
    else if (safetyScore <= 55) riskLabel = 'SUSPICIOUS';
    else if (safetyScore <= 80) riskLabel = 'LOW RISK';
    else riskLabel = 'SAFE';

    // ── Contextual summary with flag count ───────────────────────────
    const summaryMap = {
        'CRITICAL RISK': `${signalCategories >= 5 ? 'Sophisticated multi-vector' : 'High-confidence'} phishing attack detected across ${flags.length} indicators. This content is almost certainly malicious and engineered to steal sensitive information or funds.`,
        'HIGH RISK': `${flags.length} strong phishing pattern(s) identified across multiple analysis categories. This content exhibits characteristics consistent with targeted social engineering campaigns.`,
        'SUSPICIOUS': `${flags.length} suspicious element(s) detected. While not definitively malicious, this content contains patterns commonly used in phishing — verify the sender independently.`,
        'LOW RISK': `Minor indicators detected (${flags.length} flag${flags.length > 1 ? 's' : ''}). The content appears mostly benign but always maintain caution with unsolicited messages.`,
        'SAFE': 'Analyzed across 40 detection categories — no phishing, fraud, or social engineering patterns detected. The content appears to be legitimate.',
    };

    const recommendationMap = {
        'CRITICAL RISK': 'Do NOT click any links, open attachments, call any numbers, or provide any information. Report as phishing and delete immediately.',
        'HIGH RISK': 'Avoid interacting entirely. Contact the supposed sender through their official website or known phone number to verify authenticity.',
        'SUSPICIOUS': 'Do not click links or provide information. Verify the sender\'s identity through an independent, trusted channel before any response.',
        'LOW RISK': 'Exercise standard caution. If the message is unexpected, verify the sender before taking any requested action.',
        'SAFE': 'No action needed. The content passed all 40 detection checks. Always remain vigilant with unsolicited communications.',
    };

    return {
        score: safetyScore,
        riskLabel,
        summary: summaryMap[riskLabel],
        flags: flags.slice(0, 12), // Cap at 12 most relevant
        recommendation: recommendationMap[riskLabel],
    };
};

const PhishingAnalyzer = () => {
    const addToast = useToastStore(s => s.addToast);
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [engine, setEngine] = useState('gemini'); // 'gemini' | 'groq' | 'huggingface' | 'local'

    const ENGINE_LABELS = {
        gemini: 'Gemini AI',
        groq: 'Groq AI',
        huggingface: 'HuggingFace AI',
        local: 'Local Engine',
    };

    const analyzeContent = async () => {
        if (!input.trim()) return addToast("Please paste an email or URL to analyze.", "warning");
        
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);
        setEngine('gemini');

        const interval = setInterval(() => {
            setProgress(prev => prev >= 92 ? 92 : prev + (Math.random() * 8));
        }, 400);

        // Always try cloud AI first (Gemini → Groq → HuggingFace cascade handled by backend)
        try {
            const apiResponse = await analyzePhishingData(input);
            clearInterval(interval);
            setProgress(100);

            if (apiResponse.success && apiResponse.data) {
                const usedEngine = apiResponse.engine || 'gemini';
                setEngine(usedEngine);
                setResult(apiResponse.data);
                if (usedEngine !== 'gemini') {
                    addToast(`Analyzed with ${ENGINE_LABELS[usedEngine] || usedEngine}.`, "info");
                }
            } else {
                throw new Error("Invalid API response");
            }
        } catch (error) {
            clearInterval(interval);
            // Final fallback: Local Heuristic Engine (40 categories)
            setEngine('local');
            setProgress(100);
            const localResult = analyzeLocally(input);
            setResult(localResult);
            addToast("All AI unavailable — analyzed with Local Engine (40 categories).", "info");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) setInput(text);
        } catch {
            addToast("Unable to read clipboard.", "warning");
        }
    };

    const resetAnalyzer = () => {
        setInput('');
        setResult(null);
        setProgress(0);
        setEngine('gemini');
    };

    const riskStyle = result ? (RISK_CONFIG[result.riskLabel] || RISK_CONFIG['SUSPICIOUS']) : null;

    return (
        <div className="p-3 sm:p-4 lg:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-8">
            <header>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mb-2 flex items-center gap-2 sm:gap-3">
                    <Sparkles className="text-primary shrink-0" size={24} /> AI Phishing Analyzer
                </h1>
                <p className="text-muted-foreground text-sm">
                    {engine === 'local' 
                        ? <>Analyzed using <span className="font-semibold text-yellow-500">Local Heuristic Engine</span> (40 detection categories). Cloud AI will auto-resume when available.</>
                        : engine === 'groq'
                        ? <>Analyzed using <span className="font-semibold text-blue-400">Groq AI (Llama 3.3)</span>. Gemini will auto-resume when quota resets.</>
                        : engine === 'huggingface'
                        ? <>Analyzed using <span className="font-semibold text-amber-400">HuggingFace AI (Mistral 7B)</span>. Higher-tier AI will auto-resume when available.</>
                        : <>Paste suspicious emails, SMS texts, or URLs. Powered by <span className="font-semibold text-primary">Gemini 2.5 Flash</span> with multi-AI fallback.</>
                    }
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">
                {/* ── Input Panel ─────────────────────────────────────── */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Message Content / URL</label>
                        <button onClick={handlePaste} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                            <Clipboard size={12} /> Paste
                        </button>
                    </div>
                    <textarea 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Paste the suspicious content here..."
                        className="w-full h-40 sm:h-64 px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-black/5 dark:bg-white/5 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none custom-scrollbar mb-3 sm:mb-4"
                        disabled={isAnalyzing}
                    />
                    
                    {isAnalyzing ? (
                        <div className="mt-auto space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-primary">
                                <span>Analyzing...</span>
                                <span>{Math.floor(progress)}%</span>
                            </div>
                            <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-primary rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="mt-auto flex gap-2">
                            <motion.button 
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={analyzeContent}
                                disabled={!input.trim()}
                                className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                            >
                                <Search size={18} /> Analyze
                            </motion.button>
                            {result && (
                                <motion.button 
                                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={resetAnalyzer}
                                    className="px-4 py-3.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                                >
                                    <RotateCcw size={18} />
                                </motion.button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Results Panel ───────────────────────────────────── */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border relative overflow-hidden flex flex-col min-h-[300px] sm:min-h-0">
                    {!result && !isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none p-10 text-center">
                            <Bot size={56} className="mb-4 text-muted-foreground" />
                            <p className="font-bold text-lg">Awaiting Input</p>
                            <p className="text-sm">AI engine is ready to scan.</p>
                        </div>
                    )}
                    
                    {isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 transition-all">
                            <Loader2 size={48} className="animate-spin text-primary mb-4" />
                            <p className="font-mono text-sm tracking-widest text-primary animate-pulse">Running Deep Analysis...</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {result && (
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full z-20 relative gap-4 sm:gap-5">
                                
                                {/* Score + Verdict Header */}
                                <div className={clsx("p-4 sm:p-5 rounded-2xl border bg-gradient-to-br flex items-start sm:items-center gap-3 sm:gap-4", riskStyle.gradient, riskStyle.border)}>
                                    <div className={clsx("w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-[3px] shadow-lg shrink-0", riskStyle.border, riskStyle.text, `${riskStyle.bg}/10`)}>
                                        <span className="text-lg sm:text-xl font-black">{result.score}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <h2 className={clsx("text-lg sm:text-xl font-black tracking-tight", riskStyle.text)}>
                                                {result.riskLabel}
                                            </h2>
                                            <span className={clsx(
                                                "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0",
                                                engine === 'local' 
                                                    ? 'bg-yellow-500/15 text-yellow-500' 
                                                    : engine === 'groq'
                                                    ? 'bg-blue-400/15 text-blue-400'
                                                    : engine === 'huggingface'
                                                    ? 'bg-amber-400/15 text-amber-400'
                                                    : 'bg-primary/15 text-primary'
                                            )}>
                                                {engine === 'local' ? '⚙ Local Engine' : engine === 'groq' ? '✦ Groq AI' : engine === 'huggingface' ? '✦ HuggingFace AI' : '✦ Gemini AI'}
                                            </span>
                                        </div>
                                        {result.summary && (
                                            <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Detection Flags */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Detection Flags</h3>
                                    {result.flags?.map((flag, idx) => {
                                        const IconComponent = FLAG_ICON[flag.type] || AlertTriangle;
                                        return (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
                                                key={idx} 
                                                className={clsx("p-3 sm:p-3.5 rounded-xl flex items-start gap-2.5 border", FLAG_STYLES[flag.type] || FLAG_STYLES.medium)}
                                            >
                                                <IconComponent size={16} className="shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    {flag.category && (
                                                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 block mb-0.5">{flag.category}</span>
                                                    )}
                                                    <p className="text-xs sm:text-sm font-semibold leading-snug">{flag.text}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Recommendation */}
                                {result.recommendation && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                                        className="p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5"
                                    >
                                        <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary block mb-0.5">
                                                {engine === 'local' ? 'Engine Recommendation' : `${ENGINE_LABELS[engine] || 'AI'} Recommendation`}
                                            </span>
                                            <p className="text-xs sm:text-sm text-foreground/80 font-medium leading-snug">{result.recommendation}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default PhishingAnalyzer;
