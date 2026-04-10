import React, { useState } from 'react';
import { Search, Loader2, ShieldAlert, ShieldCheck, Mail, AlertTriangle, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LiveBreachScanner = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { breaches: [] } or { safe: true }
    const [error, setError] = useState('');

    const handleScan = async (e) => {
        e.preventDefault();
        if (!email.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            // Using XposedOrNot analytics API which provides detailed breach metrics
            const res = await fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`);
            
            if (res.status === 404) {
                // Not found means safe
                setResult({ safe: true });
            } else if (!res.ok) {
                throw new Error("Failed to contact breach database.");
            } else {
                const data = await res.json();
                
                // Fetch details for breaches
                const breachesList = data.ExposedBreaches?.breaches_details || []; 
                if (breachesList.length > 0) {
                    setResult({ breaches: breachesList });
                } else {
                    setResult({ safe: true });
                }
            }
        } catch (err) {
            setError(err.message || "An error occurred during the scan.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-base sm:text-xl font-bold flex items-center gap-2">
                        <Search className="text-primary shrink-0" size={18} /> Deep Web Breach Scanner
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Check if your email has been compromised in any known data breaches worldwide.
                    </p>
                </div>
            </div>

            <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-2 sm:gap-2 max-w-xl mb-6">
                <div className="relative flex-1">
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email to scan..." 
                        className="w-full pl-10 pr-4 py-3 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                        required
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-primary text-black px-4 sm:px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap shrink-0"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Scan Deep Web"}
                </button>
            </form>

            <AnimatePresence mode="wait">
                {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-500 text-sm flex items-center gap-2">
                        <AlertTriangle size={16} /> {error}
                    </motion.p>
                )}

                {result && result.safe && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-start gap-4">
                        <ShieldCheck size={28} className="text-green-500 shrink-0" />
                        <div>
                            <p className="font-bold text-green-500">No Breaches Found!</p>
                            <p className="text-sm text-muted-foreground">Good news! Your email was not found in any recorded dark web databases or malicious leaks.</p>
                        </div>
                    </motion.div>
                )}

                {result && result.breaches && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 mb-4">
                            <ShieldAlert size={28} className="text-red-500 shrink-0 mt-1" />
                            <div>
                                <p className="font-bold text-red-500 text-lg">Oh no! Pwned!</p>
                                <p className="text-sm text-red-400 mt-1">
                                    Your email appeared in <span className="font-black text-white px-1">{result.breaches.length}</span> data breaches. You should change the password for any related services immediately.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {result.breaches.map((breach, idx) => (
                                <div key={idx} className="p-3 sm:p-5 bg-black/20 dark:bg-white/5 border border-red-500/30 rounded-xl relative overflow-hidden flex flex-col sm:flex-row gap-3 sm:gap-4 transition-all hover:bg-black/30">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                                    {breach.logo && (
                                        <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg p-1 hidden sm:block shadow-sm">
                                            <img src={breach.logo} alt={breach.breach} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none' }} />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-2">
                                            <div>
                                                <h4 className="font-bold text-lg tracking-tight">{breach.breach}</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{breach.domain || 'Compromised Service'}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-1 flex items-center gap-1 rounded-md whitespace-nowrap">
                                                    Breached: {breach.xposed_date ? breach.xposed_date : 'Unknown Date'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <p className="text-xs text-slate-300 dark:text-slate-400 mt-3 mb-4 leading-relaxed">
                                            {breach.details || 'No detailed description available for this incident.'}
                                        </p>
                                        
                                        <div className="bg-black/40 dark:bg-black/20 p-3 rounded-xl border border-white/5">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <AlertTriangle size={12} /> Compromised Data
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {breach.xposed_data ? breach.xposed_data.split(';').map((dataItem, i) => (
                                                    <span key={i} className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 px-2 py-0.5 rounded transition-colors whitespace-nowrap">
                                                        {dataItem.trim()}
                                                    </span>
                                                )) : (
                                                    <span className="text-[10px] text-muted-foreground">Unknown data</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground opacity-60 mt-4 text-center">Data provided via public OSINT/Breach APIs.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LiveBreachScanner;
