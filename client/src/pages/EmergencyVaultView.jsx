import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, ShieldOff, ShieldCheck, Clock, Loader2, AlertTriangle,
    CheckCircle2, Key, Eye, EyeOff, Copy, Check,
    RefreshCw, KeyRound, Lock, FileText, CreditCard, Wifi, UserCircle,
    FileUp, ClipboardPaste, Upload
} from 'lucide-react';
import { requestEmergencyAccess, getEmergencyVaultAccess } from '../lib/api';
import { loadPrivateKey, hasPrivateKey, decryptWithPrivateKey, savePrivateKey, verifyKeyPair } from '../lib/cryptoUtils';
import CryptoJS from 'crypto-js';

// ── Phase states ──────────────────────────────────────────────────────────
const PHASE = {
    CHECKING_KEY: 'checking_key',
    NO_KEY: 'no_key',
    READY_TO_REQUEST: 'ready_to_request',
    REQUESTING: 'requesting',
    WAITING: 'waiting',
    LOADING_VAULT: 'loading_vault',
    NEED_MASTER: 'need_master',
    VAULT_READY: 'vault_ready',
    ACCESS_DENIED: 'access_denied',
    ERROR: 'error'
};

// ── Item type icon ─────────────────────────────────────────────────────────
const TypeIcon = ({ type }) => {
    switch (type) {
        case 'CREDIT_CARD': return <CreditCard size={16} className="text-purple-400" />;
        case 'IDENTITY':    return <UserCircle size={16} className="text-blue-400" />;
        case 'WIFI':        return <Wifi size={16} className="text-sky-400" />;
        case 'SECURE_NOTE': return <FileText size={16} className="text-orange-400" />;
        default:            return <KeyRound size={16} className="text-emerald-400" />;
    }
};

// ── Copy button ────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={`p-1.5 rounded-lg transition-all text-xs ${copied ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/60'}`}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
    );
}

// ── Countdown timer ───────────────────────────────────────────────────────
function Countdown({ deadline }) {
    const [remaining, setRemaining] = useState('');
    useEffect(() => {
        const update = () => {
            const diff = new Date(deadline).getTime() - Date.now();
            if (diff <= 0) { setRemaining('Window passed'); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(`${h}h ${m}m ${s}s`);
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [deadline]);
    return <span className="font-mono font-bold text-amber-300">{remaining}</span>;
}

// ══════════════════════════════════════════════════════════════════════════
export default function EmergencyVaultView() {
    const { contactId } = useParams();

    const [phase, setPhase] = useState(PHASE.CHECKING_KEY);
    const [errorMsg, setErrorMsg] = useState('');
    const [approvalDeadline, setApprovalDeadline] = useState(null);
    const [ownerName, setOwnerName] = useState('');

    // ── Vault state ───────────────────────────────────────────────────
    const [vaultBundle, setVaultBundle] = useState(null); // raw encrypted items from server
    const [encMasterKeyBundle, setEncMasterKeyBundle] = useState(null); // RSA bundle
    const [masterPassword, setMasterPassword] = useState('');
    const [showMaster, setShowMaster] = useState(false);
    const [decryptedItems, setDecryptedItems] = useState([]);
    const [decryptError, setDecryptError] = useState('');
    const [showPasswords, setShowPasswords] = useState({});

    // ── Key Import state ──────────────────────────────────────────────
    const [showImportArea, setShowImportArea] = useState(false);
    const [pastedKey, setPastedKey] = useState('');
    const [importError, setImportError] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    // ── Check if private key exists in this browser ───────────────────
    useEffect(() => {
        if (!contactId) {
            setPhase(PHASE.ERROR);
            setErrorMsg('Invalid contact ID in URL');
            return;
        }
        const hasKey = hasPrivateKey(contactId);
        if (!hasKey) {
            setPhase(PHASE.NO_KEY);
        } else {
            // Key exists — try to get vault access
            fetchVaultAccess();
        }
    }, [contactId]); // eslint-disable-line

    // ── Handle Key Import ─────────────────────────────────────────────
    const handleFileImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsImporting(true);
        setImportError('');
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target.result;
                // Extract Base64 key
                const keyMatch = content.match(/PRIVATE KEY \(Base64 RSA-OAEP PKCS8\):\s*([a-zA-Z0-9+/=]+)/);
                const key = keyMatch ? keyMatch[1].trim() : content.trim();

                if (key.length < 50) throw new Error('Invalid key format.');

                // 1. Get server's public key for validation
                const result = await getEmergencyVaultAccess(contactId);
                const serverPublicKey = result.contactPublicKey;
                if (!serverPublicKey) throw new Error('Could not fetch validation key from server.');

                // 2. Cross-verify Key Pair
                const isValid = await verifyKeyPair(key, serverPublicKey);
                if (!isValid) throw new Error('Security Error: This backup file does not match your emergency access record.');

                savePrivateKey(contactId, key);
                setPhase(PHASE.CHECKING_KEY);
                setTimeout(() => window.location.reload(), 500);
            } catch (err) {
                setImportError(err.message || 'Could not parse key file.');
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
    };

    const handleManualImport = async () => {
        if (!pastedKey.trim() || pastedKey.length < 50) {
            setImportError('Please enter a valid RSA private key string.');
            return;
        }
        setIsImporting(true);
        setImportError('');
        try {
            const result = await getEmergencyVaultAccess(contactId);
            const serverPublicKey = result.contactPublicKey;
            if (!serverPublicKey) throw new Error('Could not fetch validation key from server.');

            const isValid = await verifyKeyPair(pastedKey.trim(), serverPublicKey);
            if (!isValid) throw new Error('Security Error: The provided key does not match your emergency access record.');

            savePrivateKey(contactId, pastedKey.trim());
            setPhase(PHASE.CHECKING_KEY);
            setTimeout(() => window.location.reload(), 500);
        } catch (err) {
            setImportError(err.message || 'Failed to verify key.');
        } finally {
            setIsImporting(false);
        }
    };

    // ── Request emergency access ──────────────────────────────────────
    const handleRequestAccess = useCallback(async () => {
        setPhase(PHASE.REQUESTING);
        try {
            const result = await requestEmergencyAccess(contactId);
            if (result.accessApprovalDeadline) {
                setApprovalDeadline(result.accessApprovalDeadline);
                setPhase(PHASE.WAITING);
            } else if (result.status === 409) {
                // Already requested
                fetchVaultAccess();
            } else {
                fetchVaultAccess();
            }
        } catch (err) {
            setPhase(PHASE.ERROR);
            setErrorMsg(err.message);
        }
    }, [contactId]); // eslint-disable-line

    // ── Poll / fetch vault access ─────────────────────────────────────
    const fetchVaultAccess = useCallback(async () => {
        setPhase(PHASE.LOADING_VAULT);
        try {
            const result = await getEmergencyVaultAccess(contactId);

            if (result.httpStatus === 202) {
                // Still in approval window
                setApprovalDeadline(result.accessApprovalDeadline);
                setPhase(PHASE.WAITING);
                return;
            }

            if (result.encryptedVaultBlob) {
                setOwnerName(result.ownerName || 'the owner');
                setVaultBundle(result.encryptedVaultBlob);
                setEncMasterKeyBundle(result.encryptedMasterKeyBundle || null);
                setPhase(PHASE.NEED_MASTER);
            } else {
                setPhase(PHASE.READY_TO_REQUEST);
            }
        } catch (err) {
            if (err.message?.includes('denied')) {
                setPhase(PHASE.ACCESS_DENIED);
            } else if (err.message?.includes('access request') || err.message?.includes('Please request')) {
                // Contact hasn't requested access yet — show "Request Access" button
                setPhase(PHASE.READY_TO_REQUEST);
            } else {
                setPhase(PHASE.ERROR);
                setErrorMsg(err.message);
            }
        }
    }, [contactId]); // eslint-disable-line

    // ── Decrypt vault items with master password ──────────────────────
    const handleDecrypt = useCallback(async (manualPassword = null) => {
        const passwordToUse = manualPassword || masterPassword;
        if (!passwordToUse || !vaultBundle) return;
        setDecryptError('');

        try {
            const bundle = JSON.parse(vaultBundle);
            const items = bundle.items || [];

            const decrypted = items.map(item => {
                try {
                    const bytes = CryptoJS.AES.decrypt(item.encryptedData, passwordToUse);
                    const text = bytes.toString(CryptoJS.enc.Utf8);
                    if (!text) return null;
                    return { id: item.id, ...JSON.parse(text) };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            if (decrypted.length === 0 && items.length > 0) {
                setDecryptError(manualPassword ? 'Incorrect master password.' : 'Decryption failed. RSA key or password may be incorrect.');
                return;
            }

            setDecryptedItems(decrypted);
            setPhase(PHASE.VAULT_READY);
        } catch {
            setDecryptError('Failed to parse vault data.');
        }
    }, [masterPassword, vaultBundle]);

    // ── Attempt RSA Decryption automatically ──────────────────────────
    const attemptRSADecrypt = useCallback(async () => {
        if (!encMasterKeyBundle || !contactId || phase !== PHASE.NEED_MASTER) return;

        try {
            const privateKey = loadPrivateKey(contactId);
            if (!privateKey) return;

            // Decrypt the master key using RSA private key
            const decryptedMasterKey = await decryptWithPrivateKey(encMasterKeyBundle, privateKey);
            
            if (decryptedMasterKey) {
                // Success! Use this key to decrypt the rest of the vault
                handleDecrypt(decryptedMasterKey);
            }
        } catch (err) {
            console.error('RSA Decryption failed:', err);
        }
    }, [encMasterKeyBundle, contactId, phase, handleDecrypt]);

    useEffect(() => {
        if (phase === PHASE.NEED_MASTER && encMasterKeyBundle) {
            attemptRSADecrypt();
        }
    }, [phase, encMasterKeyBundle, attemptRSADecrypt]);

    // ══════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0d0f1a] via-[#111827] to-[#0d0f1a] p-4">
            <div className="max-w-2xl mx-auto">

                {/* Brand */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-3 my-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Shield size={20} className="text-white" />
                    </div>
                    <div>
                        <span className="font-black text-xl tracking-tight text-white">Keeper<span className="text-violet-400">X</span></span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Emergency Vault Access</p>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">

                    {/* ── Checking / Loading ─────────────────────────── */}
                    {(phase === PHASE.CHECKING_KEY || phase === PHASE.LOADING_VAULT || phase === PHASE.REQUESTING) && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center">
                            <div className="relative mx-auto w-12 h-12 sm:w-16 sm:h-16 mb-6">
                                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                                <div className="absolute inset-0 rounded-full border-t-2 border-violet-400 animate-spin" />
                            </div>
                            <p className="text-white/70 font-semibold text-sm sm:text-base">
                                {phase === PHASE.REQUESTING ? 'Submitting access request…' : 'Checking access status…'}
                            </p>
                        </motion.div>
                    )}

                    {/* ── Ready to Request ─────────────────────────────── */}
                    {phase === PHASE.READY_TO_REQUEST && (
                        <motion.div key="ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-10 text-center space-y-5 sm:space-y-6">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-violet-500/10 rounded-full flex items-center justify-center mb-4 sm:mb-5 mx-auto border border-violet-400/20">
                                <Shield size={24} className="sm:size-[28px] text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white">Emergency Vault Access</h2>
                                <p className="text-white/50 text-xs sm:text-sm mt-2">
                                    If the vault owner has been inactive for the required period, you can request access to their vault. They will have 24 hours to deny your request.
                                </p>
                            </div>
                            <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-left">
                                <p className="text-[11px] font-bold text-blue-300 mb-1.5">🔐 What happens next?</p>
                                <div className="text-[10px] sm:text-[11px] text-blue-200/60 space-y-1">
                                    <p>1. We check if the owner has been inactive long enough.</p>
                                    <p>2. If yes, an access request is submitted.</p>
                                    <p>3. The owner gets 24 hours to deny. Otherwise, access is granted.</p>
                                </div>
                            </div>
                            <motion.button
                                id="emergency-request-access-btn"
                                whileTap={{ scale: 0.97 }}
                                onClick={handleRequestAccess}
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 sm:py-3.5 rounded-2xl font-bold shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
                            >
                                <AlertTriangle size={16} /> Request Emergency Access
                            </motion.button>
                            <p className="text-white/30 text-[10px]">Contact ID: {contactId}</p>
                        </motion.div>
                    )}

                    {/* ── No Private Key ─────────────────────────────── */}
                    {phase === PHASE.NO_KEY && (
                        <motion.div key="nokey" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-6 sm:p-8 text-center space-y-5 sm:space-y-6">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-1 sm:mb-2 mx-auto border border-amber-400/20">
                                <Key size={24} className="sm:size-[28px] text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white">Private Key Not Found</h2>
                                <p className="text-white/50 text-xs sm:text-sm mt-2">
                                    Your secure access key is missing from this browser. You need it to decrypt the vault.
                                </p>
                            </div>

                            {!showImportArea ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left">
                                        <p className="text-xs font-bold text-amber-300 mb-1">How to fix this:</p>
                                        <ul className="text-[11px] text-amber-200/60 list-disc list-inside space-y-1">
                                            <li>Use the original device/browser where you accepted the invite.</li>
                                            <li>Import your <strong>Private Key Backup</strong> file below.</li>
                                        </ul>
                                    </div>
                                    <button
                                        onClick={() => setShowImportArea(true)}
                                        className="w-full bg-white/10 border border-white/20 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
                                    >
                                        <FileUp size={16} /> Import Private Key
                                    </button>
                                </div>
                            ) : (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 text-left">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Option 1: Upload Backup File</label>
                                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:bg-white/5 hover:border-violet-500/40 transition-all">
                                            <div className="flex flex-col items-center justify-center pt-2 pb-2">
                                                {isImporting ? <Loader2 size={24} className="animate-spin text-violet-400" /> : <Upload size={24} className="text-white/40 mb-1" />}
                                                <p className="text-xs text-white/60 font-medium">{isImporting ? 'Importing...' : 'Select .txt backup file'}</p>
                                            </div>
                                            <input type="file" className="hidden" accept=".txt" onChange={handleFileImport} disabled={isImporting} />
                                        </label>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
                                        <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-white/20"><span className="bg-[#111827] px-2">OR</span></div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Option 2: Paste Key String</label>
                                        <textarea
                                            value={pastedKey}
                                            onChange={e => { setPastedKey(e.target.value); setImportError(''); }}
                                            placeholder="Paste the Base64 private key here..."
                                            className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] font-mono text-white/60 focus:outline-none focus:border-violet-500/40 transition-all resize-none"
                                        />
                                        {importError && <p className="text-red-400 text-[10px] font-bold mt-1 ml-1">❌ {importError}</p>}
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowImportArea(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-xs font-bold hover:bg-white/5 transition-all">Cancel</button>
                                            <button onClick={handleManualImport} disabled={!pastedKey.trim()} className="flex-2 flex-grow-[2] py-3 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-lg shadow-violet-500/20 hover:bg-violet-500 disabled:opacity-40 transition-all">
                                                Confirm Key
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <p className="text-white/20 text-[10px]">Contact ID: {contactId}</p>
                        </motion.div>
                    )}

                    {/* ── Waiting — Approval Window ──────────────────── */}
                    {phase === PHASE.WAITING && (
                        <motion.div key="waiting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-10 text-center space-y-5">
                            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-400/20">
                                <Clock size={28} className="text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Access Request Submitted</h2>
                                <p className="text-white/50 text-sm mt-2">
                                    The vault owner has been notified. They have 24 hours to deny. If no action is taken, access will be granted automatically.
                                </p>
                            </div>
                            {approvalDeadline && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                    <p className="text-white/40 text-xs mb-1">Approval window closes in:</p>
                                    <Countdown deadline={approvalDeadline} />
                                </div>
                            )}
                            <button
                                id="emergency-check-status"
                                onClick={fetchVaultAccess}
                                className="flex items-center gap-2 mx-auto text-sm text-violet-400 hover:text-violet-300 transition-colors"
                            >
                                <RefreshCw size={13} /> Check Status
                            </button>
                        </motion.div>
                    )}

                    {/* ── Need Master Password ───────────────────────── */}
                    {phase === PHASE.NEED_MASTER && (
                        <motion.div key="master" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5">
                            <div className="text-center">
                                <div className="w-12 sm:w-14 h-12 sm:h-14 bg-violet-500/20 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-violet-400/20">
                                    <Lock size={20} className="sm:size-[24px] text-violet-400" />
                                </div>
                                <h2 className="text-lg sm:text-xl font-bold text-white">Access Granted!</h2>
                                <p className="text-white/50 text-xs sm:text-sm mt-1">
                                    Enter <span className="font-bold text-white">{ownerName}'s</span> master password to decrypt their vault
                                </p>
                            </div>
                            
                            {encMasterKeyBundle ? (
                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <ShieldCheck size={14} className="text-green-400" />
                                        <p className="text-xs font-bold text-green-300">RSA Decryption Available</p>
                                    </div>
                                    <p className="text-[10px] text-green-200/50 leading-relaxed">
                                        We found your private key. If the owner has securely shared access, the vault will decrypt automatically. 
                                        If it doesn't, you can still enter the password manually below.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200/70">
                                    <p className="font-bold text-blue-300 mb-0.5">🔐 Zero-Knowledge Preserved</p>
                                    Decryption happens only in your browser. We never see passwords.
                                </div>
                            )}
                            <div className="relative">
                                <input
                                    id="emergency-master-input"
                                    type={showMaster ? 'text' : 'password'}
                                    value={masterPassword}
                                    onChange={e => { setMasterPassword(e.target.value); setDecryptError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
                                    placeholder="Owner's master password"
                                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-white pr-12 focus:outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                />
                                <button onClick={() => setShowMaster(p => !p)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                                    {showMaster ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {decryptError && <p className="text-red-400 text-xs font-semibold">{decryptError}</p>}
                            <motion.button whileTap={{ scale: 0.97 }} onClick={handleDecrypt}
                                disabled={!masterPassword}
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 disabled:opacity-40 transition-all">
                                <Key size={16} /> Decrypt Vault
                            </motion.button>
                        </motion.div>
                    )}

                    {/* ── Vault Ready — Show Items ───────────────────── */}
                    {phase === PHASE.VAULT_READY && (
                        <motion.div key="vault" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="space-y-4 pb-10">
                            <div className="flex items-center justify-between px-1 mb-2">
                                <div>
                                    <h2 className="text-lg font-bold text-white">{ownerName}'s Vault</h2>
                                    <p className="text-xs text-white/40">{decryptedItems.length} item{decryptedItems.length !== 1 ? 's' : ''} decrypted</p>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                                    <CheckCircle2 size={11} /> Access Granted
                                </div>
                            </div>

                            {decryptedItems.map(item => (
                                <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                                            <TypeIcon type={item.itemType} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{item.appName || 'Unknown'}</p>
                                            <p className="text-[10px] text-white/40 uppercase tracking-widest">{item.itemType || 'Login'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {item.username && (
                                            <div className="flex items-center justify-between gap-2 p-2.5 bg-white/5 rounded-xl">
                                                <div>
                                                    <p className="text-[9px] text-white/30 uppercase tracking-widest">Username</p>
                                                    <p className="text-xs font-mono text-white/80">{item.username}</p>
                                                </div>
                                                <CopyBtn text={item.username} />
                                            </div>
                                        )}
                                        {item.password && (
                                            <div className="flex items-center justify-between gap-2 p-2.5 bg-white/5 rounded-xl">
                                                <div>
                                                    <p className="text-[9px] text-white/30 uppercase tracking-widest">Password</p>
                                                    <p className={`text-xs font-mono text-white/80 transition-all ${!showPasswords[item.id] ? 'blur-[4px]' : ''}`}>{item.password}</p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => setShowPasswords(p => ({ ...p, [item.id]: !p[item.id] }))}
                                                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 transition-all">
                                                        {showPasswords[item.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                                    </button>
                                                    <CopyBtn text={item.password} />
                                                </div>
                                            </div>
                                        )}
                                        {item.url && (
                                            <div className="flex items-center justify-between gap-2 p-2.5 bg-white/5 rounded-xl">
                                                <div>
                                                    <p className="text-[9px] text-white/30 uppercase tracking-widest">Website</p>
                                                    <p className="text-xs font-mono text-white/80">{item.url}</p>
                                                </div>
                                                <CopyBtn text={item.url} />
                                            </div>
                                        )}
                                        {item.note && (
                                            <div className="p-2.5 bg-white/5 rounded-xl">
                                                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Note</p>
                                                <p className="text-xs text-white/70 whitespace-pre-wrap">{item.note}</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {/* ── Access Denied ──────────────────────────────── */}
                    {phase === PHASE.ACCESS_DENIED && (
                        <motion.div key="denied" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-red-500/20 rounded-3xl p-10 text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5 mx-auto">
                                <ShieldOff size={28} className="text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                            <p className="text-white/50 text-sm">The owner denied your access request. You may request again after the inactivity period.</p>
                        </motion.div>
                    )}

                    {/* ── Error ──────────────────────────────────────── */}
                    {phase === PHASE.ERROR && (
                        <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-red-500/20 rounded-3xl p-10 text-center">
                            <ShieldOff size={32} className="text-red-400 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">Something Went Wrong</h2>
                            <p className="text-white/50 text-sm">{errorMsg}</p>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
}
