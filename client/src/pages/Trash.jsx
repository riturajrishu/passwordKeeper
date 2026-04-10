import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, RefreshCcw, AlertTriangle, Loader2, ShieldOff } from 'lucide-react';
import { fetchVaultItems, restoreVaultItem, permanentDeleteVaultItem } from '../lib/api';
import { decryptData } from '../lib/crypto';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import ConfirmDialog from '../components/ConfirmDialog';

const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const fadeUpItem = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
};

export default function Trash() {
    const masterKey = useAuthStore(s => s.masterKey);
    const addToast = useToastStore(s => s.addToast);
    
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // ConfirmDialog state
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
    });

    useEffect(() => {
        loadTrashedItems();
    }, []);

    const loadTrashedItems = async () => {
        try {
            setLoading(true);
            const rawItems = await fetchVaultItems();
            const trashed = rawItems
                .filter(i => i.isDeleted)
                .map(item => {
                    const payload = decryptData(item.encryptedBlob, masterKey);
                    if (!payload) return null;
                    return {
                        _id: item._id,
                        itemType: item.itemType || 'LOGIN',
                        category: item.category,
                        deletedAt: item.deletedAt,
                        ...payload
                    };
                })
                .filter(Boolean)
                .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
            setItems(trashed);
        } catch (e) {
            console.error(e);
            addToast("Failed to load trash", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id) => {
        try {
            await restoreVaultItem(id);
            addToast("Item restored to vault", "success");
            loadTrashedItems();
        } catch (e) {
            addToast("Restore failed", "error");
        }
    };

    const openDeleteConfirm = (id, name) => {
        setConfirmState({
            isOpen: true,
            title: 'Permanently Delete?',
            message: `"${name}" will be deleted forever. This cannot be undone.`,
            onConfirm: async () => {
                setConfirmState(s => ({ ...s, isOpen: false }));
                try {
                    await permanentDeleteVaultItem(id);
                    addToast("Permanently deleted", "success");
                    loadTrashedItems();
                } catch {
                    addToast("Deletion failed", "error");
                }
            },
        });
    };

    const openEmptyTrashConfirm = () => {
        setConfirmState({
            isOpen: true,
            title: 'Empty Entire Trash?',
            message: `All ${items.length} items will be permanently deleted. This cannot be undone.`,
            onConfirm: async () => {
                setConfirmState(s => ({ ...s, isOpen: false }));
                try {
                    await Promise.all(items.map(item => permanentDeleteVaultItem(item._id)));
                    addToast(`${items.length} items permanently deleted`, "success");
                    loadTrashedItems();
                } catch {
                    addToast("Failed to empty trash", "error");
                }
            },
        });
    };

    // Calculate days remaining before auto-delete (30 days)
    const getDaysRemaining = (deletedAt) => {
        if (!deletedAt) return 0;
        const deletedDate = new Date(deletedAt);
        const expiryDate = new Date(deletedDate.getTime() + (30 * 24 * 60 * 60 * 1000));
        const diffDays = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    const getTypeLabel = (type) => {
        const map = {
            LOGIN: 'Login',
            CREDIT_CARD: 'Credit Card',
            IDENTITY: 'Identity',
            WIFI: 'Wi-Fi',
            SECURE_NOTE: 'Secure Note',
        };
        return map[type] || type;
    };

    return (
        <div className="p-3 sm:p-4 lg:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-8 pb-16">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 flex items-center gap-3 text-red-500">
                        <Trash2 size={28} />
                        Trash Bin
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Items here are permanently deleted after <span className="font-semibold text-foreground">30 days</span>.
                    </p>
                </div>
                {items.length > 0 && (
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={openEmptyTrashConfirm}
                        className="text-sm font-bold text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                        <ShieldOff size={16} />
                        Empty Trash ({items.length})
                    </motion.button>
                )}
            </header>

            {loading ? (
                <div className="flex justify-center p-20">
                    <Loader2 className="animate-spin text-red-500" size={40} />
                </div>
            ) : items.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel p-16 sm:p-20 rounded-3xl border border-border text-center flex flex-col items-center justify-center opacity-60"
                >
                    <Trash2 size={48} className="mb-4 text-muted-foreground" />
                    <p className="font-bold text-lg">Trash is empty</p>
                    <p className="text-sm text-muted-foreground mt-1">Deleted items appear here before being permanently removed.</p>
                </motion.div>
            ) : (
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                >
                    {items.map(item => {
                        const daysLeft = getDaysRemaining(item.deletedAt);
                        const isUrgent = daysLeft <= 3;
                        return (
                            <motion.div
                                variants={fadeUpItem}
                                key={item._id}
                                className="glass-panel p-5 rounded-3xl border border-red-500/20 bg-red-500/5 relative overflow-hidden group hover:border-red-500/40 transition-colors"
                            >
                                {/* Days left badge */}
                                <div className={`absolute top-0 right-0 p-2.5 rounded-bl-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isUrgent ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-500'}`}>
                                    <AlertTriangle size={10} /> {daysLeft}d left
                                </div>

                                <div className="mt-4 pr-16">
                                    <h3 className="font-bold text-base sm:text-lg truncate" title={item.appName}>
                                        {item.appName || 'Unnamed Item'}
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">
                                        {getTypeLabel(item.itemType)} • {item.category}
                                    </p>
                                    {item.deletedAt && (
                                        <p className="text-[10px] text-muted-foreground mt-2">
                                            Deleted {new Date(item.deletedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-5 flex gap-2">
                                    <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => handleRestore(item._id)}
                                        className="flex-1 bg-background border border-border/50 text-foreground py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30 transition-all shadow-sm"
                                    >
                                        <RefreshCcw size={13} /> Restore
                                    </motion.button>
                                    <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => openDeleteConfirm(item._id, item.appName || 'this item')}
                                        className="flex-1 bg-red-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-sm"
                                    >
                                        <Trash2 size={13} /> Delete
                                    </motion.button>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Yes, Delete"
                confirmVariant="danger"
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(s => ({ ...s, isOpen: false }))}
            />
        </div>
    );
}
