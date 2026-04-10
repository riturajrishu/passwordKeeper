import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, KeyRound, CreditCard, UserCircle, Wifi, FileText, X, Loader2 } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import { fetchVaultItems } from '../lib/api';
import { decryptData } from '../lib/crypto';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const masterKey = useAuthStore(s => s.masterKey);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            return;
        }
        const load = async () => {
            setLoading(true);
            try {
                const raw = await fetchVaultItems();
                const dec = raw.filter(i => !i.isDeleted).map(i => {
                    const p = decryptData(i.encryptedBlob, masterKey);
                    return p ? { _id: i._id, itemType: i.itemType || 'LOGIN', ...p } : null;
                }).filter(Boolean);
                setItems(dec);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [isOpen, masterKey]);

    const filtered = items.filter(i => {
        const str = `${i.appName} ${i.username || ''} ${i.category || ''} ${(i.tags || []).join(' ')}`.toLowerCase();
        return str.includes(query.toLowerCase());
    });

    const getIcon = (type) => {
        switch (type) {
            case 'CREDIT_CARD': return <CreditCard size={18} className="text-secondary" />;
            case 'IDENTITY':    return <UserCircle size={18} className="text-primary" />;
            case 'WIFI':        return <Wifi size={18} className="text-sky-400" />;
            case 'SECURE_NOTE': return <FileText size={18} className="text-orange-400" />;
            default:            return <KeyRound size={18} className="text-primary" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh] px-4 bg-background/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-2xl bg-black/40 dark:bg-black/60 rounded-3xl overflow-hidden glass-panel border border-border/50 shadow-2xl flex flex-col"
            >
                <div className="flex items-center px-4 py-4 border-b border-border/50">
                    <Search className="text-muted-foreground mr-3" size={24} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search passwords, notes, credit cards..."
                        className="flex-1 bg-transparent border-none outline-none text-lg text-foreground placeholder:text-muted-foreground"
                    />
                    {loading && <Loader2 className="animate-spin text-primary ml-2" size={20} />}
                    <button onClick={() => setIsOpen(false)} className="ml-2 p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                    {query && filtered.length === 0 && !loading && (
                        <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                            <Search size={32} className="mb-3 opacity-50" />
                            <p className="font-bold">No results found for "{query}"</p>
                        </div>
                    )}

                    {!query && !loading && (
                        <div className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground ml-2">
                            Type to search vault...
                        </div>
                    )}

                    {filtered.length > 0 && query && (
                        <div className="space-y-1">
                            {filtered.map(item => (
                                <button
                                    key={item._id}
                                    onClick={() => {
                                        setIsOpen(false);
                                        navigate('/dashboard'); // Go to dashboard so they can find it
                                        // A future improvement would be to open the ItemModal directly from here.
                                    }}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-primary/10 transition-colors text-left group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                        {getIcon(item.itemType || 'LOGIN')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold truncate text-foreground group-hover:text-primary transition-colors">{item.appName}</p>
                                        <p className="text-xs text-muted-foreground truncate">{item.username || item.itemType || 'Item'}</p>
                                    </div>
                                    <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                                        {item.category}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="px-4 py-3 bg-black/20 border-t border-border/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">↑</kbd><kbd className="bg-white/10 px-1.5 py-0.5 rounded">↓</kbd> Navigate</span>
                        <span className="flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">↵</kbd> Open</span>
                    </div>
                    <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-primary">ESC</kbd> Close</span>
                </div>
            </motion.div>
        </div>
    );
}
