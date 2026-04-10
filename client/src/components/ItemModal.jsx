import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wand2, Eye, EyeOff, Copy, MailPlus, Tag, Plus } from 'lucide-react';
import clsx from 'clsx';
import useToastStore from '../store/useToastStore';
import PasswordGenerator from './PasswordGenerator';
import PasswordStrength from './PasswordStrength';

const CATEGORIES = ['Uncategorized', 'Personal', 'Work', 'Banking', 'Social', 'Gaming'];
const ITEM_TYPES = [
    { id: 'LOGIN',       label: 'Login' },
    { id: 'CREDIT_CARD', label: 'Credit Card' },
    { id: 'IDENTITY',    label: 'Identity' },
    { id: 'WIFI',        label: 'Wi-Fi' },
    { id: 'SECURE_NOTE', label: 'Secure Note' }
];

const POPULAR_SERVICES = {
    'facebook': 'https://facebook.com',
    'instagram': 'https://instagram.com',
    'twitter': 'https://twitter.com',
    'x': 'https://x.com',
    'google': 'https://google.com',
    'gmail': 'https://mail.google.com',
    'linkedin': 'https://linkedin.com',
    'github': 'https://github.com',
    'netflix': 'https://netflix.com',
    'amazon': 'https://amazon.com',
    'apple': 'https://apple.com',
    'microsoft': 'https://microsoft.com',
    'spotify': 'https://spotify.com',
    'discord': 'https://discord.com',
    'slack': 'https://slack.com',
    'reddit': 'https://reddit.com',
    'youtube': 'https://youtube.com',
    'twitch': 'https://twitch.tv',
    'pinterest': 'https://pinterest.com',
    'snapchat': 'https://snapchat.com',
    'tiktok': 'https://tiktok.com',
    'paypal': 'https://paypal.com',
    'dropbox': 'https://dropbox.com',
    'salesforce': 'https://salesforce.com',
    'notion': 'https://notion.so',
    'figma': 'https://figma.com',
    'canva': 'https://canva.com',
    'zoom': 'https://zoom.us',
    'atlassian': 'https://atlassian.com',
    'jira': 'https://atlassian.net',
    'trello': 'https://trello.com',
    'yahoo': 'https://yahoo.com',
    'outlook': 'https://outlook.com',
    'epic games': 'https://epicgames.com',
    'steam': 'https://store.steampowered.com',
    'chatgpt': 'https://chatgpt.com',
    'openai': 'https://openai.com'
};

const inputCls = 'w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all';

export default function ItemModal({ isOpen, onClose, onSave, editingItem }) {
    const [itemType,  setItemType]  = useState('LOGIN');
    const [appName,   setAppName]   = useState('');
    const [category,  setCategory]  = useState('Uncategorized');
    const [tags,      setTags]      = useState([]);
    const [tagInput,  setTagInput]  = useState('');
    const [suggestedUrl, setSuggestedUrl] = useState('');

    // Login
    const [username,    setUsername]    = useState('');
    const [password,    setPassword]    = useState('');
    const [url,         setUrl]         = useState('');
    const [totpSecret,  setTotpSecret]  = useState('');

    // Credit Card
    const [cardholder,  setCardholder]  = useState('');
    const [cardNumber,  setCardNumber]  = useState('');
    const [expiry,      setExpiry]      = useState('');
    const [cvv,         setCvv]         = useState('');
    const [pin,         setPin]         = useState('');

    // Identity
    const [idNumber,    setIdNumber]    = useState('');
    const [fullName,    setFullName]    = useState('');
    const [dob,         setDob]         = useState('');
    const [expiryDate,  setExpiryDate]  = useState('');

    // Wifi
    const [ssid, setSsid] = useState('');

    // Note
    const [note, setNote] = useState('');


    const [showPassword,      setShowPassword]      = useState(false);
    const [isGeneratorOpen,   setIsGeneratorOpen]   = useState(false);
    const [visibleHistoryIdx, setVisibleHistoryIdx] = useState(new Set());
    const addToast = useToastStore(s => s.addToast);
    const tagInputRef = useRef(null);

    // URL Auto-Suggest
    useEffect(() => {
        if (itemType === 'LOGIN' && appName && !url) {
            const normalized = appName.trim().toLowerCase();
            if (POPULAR_SERVICES[normalized]) {
                setSuggestedUrl(POPULAR_SERVICES[normalized]);
            } else if (normalized.length > 2 && !normalized.includes(' ')) {
                setSuggestedUrl(`https://${normalized}.com`);
            } else {
                setSuggestedUrl('');
            }
        } else {
            setSuggestedUrl('');
        }
    }, [appName, url, itemType]);

    // Scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            if (editingItem) {
                setItemType(editingItem.itemType || 'LOGIN');
                setAppName(editingItem.appName || '');
                setCategory(editingItem.category || 'Uncategorized');
                setTags(editingItem.tags || []);

                setUsername(editingItem.username || '');
                setPassword(editingItem.password || '');
                setUrl(editingItem.url || '');
                setTotpSecret(editingItem.totpSecret || '');

                setCardholder(editingItem.cardholder || '');
                setCardNumber(editingItem.cardNumber || '');
                setExpiry(editingItem.expiry || '');
                setCvv(editingItem.cvv || '');
                setPin(editingItem.pin || '');

                setIdNumber(editingItem.idNumber || '');
                setFullName(editingItem.fullName || '');
                setDob(editingItem.dob || '');
                setExpiryDate(editingItem.expiryDate || '');

                setSsid(editingItem.ssid || '');
                setNote(editingItem.note || '');
            } else {
                setItemType('LOGIN');
                setAppName(''); setCategory('Uncategorized'); setTags([]);
                setUsername(''); setPassword(''); setUrl(''); setTotpSecret('');
                setCardholder(''); setCardNumber(''); setExpiry(''); setCvv(''); setPin('');
                setIdNumber(''); setFullName(''); setDob(''); setExpiryDate('');
                setSsid(''); setNote('');
            }
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, editingItem]);

    // Tags helpers
    const addTag = () => {
        const t = tagInput.trim().toLowerCase();
        if (t && !tags.includes(t) && tags.length < 5) {
            setTags(prev => [...prev, t]);
            setTagInput('');
            tagInputRef.current?.focus();
        }
    };
    const removeTag = (t) => setTags(prev => prev.filter(x => x !== t));
    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addTag(); }
        if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const basePayload = { appName, category, itemType, tags };
        let specificPayload = {};
        switch (itemType) {
            case 'LOGIN':        specificPayload = { username, password, url, totpSecret }; break;
            case 'CREDIT_CARD':  specificPayload = { cardholder, cardNumber, expiry, cvv, pin }; break;
            case 'IDENTITY':     specificPayload = { idNumber, fullName, dob, expiryDate }; break;
            case 'WIFI':         specificPayload = { ssid, password }; break;
            case 'SECURE_NOTE':  specificPayload = { note }; break;
        }
        onSave({ ...basePayload, ...specificPayload }, editingItem);
    };



    const handleExpiryChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
        setExpiry(val);
    };

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        addToast(`${label} copied!`, 'success');
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-panel border border-border w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
            >
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">

                    {/* ── Header ─────────────────────────────────── */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                        <h2 className="text-lg sm:text-xl font-bold">
                            {editingItem ? 'Edit Vault Item' : 'New Vault Item'}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* ── Scrollable Body ─────────────────────────── */}
                    <div className="overflow-y-auto custom-scrollbar flex-1 px-5 py-5 space-y-5">

                        {/* Type selector (create only) */}
                        {!editingItem && (
                            <div className="flex gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-xl overflow-x-auto no-scrollbar">
                                {ITEM_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setItemType(type.id)}
                                        className={clsx(
                                            'flex-1 px-2.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
                                            itemType === type.id
                                                ? 'bg-background shadow-sm text-primary'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* App Name + Category */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                                    {itemType === 'WIFI' ? 'Network Alias' : itemType === 'SECURE_NOTE' ? 'Title' : 'App / Item Name'}
                                </label>
                                <input
                                    required
                                    value={appName}
                                    onChange={e => setAppName(e.target.value)}
                                    className={inputCls}
                                    placeholder={itemType === 'CREDIT_CARD' ? 'e.g. Chase Sapphire' : ''}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Category</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className={inputCls}
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c} className="bg-background text-foreground">{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Tags Input */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Tag size={11} /> Tags
                                <span className="opacity-50 font-normal normal-case tracking-normal">({tags.length}/5)</span>
                            </label>
                            <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-muted/50 border border-border min-h-[46px] focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/60 transition-all">
                                {tags.map(tag => (
                                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-xl text-xs font-bold border border-primary/20">
                                        {tag}
                                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-primary/60 transition-colors leading-none">×</button>
                                    </span>
                                ))}
                                <input
                                    ref={tagInputRef}
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder={tags.length < 5 ? 'Add tag...' : 'Max 5 tags'}
                                    disabled={tags.length >= 5}
                                    className="bg-transparent flex-1 min-w-[120px] text-xs outline-none text-foreground placeholder:text-muted-foreground/30"
                                />
                                {tagInput && (
                                    <button type="button" onClick={addTag} className="text-primary hover:text-primary/80">
                                        <Plus size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── LOGIN Fields ─── */}
                        {itemType === 'LOGIN' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Website URL</label>
                                    <input 
                                        value={url} 
                                        onChange={e => setUrl(e.target.value)} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab' && suggestedUrl) {
                                                e.preventDefault();
                                                setUrl(suggestedUrl);
                                                setSuggestedUrl('');
                                            }
                                        }}
                                        className={inputCls} 
                                        placeholder="https://example.com" 
                                    />
                                    <AnimatePresence>
                                        {suggestedUrl && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => { setUrl(suggestedUrl); setSuggestedUrl(''); }}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[11px] font-bold transition-colors w-max"
                                                >
                                                    <span>✨ Suggested: {suggestedUrl}</span>
                                                    <span className="opacity-60 font-normal">(Press Tab or Click)</span>
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Username / Email</label>
                                        <div className="relative">
                                            <input required value={username} onChange={e => setUsername(e.target.value)} className={clsx(inputCls, 'pr-10')} />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const ts = Date.now().toString(36);
                                                    const rand = Math.random().toString(36).substring(2, 6);
                                                    setUsername(`anon-${ts}-${rand}@keeper.app`);
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-primary transition-colors"
                                                title="Generate Burner Alias"
                                            >
                                                <MailPlus size={15} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Password</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                className={clsx(inputCls, 'pr-16')}
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                                <button type="button" onClick={() => setIsGeneratorOpen(true)} className="p-1.5 text-muted-foreground hover:text-primary"><Wand2 size={15} /></button>
                                                <button type="button" onClick={() => setShowPassword(p => !p)} className="p-1.5 text-muted-foreground hover:text-foreground">
                                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <PasswordStrength password={password} />
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">TOTP Secret (2FA Auth Key)</label>
                                    <input value={totpSecret} onChange={e => setTotpSecret(e.target.value)} className={clsx(inputCls, 'font-mono placeholder:font-sans')} placeholder="JBSWY3DPEHPK3PXP" />
                                </div>
                            </>
                        )}

                        {/* ── CREDIT_CARD Fields ─── */}
                        {itemType === 'CREDIT_CARD' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Cardholder Name</label>
                                    <input required value={cardholder} onChange={e => setCardholder(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Card Number</label>
                                    <input required value={cardNumber} onChange={e => setCardNumber(e.target.value)} className={clsx(inputCls, 'font-mono')} placeholder="4111 1111 1111 1111" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Expiry</label>
                                        <input required value={expiry} onChange={handleExpiryChange} maxLength={5} className={inputCls} placeholder="MM/YY" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">CVV</label>
                                        <div className="relative">
                                            <input required type={showPassword ? 'text' : 'password'} value={cvv} onChange={e => setCvv(e.target.value)} className={clsx(inputCls, 'pr-10')} placeholder="123" />
                                            <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">PIN</label>
                                        <input type="password" value={pin} onChange={e => setPin(e.target.value)} className={inputCls} placeholder="Optional" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── IDENTITY Fields ─── */}
                        {itemType === 'IDENTITY' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Full Name</label>
                                    <input required value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">ID / Document Number</label>
                                    <input required value={idNumber} onChange={e => setIdNumber(e.target.value)} className={clsx(inputCls, 'font-mono')} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Date of Birth</label>
                                        <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Expiry Date</label>
                                        <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputCls} />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── WIFI Fields ─── */}
                        {itemType === 'WIFI' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">SSID (Network Name)</label>
                                    <input required value={ssid} onChange={e => setSsid(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Wi-Fi Password</label>
                                    <div className="relative">
                                        <input required type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={clsx(inputCls, 'pr-10')} />
                                        <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── SECURE_NOTE Fields ─── */}
                        {itemType === 'SECURE_NOTE' && (
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Markdown Notes</label>
                                <textarea
                                    required
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    className={clsx(inputCls, 'min-h-[160px] resize-none font-mono placeholder:font-sans')}
                                    placeholder="Write your securely encrypted notes here… Supports Markdown!"
                                />
                            </div>
                        )}


                        {/* Password History (edit mode LOGIN) */}
                        {editingItem && editingItem.passwordHistory?.length > 0 && itemType === 'LOGIN' && (
                            <div className="pt-4 border-t border-border/50">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Password History</label>
                                <div className="space-y-2">
                                    {editingItem.passwordHistory.slice().reverse().map((hist, idx) => {
                                        const isVisible = visibleHistoryIdx.has(idx);
                                        const toggleVisible = () => setVisibleHistoryIdx(prev => {
                                            const next = new Set(prev);
                                            isVisible ? next.delete(idx) : next.add(idx);
                                            return next;
                                        });
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-border/50 gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-mono transition-all duration-300 cursor-default truncate ${isVisible ? '' : 'blur-[4px] select-none'}`}>
                                                        {hist.password || '—'}
                                                    </p>
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                                                        {new Date(hist.updatedAt).toLocaleDateString()} {new Date(hist.updatedAt).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={toggleVisible}
                                                        className={`p-1.5 rounded-lg transition-colors ${isVisible ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'}`}
                                                        title={isVisible ? 'Hide password' : 'Show password'}
                                                    >
                                                        {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(hist.password, 'Old Password')}
                                                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                                                        title="Copy password"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer ─────────────────────────────────── */}
                    <div className="px-5 py-4 border-t border-border/50 flex justify-end gap-3 shrink-0 items-center bg-black/5 dark:bg-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 font-bold text-muted-foreground hover:text-foreground transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 text-sm"
                        >
                            {editingItem ? 'Save Changes' : 'Create Secure Item'}
                        </motion.button>
                    </div>
                </form>
            </motion.div>

            {isGeneratorOpen && (
                <PasswordGenerator
                    onClose={() => setIsGeneratorOpen(false)}
                    onUse={(pwd) => { setPassword(pwd); setIsGeneratorOpen(false); }}
                />
            )}
        </div>,
        document.body
    );
}
