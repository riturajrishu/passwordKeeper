import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ShieldAlert, ShieldCheck, Search, Loader2, AlertTriangle, Sparkles, FileWarning, RotateCcw, Clipboard, Info } from 'lucide-react';
import useToastStore from '../store/useToastStore';
import { analyzePhishingData } from '../lib/api';
import clsx from 'clsx';

const RISK_CONFIG = {
    'CRITICAL RISK': { color: 'red', gradient: 'from-red-500/20 to-red-900/10', border: 'border-red-500/40', text: 'text-red-500', bg: 'bg-red-500' },
    'HIGH RISK':     { color: 'orange', gradient: 'from-orange-500/20 to-orange-900/10', border: 'border-orange-500/40', text: 'text-orange-500', bg: 'bg-orange-500' },
    'SUSPICIOUS':    { color: 'yellow', gradient: 'from-yellow-500/20 to-yellow-900/10', border: 'border-yellow-500/40', text: 'text-yellow-500', bg: 'bg-yellow-500' },
    'LOW RISK':      { color: 'blue', gradient: 'from-blue-500/20 to-blue-900/10', border: 'border-blue-500/40', text: 'text-blue-500', bg: 'bg-blue-500' },
    'SAFE':          { color: 'green', gradient: 'from-green-500/20 to-green-900/10', border: 'border-green-500/40', text: 'text-green-500', bg: 'bg-green-500' },
};

const FLAG_STYLES = {
    critical: 'bg-red-500/5 border-red-500/20 text-red-500',
    high:     'bg-orange-500/5 border-orange-500/20 text-orange-500',
    medium:   'bg-yellow-500/5 border-yellow-500/20 text-yellow-500',
    low:      'bg-blue-500/5 border-blue-500/20 text-blue-400',
    safe:     'bg-green-500/5 border-green-500/20 text-green-500',
};

const FLAG_ICON = {
    critical: ShieldAlert,
    high: FileWarning,
    medium: AlertTriangle,
    low: Info,
    safe: ShieldCheck,
};

const PhishingAnalyzer = () => {
    const addToast = useToastStore(s => s.addToast);
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);

    const analyzeContent = async () => {
        if (!input.trim()) return addToast("Please paste an email or URL to analyze.", "warning");
        
        setIsAnalyzing(true);
        setResult(null);
        setProgress(0);

        const interval = setInterval(() => {
            setProgress(prev => prev >= 92 ? 92 : prev + (Math.random() * 8));
        }, 400);

        try {
            const apiResponse = await analyzePhishingData(input);
            clearInterval(interval);
            setProgress(100);

            if (apiResponse.success && apiResponse.data) {
                setResult(apiResponse.data);
            } else {
                addToast("Failed to interpret AI response.", "error");
            }
        } catch (error) {
            clearInterval(interval);
            setProgress(0);
            addToast(error.message || "Analysis failed. Check your connection.", "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) setInput(text);
        } catch {
            addToast("Unable to read clipboard.", "warning");
        }
    };

    const resetAnalyzer = () => {
        setInput('');
        setResult(null);
        setProgress(0);
    };

    const riskStyle = result ? (RISK_CONFIG[result.riskLabel] || RISK_CONFIG['SUSPICIOUS']) : null;

    return (
        <div className="p-3 sm:p-4 lg:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-8">
            <header>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mb-2 flex items-center gap-2 sm:gap-3">
                    <Sparkles className="text-primary shrink-0" size={24} /> AI Phishing Analyzer
                </h1>
                <p className="text-muted-foreground text-sm">Paste suspicious emails, SMS texts, or URLs. Powered by <span className="font-semibold text-primary">Gemini 2.5 Flash</span> deep analysis.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">
                {/* ── Input Panel ─────────────────────────────────────── */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Message Content / URL</label>
                        <button onClick={handlePaste} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                            <Clipboard size={12} /> Paste
                        </button>
                    </div>
                    <textarea 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Paste the suspicious content here..."
                        className="w-full h-40 sm:h-64 px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-black/5 dark:bg-white/5 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none custom-scrollbar mb-3 sm:mb-4"
                        disabled={isAnalyzing}
                    />
                    
                    {isAnalyzing ? (
                        <div className="mt-auto space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-primary">
                                <span>Gemini AI Analyzing...</span>
                                <span>{Math.floor(progress)}%</span>
                            </div>
                            <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-primary rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="mt-auto flex gap-2">
                            <motion.button 
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={analyzeContent}
                                disabled={!input.trim()}
                                className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                            >
                                <Search size={18} /> Analyze
                            </motion.button>
                            {result && (
                                <motion.button 
                                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={resetAnalyzer}
                                    className="px-4 py-3.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                                >
                                    <RotateCcw size={18} />
                                </motion.button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Results Panel ───────────────────────────────────── */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border relative overflow-hidden flex flex-col min-h-[300px] sm:min-h-0">
                    {!result && !isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none p-10 text-center">
                            <Bot size={56} className="mb-4 text-muted-foreground" />
                            <p className="font-bold text-lg">Awaiting Input</p>
                            <p className="text-sm">Gemini 2.5 Flash is ready to scan.</p>
                        </div>
                    )}
                    
                    {isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 transition-all">
                            <Loader2 size={48} className="animate-spin text-primary mb-4" />
                            <p className="font-mono text-sm tracking-widest text-primary animate-pulse">Running Deep Analysis...</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {result && (
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full z-20 relative gap-4 sm:gap-5">
                                
                                {/* Score + Verdict Header */}
                                <div className={clsx("p-4 sm:p-5 rounded-2xl border bg-gradient-to-br flex items-center gap-3 sm:gap-4", riskStyle.gradient, riskStyle.border)}>
                                    <div className={clsx("w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-[3px] shadow-lg shrink-0", riskStyle.border, riskStyle.text, `${riskStyle.bg}/10`)}>
                                        <span className="text-lg sm:text-xl font-black">{result.score}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <h2 className={clsx("text-lg sm:text-xl font-black tracking-tight", riskStyle.text)}>
                                                {result.riskLabel}
                                            </h2>
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                                                ✦ Gemini AI
                                            </span>
                                        </div>
                                        {result.summary && (
                                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{result.summary}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Detection Flags */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Detection Flags</h3>
                                    {result.flags?.map((flag, idx) => {
                                        const IconComponent = FLAG_ICON[flag.type] || AlertTriangle;
                                        return (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
                                                key={idx} 
                                                className={clsx("p-3 sm:p-3.5 rounded-xl flex items-start gap-2.5 border", FLAG_STYLES[flag.type] || FLAG_STYLES.medium)}
                                            >
                                                <IconComponent size={16} className="shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    {flag.category && (
                                                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 block mb-0.5">{flag.category}</span>
                                                    )}
                                                    <p className="text-xs sm:text-sm font-semibold leading-snug">{flag.text}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Recommendation */}
                                {result.recommendation && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                                        className="p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5"
                                    >
                                        <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary block mb-0.5">AI Recommendation</span>
                                            <p className="text-xs sm:text-sm text-foreground/80 font-medium leading-snug">{result.recommendation}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default PhishingAnalyzer;
