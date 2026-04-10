import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star, Edit3, Trash2, Copy, ShieldCheck, Loader2,
    CreditCard, UserCircle, Wifi, FileText, KeyRound,
    Share2, Eye, EyeOff, Check, Clock, ExternalLink
} from 'lucide-react';
import clsx from 'clsx';
import { TOTP } from 'otpauth';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import useToastStore from '../store/useToastStore';

const fadeUpItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};


// Copy-with-feedback hook
function useCopyFeedback() {
    const [copiedKey, setCopiedKey] = useState(null);
    const addToast = useToastStore(s => s.addToast);
    const copy = useCallback((text, label, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        addToast(`${label} copied!`, 'success');
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    }, [addToast]);
    return { copiedKey, copy };
}

function CopyBtn({ text, label, copyKey, copiedKey, onCopy, className = '' }) {
    const isCopied = copiedKey === copyKey;
    return (
        <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => onCopy(text, label, copyKey)}
            className={clsx(
                'p-2 rounded-xl transition-all shadow-sm border',
                isCopied 
                    ? 'bg-green-500 border-green-500 text-white shadow-green-500/20' 
                    : 'bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                className
            )}
            title={`Copy ${label}`}
        >
            <AnimatePresence mode="wait" initial={false}>
                {isCopied
                    ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={14} /></motion.span>
                    : <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={14} /></motion.span>
                }
            </AnimatePresence>
        </motion.button>
    );
}

export default function ItemCard({
    item,
    toggleFavorite,
    onEdit,
    onDelete,
    onShare,
    checkBreach,
    isBreached,
    breachStatus,
    breachLoading
}) {
    const { copiedKey, copy } = useCopyFeedback();
    const [totpCode, setTotpCode] = useState('');
    const [totpTimeLeft, setTotpTimeLeft] = useState(30);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showCC, setShowCC] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [logoError, setLogoError] = useState(false);

    const type = item.itemType || 'LOGIN';

    // TOTP generation
    useEffect(() => {
        if (type !== 'LOGIN' || !item.totpSecret) return;
        let totp;
        try {
            totp = new TOTP({
                issuer: item.appName,
                label: item.username || 'user',
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: item.totpSecret.replace(/\s+/g, '')
            });
        } catch (e) {
            console.error('Invalid TOTP Secret for', item.appName);
            return;
        }
        const updateTotp = () => {
            setTotpCode(totp.generate());
            const seconds = Math.floor(Date.now() / 1000);
            setTotpTimeLeft(30 - (seconds % 30));
        };
        updateTotp();
        const interval = setInterval(updateTotp, 1000);
        return () => clearInterval(interval);
    }, [type, item.totpSecret, item.appName, item.username]);

    const getDomain = () => {
        if (!item.url) return null;
        try { return new URL(item.url.startsWith('h') ? item.url : `https://${item.url}`).hostname; } 
        catch { return null; }
    };
    
    const domain = getDomain();

    const getIcon = () => {
        switch (type) {
            case 'CREDIT_CARD': return <CreditCard size={22} className="text-secondary" />;
            case 'IDENTITY':    return <UserCircle size={22} className="text-primary" />;
            case 'WIFI':        return <Wifi size={22} className="text-sky-400" />;
            case 'SECURE_NOTE': return <FileText size={22} className="text-orange-400" />;
            case 'FILE':        return <span className="text-2xl">📄</span>;
            default:            return <KeyRound size={22} className="text-primary" />;
        }
    };

    const renderLoginContent = () => (
        <div className="space-y-3">
            {/* Username row */}
            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border flex items-center justify-between gap-2 group/field transition-colors hover:border-border/80">
                <div className="truncate flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-0.5">Username</p>
                    <p className="text-sm font-bold truncate text-foreground">{item.username || '—'}</p>
                </div>
                <CopyBtn text={item.username} label="Username" copyKey="username" copiedKey={copiedKey} onCopy={copy} />
            </div>

            {/* Password row */}
            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border flex items-center justify-between gap-2 group/field transition-colors hover:border-border/80">
                <div className="truncate flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-0.5">Password</p>
                    <p className={clsx('text-sm font-mono font-bold tracking-widest truncate transition-all duration-300', !showPwd && 'blur-[5px] select-none')}>
                        {showPwd ? (item.password || '—') : '••••••••'}
                    </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setShowPwd(p => !p)}
                        className="p-2 bg-muted border border-border rounded-xl text-muted-foreground hover:text-foreground transition-all"
                        title={showPwd ? 'Hide' : 'Show'}
                    >
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </motion.button>
                    <CopyBtn text={item.password} label="Password" copyKey="password" copiedKey={copiedKey} onCopy={copy} />
                </div>
            </div>

            {/* TOTP */}
            {item.totpSecret && totpCode && (
                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-0.5">2FA Code</p>
                        <p className="text-lg font-mono font-bold tracking-[0.2em]">{totpCode.slice(0, 3)} {totpCode.slice(3)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-6 h-6">
                            <svg className="w-6 h-6 transform -rotate-90">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary/20" />
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" className="text-primary transition-all duration-1000 ease-linear" strokeDasharray="62.8" strokeDashoffset={62.8 * (1 - totpTimeLeft / 30)} />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">{totpTimeLeft}</span>
                        </div>
                        <CopyBtn text={totpCode} label="2FA Code" copyKey="totp" copiedKey={copiedKey} onCopy={copy} className="!bg-primary" />
                    </div>
                </div>
            )}
        </div>
    );

    const renderCreditCardContent = () => (
        <div className="perspective-1000 w-full h-40 cursor-pointer" onClick={() => setIsFlipped(f => !f)}>
            <motion.div
                className="w-full h-full relative transform-style-3d transition-transform duration-700"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
            >
                {/* Front */}
                <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-900 overflow-hidden shadow-lg p-4 sm:p-5 flex flex-col justify-between border border-white/10 text-white">
                    <div className="absolute top-0 right-0 p-4 opacity-30"><CreditCard size={40} /></div>
                    <div className="z-10 text-xs font-bold tracking-widest opacity-80 uppercase truncate">{item.appName || 'Credit Card'}</div>
                    <div className="z-10">
                        <div className="text-sm sm:text-base font-mono tracking-widest flex items-center justify-between mb-3">
                            <span>{item.cardNumber ? (showCC ? item.cardNumber : `**** **** **** ${item.cardNumber.slice(-4)}`) : '**** **** **** ****'}</span>
                            <button onClick={(e) => { e.stopPropagation(); setShowCC(s => !s); }} className="p-1 hover:text-white/70 shrink-0">
                                {showCC ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-[8px] uppercase tracking-widest opacity-60 mb-0.5">Cardholder</div>
                                <div className="text-sm font-bold uppercase truncate max-w-[120px]">{item.cardholder || 'YOUR NAME'}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[8px] uppercase tracking-widest opacity-60 mb-0.5">Expires</div>
                                <div className="text-sm font-bold">{item.expiry || 'MM/YY'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Back */}
                <div className="absolute inset-0 backface-hidden rounded-2xl bg-slate-800 overflow-hidden shadow-lg border border-white/10 text-white rotate-y-180 flex flex-col">
                    <div className="w-full h-8 bg-black mt-4" />
                    <div className="flex items-center px-4 mt-4 gap-2">
                        <div className="bg-white/90 h-8 flex-1 flex items-center justify-end px-3 text-black font-mono font-bold italic text-sm rounded-sm">{item.cvv || '***'}</div>
                        <button onClick={(e) => { e.stopPropagation(); copy(item.cvv, 'CVV', 'cvv'); }} className="p-1.5 bg-white/20 hover:bg-white/30 rounded">
                            {copiedKey === 'cvv' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                    <div className="px-4 mt-auto mb-4 flex justify-between items-center text-xs opacity-50">
                        <span>Tap to flip</span>
                        {item.pin && <span>PIN: ***</span>}
                    </div>
                </div>
            </motion.div>
        </div>
    );

    const renderIdentityContent = () => (
        <div className="space-y-3">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Full Legal Name</p>
                <p className="text-base font-bold">{item.fullName || 'N/A'}</p>
            </div>
            <div className="flex gap-2">
                <div className="flex-1 p-3 bg-black/5 dark:bg-black/20 rounded-xl border border-border/50 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Document ID</p>
                    <p className="text-sm font-mono truncate">{item.idNumber || 'N/A'}</p>
                </div>
                <button onClick={() => copy(item.idNumber, 'ID Number', 'idNumber')} className="p-3 bg-black/5 dark:bg-black/20 hover:bg-black/10 rounded-xl border border-border/50 shrink-0">
                    {copiedKey === 'idNumber' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="p-2 border border-border/50 rounded-xl bg-background/50">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">DOB</p>
                    <p className="text-xs font-semibold">{item.dob || 'N/A'}</p>
                </div>
                <div className="p-2 border border-border/50 rounded-xl bg-background/50">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Expires</p>
                    <p className="text-xs font-semibold">{item.expiryDate || 'N/A'}</p>
                </div>
            </div>
        </div>
    );

    const renderWifiContent = () => (
        <div className="space-y-4">
            <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20 text-center">
                <Wifi size={28} className="mx-auto text-sky-500 mb-1.5" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500 mb-0.5">Network SSID</p>
                <p className="text-base font-bold truncate max-w-full px-4">{item.ssid}</p>
            </div>
            <div className="p-3 bg-black/5 dark:bg-black/20 rounded-2xl border border-border/50 flex items-center justify-between gap-2">
                <div className="truncate flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Password</p>
                    <p className={clsx('text-sm font-mono tracking-widest truncate transition-all duration-300', !showPwd && 'blur-[4px]')}>
                        {showPwd ? (item.password || '—') : '••••••••'}
                    </p>
                </div>
                <div className="flex gap-1 shrink-0">
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowPwd(p => !p)} className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground">
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </motion.button>
                    <button onClick={() => copy(item.password, 'Wi-Fi Password', 'wifiPwd')} className="p-1.5 bg-sky-500 text-white rounded-lg shadow-sm">
                        {copiedKey === 'wifiPwd' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderNoteContent = () => {
        const sanitizedHtml = DOMPurify.sanitize(marked.parse(item.note || '*Empty note*'));
        return (
            <div className="h-36 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90 z-10 pointer-events-none rounded-2xl" />
                <div
                    className="prose prose-sm dark:prose-invert prose-p:leading-snug prose-h1:text-base prose-h2:text-sm p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/50 h-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
            </div>
        );
    };

    const renderFileContent = () => {
        const handleDownload = (e) => {
            e.stopPropagation();
            if (!item.fileContent) return;
            // Decode base64 and trigger download
            const a = document.createElement('a');
            a.href = item.fileContent;
            a.download = item.fileName || 'secure_file';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            useToastStore.getState().addToast('File Decrypted & Downloaded!', 'success');
        };

        return (
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex flex-col items-center justify-center text-center">
                <span className="text-4xl mb-2">📄</span>
                <p className="text-sm font-bold text-primary truncate max-w-full">{item.fileName || 'Encrypted File'}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 mb-4">{item.fileTypeStr || 'Unknown Type'}</p>
                
                <button 
                    onClick={handleDownload}
                    className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    Decrypt & Download
                </button>
            </div>
        );
    };

    return (
        <motion.div
            variants={fadeUpItem}
            className="flex flex-col bg-card border border-border/60 hover:border-primary/40 rounded-2xl transition-all group overflow-hidden shadow-premium hover:shadow-2xl"
        >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 shrink-0 rounded-2xl bg-muted border border-border shadow-sm flex items-center justify-center relative overflow-hidden group-hover:border-primary/20 transition-colors">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            {domain && !logoError ? (
                                <img 
                                    src={`https://www.google.com/s2/favicons?domain=${domain?.replace(/^www\./, '')}&sz=128`} 
                                    alt={item.appName}
                                    className="w-8 h-8 object-contain drop-shadow-sm z-10"
                                    onError={() => setLogoError(true)}
                                />
                            ) : (
                                <div className="z-10">{getIcon()}</div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-extrabold text-lg leading-tight break-words text-foreground group-hover:text-primary transition-colors" title={item.appName}>
                                {item.appName}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 py-0.5 bg-muted rounded-lg border border-border">
                                    {type.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                    • {item.category}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                        <button
                            onClick={() => toggleFavorite(item)}
                            className={clsx('p-2 rounded-xl transition-all hover:bg-muted', item.isFavorite ? 'text-yellow-500 bg-yellow-500/5' : 'text-muted-foreground/60 hover:text-foreground')}
                            title="Favorite"
                        >
                            <Star size={16} fill={item.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                            onClick={() => onDelete(item._id)}
                            className="p-2 rounded-xl text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/5 transition-all"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Dynamic Body */}
            <div className="px-5 sm:px-6 pb-4 flex-1">
                {type === 'LOGIN' && renderLoginContent()}
                {type === 'CREDIT_CARD' && renderCreditCardContent()}
                {type === 'IDENTITY' && renderIdentityContent()}
                {type === 'WIFI' && renderWifiContent()}
                {type === 'SECURE_NOTE' && renderNoteContent()}
                {type === 'FILE' && renderFileContent()}
            </div>


            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary rounded-lg border border-primary/20">
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="px-5 sm:px-6 py-4 bg-muted/30 border-t border-border mt-auto flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onEdit(item)}
                        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                    >
                        <Edit3 size={12} /> Edit
                    </button>
                    <div className="w-px h-3 bg-border" />
                    <button
                        onClick={() => onShare && onShare(item)}
                        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                    >
                        <Share2 size={12} /> Share
                    </button>
                    {item.url && (
                        <>
                            <div className="w-px h-3 bg-border" />
                            <a
                                href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ExternalLink size={12} /> Visit
                            </a>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {(type === 'LOGIN' && item.password) ? (
                        <button
                            onClick={() => checkBreach(item._id, item.password)}
                            className={clsx(
                                'text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 transition-all px-2.5 py-1 rounded-lg border',
                                isBreached 
                                    ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                                    : (breachStatus === 0 ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-muted border-border text-muted-foreground hover:border-primary/30')
                            )}
                        >
                            {breachLoading ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={11} />}
                            {isBreached ? 'Exposed' : (breachStatus === 0 ? 'Verified' : 'Audit')}
                        </button>
                    ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                            <ShieldCheck size={11} /> AES-256
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
