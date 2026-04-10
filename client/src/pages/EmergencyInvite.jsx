import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, ShieldCheck, Key, Lock, AlertTriangle,
    CheckCircle2, Loader2, UserCheck, Clock, Download,
    ShieldOff, ExternalLink, Check, Link2
} from 'lucide-react';
import { getInviteDetails, acceptEmergencyInvite } from '../lib/api';
import { generateRSAKeyPair, savePrivateKey } from '../lib/cryptoUtils';

// ── Copy-to-clipboard button ──────────────────────────────────────────────
function CopyLinkBtn({ text }) {
    const [copied, setCopied] = useState(false);
    return (
        <button title="Copy access link"
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${copied ? 'bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
        >
            {copied ? <><Check size={11} /> Copied!</> : <><Link2 size={11} /> Copy Link</>}
        </button>
    );
}

// ── Steps ─────────────────────────────────────────────────────────────────
const STEPS = {
    LOADING: 'loading',
    INVITE_INFO: 'invite_info',
    GENERATING_KEYS: 'generating_keys',
    SUCCESS: 'success',
    ERROR: 'error'
};

export default function EmergencyInvite() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [step, setStep] = useState(STEPS.LOADING);
    const [invite, setInvite] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [contactId, setContactId] = useState(null);
    const [privateKeyB64, setPrivateKeyB64] = useState(null);
    const [keySaved, setKeySaved] = useState(false);

    // ── Validate token format, then fetch invite info ─────────────────
    useEffect(() => {
        if (!token || !/^[a-f0-9]{64}$/.test(token)) {
            setStep(STEPS.ERROR);
            setErrorMsg('Invalid invite link format.');
            return;
        }
        fetchInvite();
    }, [token]); // eslint-disable-line

    const fetchInvite = async () => {
        setStep(STEPS.LOADING);
        try {
            const data = await getInviteDetails(token);
            setInvite(data);
            setStep(STEPS.INVITE_INFO);
        } catch (err) {
            setStep(STEPS.ERROR);
            setErrorMsg(err.message);
        }
    };

    // ── Accept invite: generate key pair in browser ────────────────────
    const handleAccept = async () => {
        setStep(STEPS.GENERATING_KEYS);
        try {
            // 1. Generate RSA-OAEP key pair entirely in browser
            const { publicKeyB64, privateKeyB64: privKey } = await generateRSAKeyPair();

            // 2. Send only the public key to server
            const response = await acceptEmergencyInvite(token, publicKeyB64);
            const cId = response.contactId;

            // 3. Save private key to localStorage (scoped by contactId)
            savePrivateKey(cId, privKey);

            setContactId(cId);
            setPrivateKeyB64(privKey);
            setKeySaved(true);
            setStep(STEPS.SUCCESS);
        } catch (err) {
            setStep(STEPS.ERROR);
            setErrorMsg(err.message);
        }
    };

    // ── Download private key as a text file backup ─────────────────────
    const handleDownloadKey = () => {
        if (!privateKeyB64) return;
        const blob = new Blob([
            `KeeperX Emergency Access — Private Key Backup\n`,
            `Contact ID: ${contactId}\n`,
            `Generated: ${new Date().toISOString()}\n\n`,
            `KEEP THIS FILE SAFE AND PRIVATE.\n`,
            `You will need this key to decrypt the vault.\n\n`,
            `PRIVATE KEY (Base64 RSA-OAEP PKCS8):\n`,
            privateKeyB64
        ], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keeperx-emergency-key-${contactId?.slice(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ══════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0d0f1a] via-[#111827] to-[#0d0f1a] flex items-center justify-center p-4">
            <div className="w-full max-w-lg">

                {/* Brand */}
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
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Emergency Access</p>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">

                    {/* ── Loading ────────────────────────────────────── */}
                    {step === STEPS.LOADING && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center">
                            <div className="relative mx-auto w-16 h-16 mb-6">
                                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                                <div className="absolute inset-0 rounded-full border-t-2 border-violet-400 animate-spin" />
                            </div>
                            <p className="text-white/60 font-semibold">Verifying invite link…</p>
                        </motion.div>
                    )}

                    {/* ── Invite Info ────────────────────────────────── */}
                    {step === STEPS.INVITE_INFO && invite && (
                        <motion.div key="info" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">

                            <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-white/10 px-8 py-6">
                                <div className="w-14 h-14 bg-violet-500/20 rounded-2xl flex items-center justify-center mb-4 border border-violet-400/20">
                                    <UserCheck size={24} className="text-violet-400" />
                                </div>
                                <h1 className="text-2xl font-black text-white">You're Invited!</h1>
                                <p className="text-white/60 mt-1 text-sm">
                                    <span className="font-bold text-white">{invite.ownerName}</span> has added you as their emergency vault contact
                                </p>
                            </div>

                            <div className="p-4 sm:p-8 space-y-5">
                                {/* Info cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Your Role</p>
                                        <p className="text-sm font-bold text-white">Emergency Contact</p>
                                        <p className="text-xs text-white/40 mt-0.5">for {invite.ownerName}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Inactivity Period</p>
                                        <p className="text-sm font-bold text-white">{invite.delayDays} Days</p>
                                        <p className="text-xs text-white/40 mt-0.5">before you can request</p>
                                    </div>
                                </div>

                                {/* How it works */}
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">How It Works</p>
                                    {[
                                        { icon: <Key size={13} />, text: `Your browser will generate a secure key pair — your private key never leaves this device` },
                                        { icon: <Clock size={13} />, text: `If ${invite.ownerName} is inactive for ${invite.delayDays} days, you can request access` },
                                        { icon: <Shield size={13} />, text: `They have 24 hours to deny — after that, you can view their encrypted vault` }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 text-xs text-white/60">
                                            <span className="text-violet-400 mt-0.5 shrink-0">{item.icon}</span>
                                            <span>{item.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Invite expires */}
                                <p className="text-white/30 text-xs flex items-center gap-1.5">
                                    <Clock size={10} />
                                    Invite expires: {new Date(invite.inviteExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>

                                <motion.button
                                    id="emergency-accept-invite"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleAccept}
                                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                                >
                                    <ShieldCheck size={16} /> Accept & Generate Keys
                                </motion.button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Generating Keys ────────────────────────────── */}
                    {step === STEPS.GENERATING_KEYS && (
                        <motion.div key="generating" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center">
                            <div className="relative mx-auto w-16 h-16 mb-6">
                                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                                <div className="absolute inset-0 rounded-full border-t-2 border-violet-400 animate-spin" />
                                <div className="absolute inset-4 flex items-center justify-center">
                                    <Key size={20} className="text-violet-400" />
                                </div>
                            </div>
                            <p className="text-white font-bold mb-1">Generating Secure Keys…</p>
                            <p className="text-white/40 text-xs">RSA-OAEP 2048-bit encryption • Runs entirely in your browser</p>
                        </motion.div>
                    )}

                    {/* ── Success ────────────────────────────────────── */}
                    {step === STEPS.SUCCESS && (
                        <motion.div key="success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="space-y-4">

                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
                                <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-white/10 px-8 py-6 text-center">
                                    <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mb-3 mx-auto border border-green-400/20">
                                        <CheckCircle2 size={24} className="text-green-400" />
                                    </div>
                                    <h2 className="text-xl font-black text-white">You're All Set!</h2>
                                    <p className="text-white/50 text-sm mt-1">Emergency access has been configured</p>
                                </div>
                                <div className="p-4 sm:p-8 space-y-4">
                                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-xs text-green-200/70 space-y-1.5">
                                        <p className="font-bold text-green-300">✅ Your keys have been saved to this browser</p>
                                        <p>To access the vault from a different device, download the private key backup below.</p>
                                    </div>

                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                        <p className="text-amber-300 font-bold text-xs mb-1">⚠️ Important: Save Your Private Key</p>
                                        <p className="text-amber-200/60 text-xs">The private key is only stored in this browser. If you clear browser data, you'll need the backup file to access the vault.</p>
                                    </div>

                                    <button
                                        id="emergency-download-key"
                                        onClick={handleDownloadKey}
                                        className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-2xl border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <Download size={14} /> Download Private Key Backup
                                    </button>

                                    {contactId && (
                                        <div className="space-y-3">
                                            <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-violet-300">🔗 Permanent Access Link</p>
                                                    <CopyLinkBtn text={`${window.location.origin}/emergency/view/${contactId}`} />
                                                </div>
                                                <code className="block text-[10px] text-white/40 bg-white/5 border border-white/10 px-3 py-2 rounded-xl font-mono break-all">
                                                    {`${window.location.origin}/emergency/view/${contactId}`}
                                                </code>
                                                <p className="text-[10px] text-violet-300/60 font-medium">
                                                    📌 <strong>Bookmark this link!</strong> You will need it to request access in the future.
                                                </p>
                                            </div>

                                            <button
                                                id="emergency-view-access"
                                                onClick={() => navigate(`/emergency/view/${contactId}`)}
                                                className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:opacity-90 transition-all font-bold"
                                            >
                                                <ExternalLink size={14} /> View Access Status Now
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Error ──────────────────────────────────────── */}
                    {step === STEPS.ERROR && (
                        <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-red-500/20 rounded-3xl p-10 text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5 mx-auto">
                                <ShieldOff size={28} className="text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Invite Unavailable</h2>
                            <p className="text-white/50 text-sm">{errorMsg}</p>
                        </motion.div>
                    )}

                </AnimatePresence>

                <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="text-center text-white/20 text-[10px] mt-6"
                >
                    🔒 Zero-knowledge encryption · Your private key never leaves this browser · KeeperX
                </motion.p>
            </div>
        </div>
    );
}
