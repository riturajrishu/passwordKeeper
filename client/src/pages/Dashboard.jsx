import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import useNotificationStore from '../store/useNotificationStore';
import {
    Plus, Search, Filter, Star, AlertTriangle,
    CheckCircle2, ShieldCheck, Lock, X, KeyRound,
    CreditCard, Wifi, FileText, UserCircle, Shield,
    Clock, RefreshCw
} from 'lucide-react';
import {
    fetchVaultItems, createVaultItem, updateVaultItem, deleteVaultItem
} from '../lib/api';
import { encryptData, decryptData } from '../lib/crypto';
import { checkPasswordBreach } from '../lib/hibp';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import ItemModal from '../components/ItemModal';
import ItemCard from '../components/ItemCard';
import SkeletonGrid from '../components/SkeletonCard';
import ShareModal from '../components/ShareModal';

const CATEGORIES = ['Uncategorized', 'Personal', 'Work', 'Banking', 'Social', 'Gaming'];

const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.02, delayChildren: 0.05 } }
};

// ─── Auto-lock countdown display ──────────────────────────────────────────
const AutoLockTimerDisplay = () => {
    const lastActivity = useAuthStore(s => s.lastActivity);
    const autoLockTimer = useAuthStore(s => s.autoLockTimer);
    const [timeLeft, setTimeLeft] = useState(autoLockTimer * 60);

    useEffect(() => {
        const timerId = setInterval(() => {
            const elapsed = Math.floor((Date.now() - lastActivity) / 1000);
            setTimeLeft(Math.max(0, (autoLockTimer * 60) - elapsed));
        }, 1000);
        return () => clearInterval(timerId);
    }, [lastActivity, autoLockTimer]);

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const urgent = timeLeft <= 60;

    return (
        <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-xl border font-mono font-bold text-xs transition-all shadow-sm whitespace-nowrap',
            urgent
                ? 'bg-destructive/10 border-destructive/50 text-destructive animate-pulse'
                : 'bg-muted/50 border-border text-muted-foreground'
        )}>
            <Lock size={12} className={urgent ? 'animate-bounce' : ''} />
            <span className="hidden leading-none uppercase tracking-tighter sm:inline">Auto-Lock:</span>
            <span className="leading-none">{mins}:{secs.toString().padStart(2, '0')}</span>
        </div>
    );
};

// ─── Stats summary bar ─────────────────────────────────────────────────────
function getStrength(pwd) {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length > 7) s++;
    if (pwd.length > 11) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
}

const StatCard = ({ icon: Icon, label, value, color = 'text-muted-foreground', bg = '' }) => (
    <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2.5 sm:gap-4 px-3.5 sm:px-5 py-3 sm:py-4 rounded-xl border border-border/60 bg-card shadow-premium ${bg}`}
    >
        <div className={`p-2.5 rounded-xl bg-muted shadow-inner ${color}`}>
            <Icon size={16} />
        </div>
        <div>
            <p className="text-lg sm:text-2xl font-black leading-none text-foreground tracking-tight">{value}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1 sm:mt-1.5 opacity-70">{label}</p>
        </div>
    </motion.div>
);

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
    const masterKey = useAuthStore(s => s.masterKey);
    const addToast = useToastStore(s => s.addToast);
    const addNotification = useNotificationStore(s => s.addNotification);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rawSearch, setRawSearch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('All');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [shareItem, setShareItem] = useState(null);   // Item selected for sharing
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [breachLoading, setBreachLoading] = useState({});
    const [breachedItems, setBreachedItems] = useState({});
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const searchRef = useRef(null);

    // ─ Debounce search ─────────────────────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => setSearchQuery(rawSearch), 250);
        return () => clearTimeout(timer);
    }, [rawSearch]);

    useEffect(() => { loadItems(); }, []);

    // ─ Keyboard shortcuts ──────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                setEditingItem(null);
                setIsModalOpen(true);
            }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                searchRef.current?.focus();
            }
            if (e.key === 'Escape' && isModalOpen) {
                setIsModalOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isModalOpen]);

    const loadItems = async () => {
        try {
            setLoading(true);
            const rawItems = await fetchVaultItems();
            const decryptedItems = rawItems
                .filter(item => !item.isDeleted && item.itemType !== 'FILE')
                .map(item => {
                    const decryptedPayload = decryptData(item.encryptedBlob, masterKey);
                    if (!decryptedPayload) return null;

                    const passwordHistory = (item.passwordHistory || []).map(hist => {
                        const dec = decryptData(hist.encryptedBlob, masterKey);
                        return dec ? { ...dec, updatedAt: hist.updatedAt } : null;
                    }).filter(Boolean);

                    return {
                        _id: item._id,
                        category: item.category || 'Uncategorized',
                        isFavorite: item.isFavorite,
                        itemType: item.itemType || 'LOGIN',
                        tags: item.tags || [],
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        passwordHistory,
                        ...decryptedPayload
                    };
                })
                .filter(Boolean);
            setItems(decryptedItems);
        } catch (err) {
            addToast('Failed to load vault items', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveItem = async (payload, currentEditingItem) => {
        const { category, itemType, tags, ...sensitivePayload } = payload;
        const encryptedBlob = encryptData(sensitivePayload, masterKey);
        if (!encryptedBlob) return addToast('Encryption failed', 'error');

        try {
            if (currentEditingItem) {
                await updateVaultItem(currentEditingItem._id, {
                    encryptedBlob,
                    category,
                    itemType,
                    tags: tags || [],
                    isFavorite: currentEditingItem.isFavorite
                });
                addToast('Updated successfully', 'success');
                addNotification('Vault Item Updated', `Credentials for ${sensitivePayload.appName} have been updated.`, 'success');
                setBreachedItems(prev => {
                    const updated = { ...prev };
                    delete updated[currentEditingItem._id];
                    return updated;
                });
            } else {
                await createVaultItem(encryptedBlob, category, false, itemType, tags || []);
                addToast('Saved successfully', 'success');
                addNotification('New Vault Item Added', `${sensitivePayload.appName} has been added to your vault.`, 'success');
            }
            setIsModalOpen(false);
            loadItems();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const toggleFavorite = async (item) => {
        try {
            const basePayload = { ...item };
            ['_id', 'category', 'isFavorite', 'createdAt', 'itemType', 'tags', 'updatedAt', 'passwordHistory'].forEach(k => delete basePayload[k]);
            const encryptedBlob = encryptData(basePayload, masterKey);
            await updateVaultItem(item._id, {
                encryptedBlob,
                category: item.category,
                isFavorite: !item.isFavorite,
                itemType: item.itemType,
                tags: item.tags || []
            });
            loadItems();
        } catch {
            addToast('Failed to update favorite', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteVaultItem(id);
            addToast('Moved to Trash', 'success');
            addNotification('Item Deleted', 'Item moved to trash.', 'warning');
            loadItems();
        } catch {
            addToast('Failed to delete', 'error');
        }
    };

    // ─ Open Share Modal ────────────────────────────────────────────────
    const handleShare = useCallback((item) => {
        setShareItem(item);
        setIsShareModalOpen(true);
    }, []);

    const checkBreach = async (id, password) => {
        if (breachedItems[id] !== undefined) return;
        setBreachLoading(prev => ({ ...prev, [id]: true }));
        try {
            const count = await checkPasswordBreach(password);
            setBreachedItems(prev => ({ ...prev, [id]: count }));
            if (count > 0) {
                addToast(`Found in ${count.toLocaleString()} breaches!`, 'warning');
                addNotification('Security Alert!', `A password was found in ${count.toLocaleString()} known data breaches. Change it immediately!`, 'error');
            } else {
                addToast('Password is clean!', 'success');
            }
        } catch {
            addToast('Breach check failed', 'error');
        } finally {
            setBreachLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(i => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = (i.appName?.toLowerCase().includes(q))
                || (i.username?.toLowerCase().includes(q))
                || (i.tags?.some(t => t.includes(q)));
            const matchesTab = activeTab === 'all' || (activeTab === 'favorites' && i.isFavorite);
            const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory;
            return matchesSearch && matchesTab && matchesCategory;
        });
    }, [items, searchQuery, activeTab, selectedCategory]);

    // ─ Stats ───────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = items.length;
        const favorites = items.filter(i => i.isFavorite).length;
        const weak = items.filter(i => i.password && getStrength(i.password) < 3).length;
        const with2fa = items.filter(i => i.totpSecret).length;
        const loginCount = items.filter(i => i.itemType === 'LOGIN').length;
        const cardCount = items.filter(i => i.itemType === 'CREDIT_CARD').length;

        const pwdCounts = {};
        let reused = 0;
        let stale = 0;

        items.forEach(i => {
            if (i.password) {
                pwdCounts[i.password] = (pwdCounts[i.password] || 0) + 1;
                const dateStr = i.updatedAt || i.createdAt;
                if (dateStr) {
                    const diff = Date.now() - new Date(dateStr).getTime();
                    if (Math.floor(diff / (1000 * 60 * 60 * 24)) > 90) {
                        stale++;
                    }
                }
            }
        });

        Object.values(pwdCounts).forEach(count => {
            if (count > 1) reused += (count - 1);
        });

        return { total, favorites, weak, with2fa, loginCount, cardCount, reused, stale };
    }, [items]);

    return (
        <div className="p-3 sm:p-4 lg:p-8 pb-16">

            {/* ─ Page header ──────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-4xl font-black tracking-tight text-foreground mb-1">Vault Overview</h1>
                    <p className="text-muted-foreground text-[11px] sm:text-sm font-medium">
                        {stats.total} item{stats.total !== 1 ? 's' : ''} <span className="hidden xs:inline">encrypted with AES-256</span> <span className="hidden md:inline">· Press <kbd className="px-2 py-1 rounded-lg bg-muted border border-border text-[10px] font-mono shadow-sm">Ctrl+N</kbd></span>
                    </p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:flex-1 sm:w-64 group order-1 sm:order-2">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={rawSearch}
                            onChange={e => setRawSearch(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.blur();
                                }
                            }}
                            placeholder="Quick search..."
                            className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-11 pr-10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all shadow-sm"
                        />
                        {rawSearch && (
                            <button 
                                type="button"
                                onMouseDown={(e) => { 
                                    e.preventDefault(); 
                                    setRawSearch(''); 
                                    searchRef.current?.blur(); 
                                }} 
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-20 p-1"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className="order-2 sm:order-1 flex items-center">
                        <AutoLockTimerDisplay />
                    </div>
                    <motion.button
                        whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="order-3 bg-primary text-primary-foreground p-3 sm:px-6 sm:py-3 rounded-xl font-black text-sm shadow-xl shadow-primary/25 flex items-center justify-center gap-2 shrink-0 transition-all hover:shadow-primary/40"
                    >
                        <Plus size={18} strokeWidth={3} /> <span className="hidden sm:inline">Add Secure Item</span>
                    </motion.button>
                </div>
            </div>

            {/* ─ Stats bar (only when items loaded) ────────────────── */}
            <AnimatePresence>
                {!loading && items.length > 0 && !isSearchFocused && !rawSearch && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-6 pt-1">
                            <StatCard icon={Shield} label="Total Items" value={stats.total} color="text-primary" />
                            <StatCard icon={Star} label="Favourites" value={stats.favorites} color="text-yellow-500" />
                            <StatCard
                                icon={AlertTriangle}
                                label="Weak Passwords"
                                value={stats.weak}
                                color={stats.weak > 0 ? 'text-red-500' : 'text-green-500'}
                                bg={stats.weak > 0 ? 'border-red-500/20 bg-red-500/5' : ''}
                            />
                            <StatCard icon={ShieldCheck} label="2FA Protected" value={stats.with2fa} color="text-green-500" />
                            <StatCard 
                                icon={RefreshCw} 
                                label="Re-Used" 
                                value={stats.reused} 
                                color={stats.reused > 0 ? 'text-yellow-500' : 'text-green-500'} 
                                bg={stats.reused > 0 ? 'border-yellow-500/20 bg-yellow-500/5' : ''} 
                            />
                            <StatCard 
                                icon={Clock} 
                                label=">90 Days" 
                                value={stats.stale} 
                                color={stats.stale > 0 ? 'text-orange-400' : 'text-green-500'} 
                                bg={stats.stale > 0 ? 'border-orange-500/20 bg-orange-500/5' : ''} 
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─ Filter Bar ────────────────────────────────────── */}
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8 overflow-x-auto pb-3 sm:pb-4 no-scrollbar -mx-3 px-3 sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0 after:content-[''] after:w-1 after:shrink-0 sm:after:hidden">
                <div className="flex bg-muted/60 p-1.5 rounded-2xl border border-border/60 shadow-inner shrink-0">
                    {[
                        { id: 'all', label: 'All Items' },
                        { id: 'favorites', label: 'Favorites' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap outline-none',
                                activeTab === tab.id
                                    ? tab.id === 'favorites' ? 'bg-card shadow-sm text-yellow-500' : 'bg-card shadow-sm text-primary'
                                    : 'text-muted-foreground/60 hover:text-foreground'
                            )}
                        >
                            {tab.id === 'favorites' && <Star size={10} className="inline mr-1.5 -mt-0.5" fill="currentColor" />}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-border shrink-0" />

                <div className="flex gap-2.5">
                    {['All', ...CATEGORIES].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={clsx(
                                'px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all shrink-0',
                                selectedCategory === cat
                                    ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                                    : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {rawSearch && !loading && (
                <div className="mb-4 sm:mb-6">
                    <h2 className="text-sm font-bold opacity-80 flex items-center justify-between">
                        Search Results for "{rawSearch}"
                        <button onClick={() => { setRawSearch(''); searchRef.current?.blur(); }} className="text-primary hover:underline text-xs">Clear search</button>
                    </h2>
                </div>
            )}

            {/* ─ Vault Content ─────────────────────────────────── */}
            {loading ? (
                <SkeletonGrid count={6} />
            ) : filteredItems.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel rounded-3xl border border-border p-10 sm:p-16 lg:p-20 text-center max-w-md mx-auto"
                >
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto text-primary">
                        <Filter size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No items found</h3>
                    <p className="text-muted-foreground text-sm mb-6">
                        {items.length === 0 ? 'Your vault is empty. Add your first secure item!' : 'Try adjusting your search or filters.'}
                    </p>
                    {items.length > 0 ? (
                        <button
                            onClick={() => { setRawSearch(''); setSelectedCategory('All'); }}
                            className="text-primary font-bold hover:underline"
                        >
                            Clear all filters
                        </button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 mx-auto"
                        >
                            <Plus size={18} /> Add First Item
                        </motion.button>
                    )}
                </motion.div>
            ) : (
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6"
                >
                    {filteredItems.map(item => (
                        <ItemCard
                            key={item._id}
                            item={item}
                            toggleFavorite={toggleFavorite}
                            onEdit={(editingItem) => {
                                setEditingItem(editingItem);
                                setIsModalOpen(true);
                            }}
                            onDelete={handleDelete}
                            onShare={handleShare}
                            checkBreach={checkBreach}
                            isBreached={breachedItems[item._id] > 0}
                            breachStatus={breachedItems[item._id]}
                            breachLoading={breachLoading[item._id]}
                        />
                    ))}
                </motion.div>
            )}

            {/* New / Edit Item Modal */}
            <ItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveItem}
                editingItem={editingItem}
            />

            {/* Secure Share Modal */}
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => { setIsShareModalOpen(false); setShareItem(null); }}
                item={shareItem}
            />
        </div>
    );
}
