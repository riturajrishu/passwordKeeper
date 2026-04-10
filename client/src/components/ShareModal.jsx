import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Share2, Link, Copy, Check, Clock, Lock,
    Shield, Trash2, Loader2, AlertTriangle, ExternalLink,
    ChevronDown, Eye, EyeOff, RefreshCw, ShieldCheck
} from 'lucide-react';
import CryptoJS from 'crypto-js';
import { createShareLink, getMyShareLinks, revokeShareLink } from '../lib/api';
import useToastStore from '../store/useToastStore';

// ── Constants ────────────────────────────────────────────────────────────
const EXPIRY_OPTIONS = [
    { label: '1 Hour',  value: 1  },
    { label: '6 Hours', value: 6  },
    { label: '1 Day',   value: 24 },
    { label: '7 Days',  value: 168 },
];

// ── Helper: Generate random shareKey (32 random bytes as hex) ────────────
// This key NEVER leaves the browser — it travels only in URL hash (#key=...)
const generateShareKey = () => CryptoJS.lib.WordArray.random(32).toString();

// ── Helper: Encrypt item payload with shareKey ────────────────────────────
const encryptForSharing = (itemData, shareKey) => {
    try {
        // Only share relevant fields — strip internal metadata
        const payload = {
            appName: itemData.appName,
            username: itemData.username,
            password: itemData.password,
            url: itemData.url,
            note: itemData.note,
            ssid: itemData.ssid,
            cardholder: itemData.cardholder,
            cardNumber: itemData.cardNumber,
            expiry: itemData.expiry,
            cvv: itemData.cvv,
            fullName: itemData.fullName,
            idNumber: itemData.idNumber,
            dob: itemData.dob,
            itemType: itemData.itemType || 'LOGIN',
        };
        // Remove undefined fields to keep blob clean
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        return CryptoJS.AES.encrypt(JSON.stringify(payload), shareKey).toString();
    } catch {
        return null;
    }
};

// ── Helper: Format relative time remaining ────────────────────────────────
const timeUntil = (dateStr) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

// ── Copy-with-feedback ────────────────────────────────────────────────────
function CopyLinkBtn({ link }) {
    const [copied, setCopied] = useState(false);
    const addToast = useToastStore(s => s.addToast);
    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        addToast('Secure link copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2500);
    };
    return (
        <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                copied
                    ? 'bg-green-500 text-white shadow-green-500/20'
                    : 'bg-primary text-primary-foreground shadow-primary/20 hover:opacity-90'
            }`}
        >
            <AnimatePresence mode="wait" initial={false}>
                {copied
                    ? <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-1.5"><Check size={14} /> Copied!</motion.span>
                    : <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-1.5"><Copy size={14} /> Copy Link</motion.span>
                }
            </AnimatePresence>
        </motion.button>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// Main ShareModal Component
// ══════════════════════════════════════════════════════════════════════════
export default function ShareModal({ isOpen, onClose, item }) {
    const addToast = useToastStore(s => s.addToast);

    // ── Tab state ─────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('create'); // 'create' | 'links'

    // ── Create-link form state ─────────────────────────────────────────
    const [expiresInHours, setExpiresInHours] = useState(24);
    const [enablePin, setEnablePin] = useState(false);
    const [pin, setPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [generatedLink, setGeneratedLink] = useState(null); // Full link with hash

    // ── My links state ────────────────────────────────────────────────
    const [myLinks, setMyLinks] = useState([]);
    const [linksLoading, setLinksLoading] = useState(false);
    const [revokingToken, setRevokingToken] = useState(null);

    // ── Reset state when modal opens/closes ───────────────────────────
    useEffect(() => {
        if (isOpen) {
            setActiveTab('create');
            setExpiresInHours(24);
            setEnablePin(false);
            setPin('');
            setShowPin(false);
            setGeneratedLink(null);
            setIsCreating(false);
        }
    }, [isOpen]);

    // ── Load active links when tab switches to 'links' ────────────────
    useEffect(() => {
        if (activeTab === 'links' && isOpen) {
            loadMyLinks();
        }
    }, [activeTab, isOpen]);

    const loadMyLinks = async () => {
        setLinksLoading(true);
        try {
            const data = await getMyShareLinks();
            setMyLinks(data);
        } catch {
            addToast('Failed to load active links', 'error');
        } finally {
            setLinksLoading(false);
        }
    };

    // ── Create share link handler ─────────────────────────────────────
    const handleCreate = useCallback(async () => {
        if (!item) return;

        // Validate PIN if enabled
        if (enablePin) {
            const trimmed = pin.trim();
            if (!/^\d{4,8}$/.test(trimmed)) {
                addToast('PIN must be 4-8 digits', 'error');
                return;
            }
        }

        setIsCreating(true);
        try {
            // 1. Generate a random share key (never sent to server)
            const shareKey = generateShareKey();

            // 2. Encrypt the item payload with the share key
            const encryptedShareBlob = encryptForSharing(item, shareKey);
            if (!encryptedShareBlob) {
                throw new Error('Encryption failed. Please try again.');
            }

            // 3. Send encrypted blob to server — get back a token
            const response = await createShareLink(
                encryptedShareBlob,
                enablePin ? pin.trim() : null,
                expiresInHours,
                item.appName || 'Shared Item'
            );

            // 4. Build full share link — shareKey goes in URL hash ONLY
            //    The hash (#) is NEVER sent to the server by browsers
            const origin = window.location.origin;
            const fullLink = `${origin}/share/${response.token}#key=${shareKey}`;
            setGeneratedLink(fullLink);

            addToast('Secure share link created!', 'success');
        } catch (err) {
            addToast(err.message || 'Failed to create share link', 'error');
        } finally {
            setIsCreating(false);
        }
    }, [item, enablePin, pin, expiresInHours, addToast]);

    // ── Revoke a link ─────────────────────────────────────────────────
    const handleRevoke = async (token) => {
        setRevokingToken(token);
        try {
            await revokeShareLink(token);
            setMyLinks(prev => prev.filter(l => l.token !== token));
            addToast('Share link revoked', 'success');
        } catch (err) {
            addToast(err.message || 'Failed to revoke link', 'error');
        } finally {
            setRevokingToken(null);
        }
    };

    // ── Close on Escape key ───────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // ══════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════
    return ReactDOM.createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="share-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        key="share-modal"
                        initial={{ opacity: 0, scale: 0.94, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 20 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none"
                    >
                        <div
                            className="glass-panel border border-border rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-none"
                            onClick={e => e.stopPropagation()}
                        >
                             {/* ── Modal Header ─────────────────────── */}
                            <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 sm:pt-6 pb-2.5 sm:pb-4 border-b border-border/50">
                                <div className="flex items-center gap-2.5 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                                        <Share2 size={13} className="sm:size-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="font-bold text-[13px] sm:text-base truncate">Secure Share</h2>
                                        <p className="text-[8px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate max-w-[120px] sm:max-w-none">
                                            {item?.appName || 'Vault Item'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    id="share-modal-close"
                                    onClick={onClose}
                                    className="p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <X size={16} className="sm:size-[18px]" />
                                </button>
                            </div>

                            {/* ── Tabs ─────────────────────────────── */}
                            <div className="flex border-b border-border/50 px-4 sm:px-6">
                                {[
                                    { id: 'create', label: 'Create Link' },
                                    { id: 'links',  label: 'Active Links' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        id={`share-tab-${tab.id}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                                            activeTab === tab.id
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* ── Tab Content ──────────────────────── */}
                            <AnimatePresence mode="wait">

                                {/* ─ CREATE TAB ────────────────────── */}
                                {activeTab === 'create' && (
                                    <motion.div
                                        key="create-tab"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto"
                                    >
                                        {!generatedLink ? (
                                            <>
                                                {/* Zero-knowledge notice */}
                                                <div className="flex items-start gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-2xl text-xs">
                                                    <ShieldCheck size={14} className="text-primary shrink-0 mt-0.5" />
                                                    <p className="text-muted-foreground leading-relaxed">
                                                        <span className="font-bold text-foreground">Zero-Knowledge sharing.</span> The decryption key travels only in the URL — KeeperX server never sees it.
                                                    </p>
                                                </div>

                                                {/* Expiry selector */}
                                                <div>
                                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                                        <Clock size={11} /> Expires After
                                                    </label>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {EXPIRY_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                id={`share-expiry-${opt.value}`}
                                                                onClick={() => setExpiresInHours(opt.value)}
                                                                className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                                                    expiresInHours === opt.value
                                                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                                                                        : 'bg-black/5 dark:bg-white/5 border-border text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* PIN toggle */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                                            <Lock size={11} /> PIN Protection
                                                        </label>
                                                        <button
                                                            id="share-pin-toggle"
                                                            onClick={() => { setEnablePin(p => !p); setPin(''); }}
                                                            className={`w-11 h-6 rounded-full border transition-all relative ${
                                                                enablePin
                                                                    ? 'bg-primary border-primary'
                                                                    : 'bg-black/10 dark:bg-white/10 border-border'
                                                            }`}
                                                        >
                                                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enablePin ? 'left-[22px]' : 'left-0.5'}`} />
                                                        </button>
                                                    </div>
                                                    <AnimatePresence>
                                                        {enablePin && (
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="relative">
                                                                    <input
                                                                        id="share-pin-input"
                                                                        type={showPin ? 'text' : 'password'}
                                                                        inputMode="numeric"
                                                                        value={pin}
                                                                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                                                        placeholder="Enter 4–8 digit PIN"
                                                                        className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all pr-10"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowPin(p => !p)}
                                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                                    >
                                                                        {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {/* Generate button */}
                                                <motion.button
                                                    id="share-generate-btn"
                                                    whileTap={{ scale: 0.97 }}
                                                    onClick={handleCreate}
                                                    disabled={isCreating || (enablePin && pin.length < 4)}
                                                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                                                >
                                                    {isCreating
                                                        ? <><Loader2 size={16} className="animate-spin" /> Generating…</>
                                                        : <><Link size={16} /> Generate Secure Link</>
                                                    }
                                                </motion.button>
                                            </>
                                        ) : (
                                            /* ─ SUCCESS: Link Generated ─ */
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-4"
                                            >
                                                {/* Success badge */}
                                                <div className="flex items-center gap-2 justify-center py-2">
                                                    <div className="w-8 h-8 bg-green-500/10 rounded-xl flex items-center justify-center">
                                                        <Shield size={16} className="text-green-500" />
                                                    </div>
                                                    <span className="font-bold text-green-500 text-sm">Secure link ready!</span>
                                                </div>

                                                {/* Link display */}
                                                <div className="p-3.5 bg-black/5 dark:bg-white/5 border border-border/50 rounded-2xl">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Your Secure Link</p>
                                                    <p className="text-[11px] sm:text-xs font-mono text-muted-foreground break-all leading-relaxed line-clamp-3 mb-4">
                                                        {generatedLink}
                                                    </p>
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <div className="flex-1">
                                                            <CopyLinkBtn link={generatedLink} />
                                                        </div>
                                                        <a
                                                            href={generatedLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                                                        >
                                                            <ExternalLink size={12} /> Preview Link
                                                        </a>
                                                    </div>
                                                </div>

                                                {/* Warnings */}
                                                <div className="space-y-2">
                                                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs">
                                                        <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                                        <p className="text-muted-foreground">
                                                            <span className="font-bold text-foreground">One-time use only.</span> The link self-destructs after first access.
                                                        </p>
                                                    </div>
                                                    {enablePin && (
                                                        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs">
                                                            <Lock size={12} className="text-primary shrink-0 mt-0.5" />
                                                            <p className="text-muted-foreground">
                                                                <span className="font-bold text-foreground">PIN protected.</span> Share your PIN <span className="italic">separately</span> (e.g., via call) — not in the same message as the link.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Create another */}
                                                <button
                                                    id="share-create-another"
                                                    onClick={() => { setGeneratedLink(null); setPin(''); setEnablePin(false); }}
                                                    className="w-full flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground py-2 transition-colors"
                                                >
                                                    <RefreshCw size={13} /> Create Another Link
                                                </button>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}

                                {/* ─ ACTIVE LINKS TAB ──────────────── */}
                                {activeTab === 'links' && (
                                    <motion.div
                                        key="links-tab"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="p-6"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                                All Active Share Links
                                            </p>
                                            <button
                                                id="share-links-refresh"
                                                onClick={loadMyLinks}
                                                disabled={linksLoading}
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                title="Refresh"
                                            >
                                                <RefreshCw size={13} className={linksLoading ? 'animate-spin' : ''} />
                                            </button>
                                        </div>

                                        {linksLoading ? (
                                            <div className="flex items-center justify-center py-10">
                                                <Loader2 size={20} className="animate-spin text-primary" />
                                            </div>
                                        ) : myLinks.length === 0 ? (
                                            <div className="text-center py-10">
                                                <Share2 size={28} className="mx-auto text-muted-foreground/40 mb-3" />
                                                <p className="text-sm font-bold text-muted-foreground">No active share links</p>
                                                <p className="text-xs text-muted-foreground/60 mt-1">Links you create will appear here</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                {myLinks.map(link => (
                                                    <motion.div
                                                        key={link.token}
                                                        layout
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, x: -10 }}
                                                        className={`p-3.5 rounded-2xl border transition-all ${
                                                            link.isUsed
                                                                ? 'bg-black/5 dark:bg-white/5 border-border/30 opacity-50'
                                                                : 'bg-primary/5 border-primary/20'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <p className="text-sm font-bold truncate">{link.itemLabel}</p>
                                                                    {link.hasPinProtection && (
                                                                        <span className="shrink-0 flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                                            <Lock size={7} /> PIN
                                                                        </span>
                                                                    )}
                                                                    {link.isUsed && (
                                                                        <span className="shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                                                                            Used
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                                    <Clock size={9} />
                                                                    <span>Expires in {timeUntil(link.expiresAt)}</span>
                                                                    {link.accessLog?.accessedAt && (
                                                                        <span className="text-green-500 font-bold">· Accessed</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                id={`share-revoke-${link.token?.slice(0, 8)}`}
                                                                onClick={() => handleRevoke(link.token)}
                                                                disabled={revokingToken === link.token}
                                                                className="shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                                                title="Revoke link"
                                                            >
                                                                {revokingToken === link.token
                                                                    ? <Loader2 size={13} className="animate-spin" />
                                                                    : <Trash2 size={13} />
                                                                }
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
