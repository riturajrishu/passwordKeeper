import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, ShieldAlert, ShieldCheck, UserPlus, Users, Trash2,
    Clock, CheckCircle2, AlertTriangle, Copy, Check, RefreshCw,
    X, ChevronDown, Info, Lock, Loader2, AlertCircle, XCircle, Link2,
    KeyRound, Eye, EyeOff, Key
} from 'lucide-react';
import useToastStore from '../store/useToastStore';
import {
    addEmergencyContact, getEmergencyContacts,
    removeEmergencyContact, denyEmergencyAccess,
    uploadEncryptedMasterKey
} from '../lib/api';
import { encryptWithPublicKey } from '../lib/cryptoUtils';
import { deriveKeys } from '../lib/crypto';
import useAuthStore from '../store/useAuthStore';

// ── Status badges ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    pending_invite: { label: 'Awaiting Invite', color: 'amber', Icon: Clock },
    invite_accepted: { label: 'Active', color: 'green', Icon: ShieldCheck },
    access_requested: { label: 'Access Requested', color: 'red', Icon: AlertTriangle },
    access_granted: { label: 'Access Granted', color: 'purple', Icon: ShieldAlert },
    access_denied: { label: 'Request Denied', color: 'slate', Icon: XCircle },
    revoked: { label: 'Revoked', color: 'slate', Icon: X }
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_invite;
    const colorMap = {
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-300',
        green: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-300',
        red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-300',
        slate: 'bg-muted/50 border-border text-muted-foreground'
    };
    return (
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${colorMap[cfg.color]}`}>
            <cfg.Icon size={10} /> {cfg.label}
        </span>
    );
}

// ── Copy-to-clipboard button ──────────────────────────────────────────────
function CopyLinkBtn({ text }) {
    const [copied, setCopied] = useState(false);
    return (
        <button title="Copy invite link"
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${copied ? 'bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-300' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'}`}
        >
            {copied ? <><Check size={11} /> Copied!</> : <><Link2 size={11} /> Copy Link</>}
        </button>
    );
}

// ══════════════════════════════════════════════════════════════════════════
export default function EmergencyAccess() {
    const addToast = useToastStore(s => s.addToast);
    const { user, masterKey } = useAuthStore();

    const [contacts, setContacts] = useState([]);
    const [lastActiveAt, setLastActiveAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [removingId, setRemovingId] = useState(null);
    const [denyingId, setDenyingId] = useState(null);
    // Sharing key flow
    const [showShareModal, setShowShareModal] = useState(false);
    const [activeContact, setActiveContact] = useState(null);
    const [masterPass, setMasterPass] = useState('');
    const [shareError, setShareError] = useState('');
    const [showSharePass, setShowSharePass] = useState(false);

    // Form state
    const [form, setForm] = useState({ contactEmail: '', contactName: '', delayDays: 30 });
    const [formErrors, setFormErrors] = useState({});

    // ── Load contacts on mount ────────────────────────────────────────
    const loadContacts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getEmergencyContacts();
            setContacts(data.contacts || []);
            setLastActiveAt(data.lastActiveAt);
        } catch (err) {
            addToast(err.message || 'Failed to load emergency contacts', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { loadContacts(); }, [loadContacts]);

    // ── Form validation ───────────────────────────────────────────────
    const validateForm = () => {
        const errors = {};
        if (!form.contactEmail.trim()) errors.contactEmail = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) errors.contactEmail = 'Invalid email';
        if (!form.contactName.trim()) errors.contactName = 'Name is required';
        return errors;
    };

    // ── Add contact ───────────────────────────────────────────────────
    const handleAdd = async (e) => {
        e.preventDefault();
        const errors = validateForm();
        if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
        setFormErrors({});
        setSubmitting(true);
        try {
            const result = await addEmergencyContact(form.contactEmail.trim(), form.contactName.trim(), form.delayDays);
            addToast(`Emergency contact added! Share the invite link with ${form.contactName}.`, 'success');
            setForm({ contactEmail: '', contactName: '', delayDays: 30 });
            setShowAddForm(false);
            await loadContacts();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Remove contact ────────────────────────────────────────────────
    const handleRemove = async (id, name) => {
        if (!window.confirm(`Remove ${name} as emergency contact? This cannot be undone.`)) return;
        setRemovingId(id);
        try {
            await removeEmergencyContact(id);
            addToast(`${name} removed as emergency contact`, 'success');
            setContacts(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setRemovingId(null);
        }
    };

    // ── Deny access request ───────────────────────────────────────────
    const handleDeny = async (id, name) => {
        if (!window.confirm(`Deny emergency access request from ${name}?`)) return;
        setDenyingId(id);
        try {
            await denyEmergencyAccess(id);
            addToast(`Access request from ${name} denied`, 'success');
            await loadContacts();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setDenyingId(null);
        }
    };

    // ── Securely share master key ──────────────────────────────────────
    const handleShareKey = async (e) => {
        e.preventDefault();
        if (!masterPass || !activeContact) return;
        setSubmitting(true);
        setShareError('');
        try {
            // 0. LOCAL VALIDATION: Verify if this is the correct master password
            // We use the same derivation logic used during login/unlock
            if (user && masterKey) {
                const { encKey } = deriveKeys(masterPass, user.email);
                if (encKey !== masterKey) {
                    throw new Error('Incorrect Master Password. Please try again.');
                }
            }

            // 1. Encrypt the master password with contact's public key
            const encryptedBundle = await encryptWithPublicKey(masterPass, activeContact.contactPublicKey);

            // 2. Upload to server
            await uploadEncryptedMasterKey(activeContact.id, encryptedBundle);

            addToast(`Access key shared securely with ${activeContact.contactName}`, 'success');
            setShowShareModal(false);
            setMasterPass('');
            await loadContacts();
        } catch (err) {
            setShareError(err.message || 'Failed to share key');
        } finally {
            setSubmitting(false);
        }
    };

    // ══════════════════════════════════════════════════════════════════
    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

            {/* ── Header ────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500/80 to-amber-500/80 flex items-center justify-center">
                            <ShieldAlert size={16} className="text-white" />
                        </div>
                        <h1 className="text-xl font-black text-foreground">Emergency Access</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">Configure trusted contacts for your <em>Dead Man's Switch</em>. If you're inactive for a set period, they can request access to your vault.</p>
                </div>
                <button
                    id="emergency-refresh-btn"
                    onClick={loadContacts}
                    className="p-2 rounded-xl bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </motion.div>

            {/* ── Info Banner ───────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-3">
                <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-300">How Does This Work?</p>
                    <div className="text-[11px] text-blue-600/80 dark:text-blue-200/60 space-y-1">
                        <p>1. Add a trusted contact (family/colleague) → they receive an invite link.</p>
                        <p>2. After the set inactivity period, they can "request access".</p>
                        <p>3. You get a notification and have 24 hours to DENY. Otherwise, access is granted.</p>
                        <p>4. Zero-knowledge preserved — your master key never touches the server.</p>
                    </div>
                </div>
            </motion.div>

            {/* ── Activity Status ───────────────────────────────────── */}
            {lastActiveAt && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                    className="p-4 bg-muted/30 border border-border rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                        <CheckCircle2 size={15} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-foreground">Last Activity Recorded</p>
                        <p className="text-[11px] text-muted-foreground">
                            {new Date(lastActiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Inactivity clock reset on every login
                        </p>
                    </div>
                </motion.div>
            )}

            {/* ── Add Contact Button / Form ─────────────────────────── */}
            <AnimatePresence>
                {!showAddForm ? (
                    <motion.button
                        id="emergency-add-contact-btn"
                        key="addbtn"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowAddForm(true)}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 font-semibold text-sm transition-all"
                    >
                        <UserPlus size={15} /> Add Emergency Contact
                    </motion.button>
                ) : (
                    <motion.form
                        key="addform"
                        initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
                        onSubmit={handleAdd}
                        className="bg-card glass-panel border border-border rounded-3xl p-6 space-y-4"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-foreground text-sm">Add Emergency Contact</h3>
                            <button type="button" onClick={() => { setShowAddForm(false); setFormErrors({}); }}
                                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact Name *</label>
                                <input id="emergency-contact-name"
                                    type="text" placeholder="e.g. Rahul Sharma"
                                    value={form.contactName}
                                    onChange={e => { setForm(p => ({ ...p, contactName: e.target.value })); setFormErrors(p => ({ ...p, contactName: '' })); }}
                                    className={`w-full bg-muted/50 border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 transition-all ${formErrors.contactName ? 'border-destructive/60 focus:ring-destructive/20' : 'border-border focus:border-primary/60 focus:ring-primary/20'}`}
                                />
                                {formErrors.contactName && <p className="text-destructive text-[10px]">{formErrors.contactName}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact Email *</label>
                                <input id="emergency-contact-email"
                                    type="email" placeholder="e.g. rahul@gmail.com"
                                    value={form.contactEmail}
                                    onChange={e => { setForm(p => ({ ...p, contactEmail: e.target.value })); setFormErrors(p => ({ ...p, contactEmail: '' })); }}
                                    className={`w-full bg-muted/50 border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 transition-all ${formErrors.contactEmail ? 'border-destructive/60 focus:ring-destructive/20' : 'border-border focus:border-primary/60 focus:ring-primary/20'}`}
                                />
                                {formErrors.contactEmail && <p className="text-destructive text-[10px]">{formErrors.contactEmail}</p>}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inactivity Period</label>
                            <select id="emergency-delay-days"
                                value={form.delayDays}
                                onChange={e => setForm(p => ({ ...p, delayDays: Number(e.target.value) }))}
                                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                            >
                                <option value={7} className="bg-card">7 days — High urgency</option>
                                <option value={14} className="bg-card">14 days — Moderate</option>
                                <option value={30} className="bg-card">30 days — Standard</option>
                                <option value={60} className="bg-card">60 days — Extended</option>
                                <option value={90} className="bg-card">90 days — Maximum</option>
                            </select>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => { setShowAddForm(false); setFormErrors({}); }}
                                className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted transition-all">
                                Cancel
                            </button>
                            <motion.button type="submit" id="emergency-add-submit"
                                whileTap={{ scale: 0.97 }} disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                {submitting ? 'Adding…' : 'Add Contact'}
                            </motion.button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* ── Contact List ──────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="relative w-10 h-10">
                        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                        <div className="absolute inset-0 rounded-full border-t-2 border-violet-400 animate-spin" />
                    </div>
                </div>
            ) : contacts.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center py-16 space-y-3">
                    <div className="w-14 h-14 bg-muted border border-border rounded-2xl flex items-center justify-center mx-auto">
                        <Users size={24} className="text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground font-semibold text-sm">No emergency contacts yet</p>
                    <p className="text-muted-foreground/60 text-xs">Add a trusted person who can access your vault if needed</p>
                </motion.div>
            ) : (
                <div className="space-y-3">
                    {contacts.map((contact, i) => (
                        <motion.div key={contact.id}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="bg-card shadow-premium border border-border rounded-2xl p-5 space-y-3"
                        >
                            {/* Contact header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                                        {contact.contactName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground text-sm">{contact.contactName}</p>
                                        <p className="text-xs text-muted-foreground">{contact.contactEmail}</p>
                                    </div>
                                </div>
                                <StatusBadge status={contact.status} />
                            </div>

                            {/* Info row */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2.5 bg-muted/30 border border-border/50 rounded-xl">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Inactivity Period</p>
                                    <p className="text-xs font-bold text-foreground">{contact.delayDays} Days</p>
                                </div>
                                <div className="p-2.5 bg-muted/30 border border-border/50 rounded-xl">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                                        {contact.daysUntilEligible === 0 ? 'Eligible Since' : 'Days Until Eligible'}
                                    </p>
                                    <p className={`text-xs font-bold ${contact.daysUntilEligible === 0 ? 'text-destructive' : 'text-foreground'}`}>
                                        {contact.daysUntilEligible === 0 ? 'NOW' : `${contact.daysUntilEligible} days`}
                                    </p>
                                </div>
                            </div>

                            {/* Invite link for pending contacts */}
                            {contact.status === 'pending_invite' && contact.inviteLink && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-300">📨 Share this invite link with {contact.contactName}:</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-[10px] text-muted-foreground bg-muted/80 border border-border px-2 py-1.5 rounded-lg font-mono truncate">
                                            {contact.inviteLink}
                                        </code>
                                        <CopyLinkBtn text={contact.inviteLink} />
                                    </div>
                                    {contact.inviteExpiresAt && (
                                        <p className="text-[10px] text-muted-foreground/60">
                                            Expires: {new Date(contact.inviteExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 pt-1">
                                 {/* Share Key button — for accepted contacts without shared key */}
                                 {contact.status === 'invite_accepted' && !contact.hasSharedKey && (
                                     <motion.button
                                         id={`emergency-share-${contact.id}`}
                                         whileTap={{ scale: 0.97 }}
                                         onClick={() => { setActiveContact(contact); setShowShareModal(true); }}
                                         className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/10"
                                     >
                                         <Lock size={11} /> Securely Share Access
                                     </motion.button>
                                 )}

                                 {/* Deny button — only for access_requested status */}
                                {contact.status === 'access_requested' && (
                                    <motion.button
                                        id={`emergency-deny-${contact.id}`}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleDeny(contact.id, contact.contactName)}
                                        disabled={denyingId === contact.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold hover:bg-destructive/20 transition-all disabled:opacity-50"
                                    >
                                        {denyingId === contact.id ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                                        Deny Access
                                    </motion.button>
                                )}

                                {/* Remove contact */}
                                <button
                                    id={`emergency-remove-${contact.id}`}
                                    onClick={() => handleRemove(contact.id, contact.contactName)}
                                    disabled={removingId === contact.id}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 border border-border text-muted-foreground text-xs font-semibold hover:text-destructive hover:border-destructive/20 hover:bg-destructive/10 transition-all disabled:opacity-50"
                                    title="Remove contact"
                                >
                                    {removingId === contact.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                </button>
                            </div>

                            {/* Access requested warning */}
                            {contact.status === 'access_requested' && contact.accessApprovalDeadline && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                                    <p className="text-xs font-bold text-destructive">⚠️ Emergency Access Requested!</p>
                                    <p className="text-[11px] text-destructive/60 mt-0.5 font-medium">
                                        {contact.contactName} has requested vault access. Deny before {new Date(contact.accessApprovalDeadline).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} {new Date(contact.accessApprovalDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to block.
                                    </p>
                                </div>
                            )}

                            {/* Permanent Access Link for accepted contacts */}
                            {contact.status !== 'pending_invite' && contact.status !== 'revoked' && (
                                <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-xl">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Permanent Access Link</p>
                                        <code className="block text-[10px] text-muted-foreground bg-muted border border-border px-2 py-1.5 rounded-lg font-mono truncate">
                                            {`${window.location.origin}/emergency/view/${contact.id}`}
                                        </code>
                                    </div>
                                    <CopyLinkBtn text={`${window.location.origin}/emergency/view/${contact.id}`} />
                                </div>
                            )}

                            {/* Shared Key indicator */}
                            {contact.status === 'invite_accepted' && contact.hasSharedKey && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/5 border border-green-500/10 rounded-xl">
                                    <ShieldCheck size={12} className="text-green-600 dark:text-green-400" />
                                    <span className="text-[10px] font-bold text-green-600/70 dark:text-green-300/70 uppercase">Access Secured with RSA</span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ── Share Key Modal ────────────────────────────────────── */}
            <AnimatePresence>
                {showShareModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-premium space-y-5"
                        >
                            <div className="text-center">
                                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-primary/20">
                                    <KeyRound size={24} className="text-primary" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">Securely Share Access</h2>
                                <p className="text-muted-foreground text-xs mt-1">Shared with {activeContact?.contactName}</p>
                            </div>

                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-2">
                                <p className="text-xs font-bold text-primary flex items-center gap-1.5"><Shield size={12} /> How this protects you:</p>
                                <ul className="text-[10px] text-muted-foreground list-disc list-inside space-y-1">
                                    <li>Your master key is encrypted with their RSA public key.</li>
                                    <li>Only their local private key can ever decrypt it.</li>
                                    <li>The server NEVER sees your master key in plaintext.</li>
                                </ul>
                            </div>

                            <form onSubmit={handleShareKey} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Your Master Password</label>
                                    <div className="relative">
                                        <input
                                            type={showSharePass ? 'text' : 'password'}
                                            value={masterPass}
                                            onChange={e => setMasterPass(e.target.value)}
                                            placeholder="Enter password to encrypt access"
                                            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all pr-12"
                                            required
                                        />
                                        <button type="button" onClick={() => setShowSharePass(!showSharePass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                            {showSharePass ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {shareError && <p className="text-destructive text-[10px] font-bold text-center bg-destructive/10 py-2 rounded-lg">{shareError}</p>}

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowShareModal(false)} className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted transition-all">Cancel</button>
                                    <button type="submit" disabled={submitting || !masterPass} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                        Securely Share
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
