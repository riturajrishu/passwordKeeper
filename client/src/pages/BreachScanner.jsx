import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Loader2, Target, Radar, ArrowRight, Play } from 'lucide-react';
import { fetchVaultItems, updateVaultItem } from '../lib/api';
import { decryptData, encryptData } from '../lib/crypto';
import { checkPasswordBreach } from '../lib/hibp';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import useNotificationStore from '../store/useNotificationStore';
import clsx from 'clsx';
import ItemModal from '../components/ItemModal';
import LiveBreachScanner from '../components/LiveBreachScanner';

export default function BreachScanner() {
    const masterKey = useAuthStore(s => s.masterKey);
    const addToast = useToastStore(s => s.addToast);
    const addNotification = useNotificationStore(s => s.addNotification);
    const [logins, setLogins] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Scan State
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState([]); // { item, count }
    const [scanComplete, setScanComplete] = useState(false);

    // Edit Modal State
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        loadLogins();
    }, []);

    const loadLogins = async () => {
        try {
            setLoading(true);
            const rawItems = await fetchVaultItems();
            const decrypted = rawItems
                .filter(i => !i.isDeleted)
                .map(item => {
                    const payload = decryptData(item.encryptedBlob, masterKey);
                    if (!payload || (item.itemType && item.itemType !== 'LOGIN') || (!item.itemType && !payload.password)) return null;
                    return { _id: item._id, itemType: item.itemType || 'LOGIN', ...payload };
                })
                .filter(Boolean);
            setLogins(decrypted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const runScan = async () => {
        if(isScanning || logins.length === 0) return;
        setIsScanning(true);
        setScanComplete(false);
        setResults([]);
        
        let scannedCount = 0;
        const scanResults = [];

        // Simulate a "hacker scan" delay even if fast
        for (const item of logins) {
            if(!item.password) {
                scannedCount++;
                continue;
            }
            try {
                // Minimum 300ms delay per item for effect
                const [count] = await Promise.all([
                    checkPasswordBreach(item.password),
                    new Promise(r => setTimeout(r, 400))
                ]);
                scanResults.push({ item, count, timestamp: new Date() });
                setResults([...scanResults]); // update progressively
            } catch (e) {
                console.error("Breach check error", e);
            }
            scannedCount++;
            setProgress(Math.round((scannedCount / logins.length) * 100));
        }

        setIsScanning(false);
        setScanComplete(true);
    };

    const handleSave = async (payload, currentEditingItem) => {
        const { category, itemType, tags, ...sensitivePayload } = payload;
        const encryptedBlob = encryptData(sensitivePayload, masterKey);
        
        if (!encryptedBlob) return addToast('Encryption failed', 'error');

        try {
            await updateVaultItem(currentEditingItem._id, {
                encryptedBlob,
                category,
                itemType,
                tags: tags || [],
                isFavorite: currentEditingItem.isFavorite
            });
            
            addToast('Updated successfully', 'success');
            addNotification('Security Fixed', `Password for ${sensitivePayload.appName} has been updated.`, 'success');
            
            setEditingItem(null);
            loadLogins();
            
            // Optionally update results state to reflect it's clean (but reload is safer)
            setResults(prev => prev.map(r => 
                r.item._id === currentEditingItem._id ? { ...r, count: 0 } : r
            ));
        } catch (err) {
            addToast(err.message || 'Failed to update', 'error');
        }
    };

    const breachedCount = results.filter(r => r.count > 0).length;
    const cleanCount = results.filter(r => r.count === 0).length;

    return (
        <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                    <Radar className={isScanning ? "animate-spin-slow text-primary" : "text-muted-foreground"} size={28} />
                    Dark Web Scanner
                </h1>
                <p className="text-muted-foreground text-sm">Actively monitor your identity and passwords against known data breaches.</p>
            </header>

            {/* Email OSINT Breach Scanner from Phase 1 */}
            <LiveBreachScanner />

            {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 mt-8">
                    
                    {/* Radar & Control Panel */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="glass-panel p-8 rounded-3xl border border-border flex flex-col items-center justify-center text-center relative overflow-hidden h-[340px]">
                            {/* Animated Background */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                <motion.div 
                                    className="w-64 h-64 border border-primary/20 rounded-full"
                                    animate={{ scale: isScanning ? [1, 2, 2] : 1, opacity: isScanning ? [1, 0, 0] : 0.2 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                                />
                                <motion.div 
                                    className="absolute w-40 h-40 border border-primary/40 rounded-full"
                                    animate={{ scale: isScanning ? [1, 2, 2] : 1, opacity: isScanning ? [1, 0, 0] : 0.4 }}
                                    delay={0.5}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                                />
                            </div>

                            <div className="z-10 bg-background/80 backdrop-blur-md p-6 rounded-full border border-primary/20 shadow-xl shadow-primary/10 mb-6">
                                {isScanning ? (
                                    <Target className="text-primary animate-pulse" size={48} />
                                ) : scanComplete && breachedCount === 0 ? (
                                    <ShieldCheck className="text-green-500" size={48} />
                                ) : scanComplete && breachedCount > 0 ? (
                                    <ShieldAlert className="text-red-500" size={48} />
                                ) : (
                                    <ShieldCheck className="text-muted-foreground" size={48} />
                                )}
                            </div>
                            
                            {isScanning ? (
                                <div className="z-10 w-full space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                                        <span>Scanning Vault...</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                        <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                                    </div>
                                    <p className="text-[10px] uppercase text-muted-foreground pt-2 animate-pulse">Contacting Hash APIs...</p>
                                </div>
                            ) : (
                                <div className="z-10 w-full">
                                    <h3 className="font-bold text-xl mb-1">{scanComplete ? 'Scan Complete' : 'Ready to Scan'}</h3>
                                    <p className="text-xs text-muted-foreground mb-6">Found {logins.length} login credentials to analyze.</p>
                                    <button 
                                        onClick={runScan}
                                        disabled={logins.length === 0}
                                        className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        <Play fill="currentColor" size={16} /> {scanComplete ? 'Run Again' : 'Start Deep Scan'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Breakdown Stats */}
                        {scanComplete && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-2 gap-4">
                                <div className="glass-panel p-5 rounded-3xl border border-red-500/20 bg-red-500/5">
                                    <div className="flex items-center gap-2 text-red-500 mb-2">
                                        <ShieldAlert size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Exposed</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-500">{breachedCount}</p>
                                </div>
                                <div className="glass-panel p-5 rounded-3xl border border-green-500/20 bg-green-500/5">
                                    <div className="flex items-center gap-2 text-green-500 mb-2">
                                        <ShieldCheck size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Safe</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-500">{cleanCount}</p>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Live Results Stream */}
                    <div className="lg:col-span-8">
                        <div className="glass-panel rounded-3xl border border-border overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-border/50 bg-black/5 dark:bg-white/5 flex items-center justify-between shadow-sm z-10">
                                <h3 className="font-bold text-sm uppercase tracking-widest">Scan Activity Log</h3>
                                {isScanning && <div className="flex items-center gap-2"><Loader2 size={14} className="animate-spin text-primary" /><span className="text-xs text-primary font-mono animate-pulse">Processing...</span></div>}
                            </div>
                            
                            <div className="flex-1 overflow-y-auto w-full p-4 space-y-3 custom-scrollbar flex flex-col-reverse">
                                {results.length === 0 && !isScanning && !scanComplete ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 opacity-50">
                                        <Radar size={64} className="mb-4" />
                                        <p className="text-sm">Initiate a scan to view results.</p>
                                    </div>
                                ) : (
                                    <AnimatePresence>
                                        {results.map((res, i) => (
                                            <motion.div 
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={clsx(
                                                    "p-3 lg:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm",
                                                    res.count > 0 ? "bg-red-500/10 border-red-500/30" : "bg-black/5 dark:bg-white/5 border-border/50"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx("p-2 rounded-xl", res.count > 0 ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500")}>
                                                        {res.count > 0 ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{res.item.appName} <span className="text-xs font-mono font-normal opacity-70 ml-2">{res.item.username}</span></p>
                                                        {res.count > 0 ? (
                                                            <p className="text-[10px] text-red-500/80 font-bold uppercase tracking-widest mt-1">Found in {res.count.toLocaleString()} breaches!</p>
                                                        ) : (
                                                            <p className="text-[10px] text-green-500/80 uppercase tracking-widest mt-1">No known breaches</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {res.count > 0 && (
                                                    <button onClick={() => setEditingItem(res.item)} className="text-xs bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold shadow-sm transition-colors whitespace-nowrap">
                                                        Change Password
                                                    </button>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
            
            {editingItem && (
                <ItemModal 
                    isOpen={!!editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={handleSave}
                    editingItem={editingItem}
                />
            )}
        </div>
    );
}
