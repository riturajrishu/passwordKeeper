import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, Eye, EyeOff, Copy, Check, AlertTriangle,
    Clock, KeyRound, Lock, Unlock, ExternalLink,
    CreditCard, Wifi, FileText, UserCircle, ShieldOff
} from 'lucide-react';
import CryptoJS from 'crypto-js';
import { fetchSharedItem } from '../lib/api';

// ── Helper: Decrypt using share key ───────────────────────────────────────
const decryptWithShareKey = (encryptedShareBlob, shareKey) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedShareBlob, shareKey);
        const text = bytes.toString(CryptoJS.enc.Utf8);
        if (!text) return null;
        return JSON.parse(text);
    } catch {
        return null;
    }
};

// ── Helper: Format expiry time ─────────────────────────────────────────────
const formatExpiry = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

// ── Copy button with feedback ──────────────────────────────────────────────
function CopyBtn({ text, label }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className={`p-2 rounded-xl transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'}`}
            title={`Copy ${label}`}
        >
            <AnimatePresence mode="wait" initial={false}>
                {copied
                    ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={15} /></motion.span>
                    : <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={15} /></motion.span>
                }
            </AnimatePresence>
        </button>
    );
}

// ── Item type icon mapping ─────────────────────────────────────────────────
const getTypeIcon = (type) => {
    switch (type) {
        case 'CREDIT_CARD': return <CreditCard size={20} className="text-purple-400" />;
        case 'IDENTITY':    return <UserCircle size={20} className="text-blue-400" />;
        case 'WIFI':        return <Wifi size={20} className="text-sky-400" />;
        case 'SECURE_NOTE': return <FileText size={20} className="text-orange-400" />;
        default:            return <KeyRound size={20} className="text-emerald-400" />;
    }
};

// ══════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════
export default function SharedView() {
    const { token } = useParams();

    // ── State ───────────────────────────────────────────────────────────
    const [phase, setPhase] = useState('loading'); // loading | pin_required | decrypting | success | error
    const [errorMsg, setErrorMsg] = useState('');
    const [requiresPin, setRequiresPin] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);
    const [itemLabel, setItemLabel] = useState('');
    const [expiresAt, setExpiresAt] = useState(null);
    const [decryptedItem, setDecryptedItem] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [shareKey, setShareKey] = useState(null);

    // ── Extract shareKey from URL hash on mount ────────────────────────
    // The hash (#key=XYZ) is NEVER sent to the server — browser-only
    useEffect(() => {
        const hash = window.location.hash; // e.g. "#key=abc123..."
        if (!hash || !hash.startsWith('#key=')) {
            setPhase('error');
            setErrorMsg('Invalid share link. The decryption key is missing from the URL. Make sure you copied the full link.');
            return;
        }
        const key = hash.slice(5); // Remove '#key='
        if (!key || key.length < 10) {
            setPhase('error');
            setErrorMsg('Invalid or corrupted decryption key in the URL.');
            return;
        }
        setShareKey(key);
    }, []);

    // ── Initial fetch (once shareKey is extracted) ─────────────────────
    useEffect(() => {
        if (!shareKey || !token) return;
        initialFetch();
    }, [shareKey, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const initialFetch = async () => {
        setPhase('loading');
        try {
            // Don't send PIN yet — just check if PIN is required
            const data = await fetchSharedItem(token, null);

            if (data.requiresPin) {
                // PIN is required — show PIN form
                setRequiresPin(true);
                setItemLabel(data.itemLabel || 'Shared Item');
                setExpiresAt(data.expiresAt);
                setPhase('pin_required');
            } else {
                // No PIN needed — decrypt immediately
                attemptDecrypt(data.encryptedShareBlob, data.itemLabel, data.expiresAt);
            }
        } catch (err) {
            setPhase('error');
            setErrorMsg(err.message || 'Failed to load shared item. The link may have expired or already been used.');
        }
    };

    // ── Handle PIN submission ──────────────────────────────────────────
    const handlePinSubmit = useCallback(async (e) => {
        e.preventDefault();
        const trimmedPin = pinInput.trim();

        if (!/^\d{4,8}$/.test(trimmedPin)) {
            setPinError('PIN must be 4-8 digits');
            return;
        }

        setPinLoading(true);
        setPinError('');

        try {
            const data = await fetchSharedItem(token, trimmedPin);
            attemptDecrypt(data.encryptedShareBlob, data.itemLabel, data.expiresAt);
        } catch (err) {
            setPinError(err.message || 'Incorrect PIN. Please try again.');
            setPinInput('');
        } finally {
            setPinLoading(false);
        }
    }, [pinInput, token]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Client-side decryption using shareKey ─────────────────────────
    const attemptDecrypt = (encryptedShareBlob, label, expiry) => {
        setPhase('decrypting');
        setItemLabel(label || 'Shared Item');
        setExpiresAt(expiry);

        // Small timeout for animation
        setTimeout(() => {
            const result = decryptWithShareKey(encryptedShareBlob, shareKey);
            if (!result) {
                setPhase('error');
                setErrorMsg('Decryption failed. The decryption key in the URL may be incorrect or the data is corrupted.');
                return;
            }
            setDecryptedItem(result);
            setPhase('success');
        }, 600);
    };

    // ── Render helpers ─────────────────────────────────────────────────
    const renderField = (label, value, isSecret = false) => {
        if (!value) return null;
        return (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">{label}</p>
                    <p className={`text-sm font-mono font-semibold text-white truncate transition-all duration-300 ${isSecret && !showPassword ? 'blur-[5px]' : ''}`}>
                        {value}
                    </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    {isSecret && (
                        <button
                            onClick={() => setShowPassword(p => !p)}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                            title={showPassword ? 'Hide' : 'Show'}
                        >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    )}
                    <CopyBtn text={value} label={label} />
                </div>
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0d0f1a] via-[#111827] to-[#0d0f1a] flex items-center justify-center p-4">
            <div className="w-full max-w-md">

                {/* ── Brand Header ───────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-3 mb-8"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Shield size={20} className="text-white" />
                    </div>
                    <div>
                        <span className="font-black text-xl tracking-tight text-white">Keeper<span className="text-violet-400">X</span></span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Secure Share</p>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">

                    {/* ── Loading ─────────────────────────────────────── */}
                    {(phase === 'loading' || phase === 'decrypting') && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center"
                        >
                            <div className="relative mx-auto w-16 h-16 mb-6">
                                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                                <div className="absolute inset-0 rounded-full border-t-2 border-violet-400 animate-spin" />
                                <div className="absolute inset-3 flex items-center justify-center">
                                    {phase === 'decrypting' ? <Unlock size={20} className="text-violet-400" /> : <Lock size={20} className="text-violet-400/50" />}
                                </div>
                            </div>
                            <p className="text-white/70 font-semibold">
                                {phase === 'decrypting' ? 'Decrypting securely…' : 'Verifying link…'}
                            </p>
                            <p className="text-white/30 text-xs mt-1">
                                {phase === 'decrypting' ? 'Decryption happens only in your browser' : 'Checking token validity'}
                            </p>
                        </motion.div>
                    )}

                    {/* ── PIN Required ────────────────────────────────── */}
                    {phase === 'pin_required' && (
                        <motion.div
                            key="pin"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8"
                        >
                            <div className="w-14 h-14 bg-violet-500/20 rounded-2xl flex items-center justify-center mb-5 mx-auto">
                                <Lock size={24} className="text-violet-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white text-center mb-1">PIN Protected</h2>
                            <p className="text-white/50 text-sm text-center mb-2">
                                <span className="font-bold text-white/70">{itemLabel}</span>
                            </p>
                            <p className="text-white/40 text-xs text-center mb-6">
                                Enter the PIN provided by the sender to unlock
                            </p>

                            <form onSubmit={handlePinSubmit} className="space-y-4">
                                <div>
                                    <input
                                        id="share-pin-input"
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={pinInput}
                                        onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8)); setPinError(''); }}
                                        placeholder="Enter 4-8 digit PIN"
                                        maxLength={8}
                                        autoFocus
                                        className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-white/20 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                    />
                                    {pinError && (
                                        <p className="text-red-400 text-xs text-center mt-2 font-semibold">{pinError}</p>
                                    )}
                                </div>
                                <motion.button
                                    type="submit"
                                    disabled={pinLoading || pinInput.length < 4}
                                    whileTap={{ scale: 0.97 }}
                                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                                >
                                    {pinLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Verifying…
                                        </>
                                    ) : (
                                        <><Unlock size={16} /> Unlock &amp; View</>
                                    )}
                                </motion.button>
                            </form>

                            {expiresAt && (
                                <p className="text-white/25 text-[10px] text-center mt-5 flex items-center justify-center gap-1.5">
                                    <Clock size={10} /> Expires {formatExpiry(expiresAt)}
                                </p>
                            )}
                        </motion.div>
                    )}

                    {/* ── Success — Show Decrypted Data ────────────────── */}
                    {phase === 'success' && decryptedItem && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            {/* Card */}
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                                {/* Item header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                                        {getTypeIcon(decryptedItem.itemType)}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold text-white truncate">{decryptedItem.appName || itemLabel}</h2>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                            Shared Credentials · One-Time View
                                        </p>
                                    </div>
                                </div>

                                {/* Fields */}
                                <div className="space-y-3">
                                    {renderField('Username / Email', decryptedItem.username)}
                                    {renderField('Password', decryptedItem.password, true)}
                                    {renderField('Website', decryptedItem.url)}
                                    {renderField('SSID', decryptedItem.ssid)}
                                    {renderField('Wi-Fi Password', decryptedItem.wifiPassword || (decryptedItem.itemType === 'WIFI' ? decryptedItem.password : null), true)}
                                    {renderField('Cardholder', decryptedItem.cardholder)}
                                    {renderField('Card Number', decryptedItem.cardNumber)}
                                    {renderField('Expiry', decryptedItem.expiry)}
                                    {renderField('CVV', decryptedItem.cvv, true)}
                                    {renderField('Full Name', decryptedItem.fullName)}
                                    {renderField('ID Number', decryptedItem.idNumber)}
                                    {decryptedItem.note && (
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Note</p>
                                            <p className="text-sm text-white/80 whitespace-pre-wrap">{decryptedItem.note}</p>
                                        </div>
                                    )}
                                </div>

                                {/* URL visit button */}
                                {decryptedItem.url && (
                                    <a
                                        href={decryptedItem.url.startsWith('h') ? decryptedItem.url : `https://${decryptedItem.url}`}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-bold text-violet-400 hover:text-violet-300 py-2.5 rounded-2xl border border-violet-400/20 hover:bg-violet-400/10 transition-all"
                                    >
                                        <ExternalLink size={14} /> Visit Website
                                    </a>
                                )}
                            </div>

                            {/* One-time warning */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl"
                            >
                                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-amber-300 font-bold text-xs">One-Time Access Only</p>
                                    <p className="text-amber-200/60 text-xs mt-0.5">
                                        This link has been permanently destroyed. Save the credentials now — they cannot be accessed again from this link.
                                    </p>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* ── Error ────────────────────────────────────────── */}
                    {phase === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-red-500/20 rounded-3xl p-10 text-center"
                        >
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5 mx-auto">
                                <ShieldOff size={28} className="text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Link Unavailable</h2>
                            <p className="text-white/50 text-sm leading-relaxed">{errorMsg}</p>
                            <div className="mt-6 text-white/20 text-xs border-t border-white/10 pt-4">
                                Links are one-time use only and expire after the set duration.
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>

                {/* ── Footer ─────────────────────────────────────────── */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center text-white/20 text-[10px] mt-6 font-medium"
                >
                    🔒 End-to-end encrypted · Decryption happens only in your browser · KeeperX never sees your data
                </motion.p>
            </div>
        </div>
    );
}
