import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ShieldAlert, ShieldCheck, Search, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import useToastStore from '../store/useToastStore';
import clsx from 'clsx';

const PhishingAnalyzer = () => {
    const addToast = useToastStore(s => s.addToast);
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);

    const analyzeContent = () => {
        if (!input.trim()) return addToast("Please paste an email or URL to analyze.", "warning");
        
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);

        // Simulation Interval for UI
        const interval = setInterval(() => {
            setProgress(prev => Math.min(prev + (Math.random() * 15), 100));
        }, 300);

        setTimeout(() => {
            clearInterval(interval);
            setProgress(100);
            
            // Mock AI Rules Engine
            const text = input.toLowerCase();
            let score = 100;
            const flags = [];

            if (text.includes('urgent') || text.includes('immediate action') || text.includes('suspended')) {
                score -= 30;
                flags.push({ type: 'high', text: 'Contains urgent language typical of social engineering.' });
            }
            if (text.includes('http://') && !text.includes('https://')) {
                score -= 20;
                flags.push({ type: 'high', text: 'Unsecured HTTP link detected.' });
            }
            if (text.includes('verify your account') || text.includes('update payment')) {
                score -= 25;
                flags.push({ type: 'critical', text: 'Requests sensitive account verification.' });
            }
            if (text.includes('dear customer') || text.includes('dear user')) {
                score -= 10;
                flags.push({ type: 'low', text: 'Generic greeting. Valid companies usually use your name.' });
            }

            // Random variance to make it feel real
            if (score === 100 && text.length > 20) {
                if (Math.random() > 0.5) {
                    score -= 5;
                    flags.push({ type: 'low', text: 'Slightly unusual sender pattern detected.' });
                }
            }

            setResult({
                score: Math.max(0, score),
                riskLable: score < 50 ? 'CRITICAL RISK' : score < 80 ? 'SUSPICIOUS' : 'SAFE',
                flags: flags.length ? flags : [{ type: 'safe', text: 'No malicious signatures detected in text.' }]
            });
            setIsAnalyzing(false);
        }, 3000);
    };

    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                    <Bot className="text-primary" size={32} /> AI Phishing Analyzer
                </h1>
                <p className="text-muted-foreground text-sm">Paste suspicious emails, SMS texts, or URLs. Our heuristic engine will evaluate the risk of social engineering.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="glass-panel p-6 rounded-3xl border border-border flex flex-col h-full">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 block">Message Content / URL</label>
                    <textarea 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Paste the suspicious content here..."
                        className="w-full h-64 px-5 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none custom-scrollbar mb-4"
                        disabled={isAnalyzing}
                    />
                    
                    {isAnalyzing ? (
                        <div className="mt-auto space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-primary">
                                <span>Scanning Heuristics...</span>
                                <span>{Math.floor(progress)}%</span>
                            </div>
                            <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-primary"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <motion.button 
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={analyzeContent}
                            disabled={!input.trim()}
                            className="mt-auto w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Search size={18} /> Analyze Content
                        </motion.button>
                    )}
                </div>

                {/* Results Section */}
                <div className="glass-panel p-6 rounded-3xl border border-border relative overflow-hidden flex flex-col">
                    {!result && !isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none p-10 text-center">
                            <Bot size={64} className="mb-4 text-muted-foreground" />
                            <p className="font-bold text-lg">Awaiting Input</p>
                            <p className="text-sm">The Deep Learning engine is ready to scan.</p>
                        </div>
                    )}
                    
                    {isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 transition-all">
                            <Loader2 size={48} className="animate-spin text-primary mb-4" />
                            <p className="font-mono text-sm tracking-widest text-primary animate-pulse">Running Neural Analysis...</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {result && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full z-20 relative">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className={clsx("w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl", result.score < 50 ? "border-red-500 text-red-500 bg-red-500/10" : result.score < 80 ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" : "border-green-500 text-green-500 bg-green-500/10")}>
                                        <span className="text-2xl font-black">{result.score}</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Safety Verdict</p>
                                        <h2 className={clsx("text-2xl font-black tracking-tight", result.score < 50 ? "text-red-500" : result.score < 80 ? "text-yellow-500" : "text-green-500")}>
                                            {result.riskLable}
                                        </h2>
                                    </div>
                                </div>

                                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Detection Flags</h3>
                                    {result.flags.map((flag, idx) => (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                                            key={idx} 
                                            className={clsx("p-4 rounded-2xl flex items-start gap-3 border", flag.type === 'critical' || flag.type === 'high' ? "bg-red-500/5 border-red-500/20 text-red-500" : flag.type === 'safe' ? "bg-green-500/5 border-green-500/20 text-green-500" : "bg-yellow-500/5 border-yellow-500/20 text-yellow-500")}
                                        >
                                            {flag.type === 'safe' ? <ShieldCheck size={18} className="shrink-0 mt-0.5" /> : flag.type === 'critical' ? <ShieldAlert size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                                            <p className="text-sm font-semibold">{flag.text}</p>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default PhishingAnalyzer;
