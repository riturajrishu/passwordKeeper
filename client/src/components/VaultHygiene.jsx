import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, AlertTriangle, ShieldCheck, Zap, KeyRound, AlertOctagon } from 'lucide-react';
import clsx from 'clsx';

function getDaysOld(dateStr) {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function calculateStrength(pwd) {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length > 7) s++;
    if (pwd.length > 11) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
}

export default function VaultHygiene({ items }) {
    const hygieneData = useMemo(() => {
        if (!items || items.length === 0) return null;

        const logins = items.filter(i => i.itemType === 'LOGIN' && i.password);
        if (logins.length === 0) return null;

        let weakCount = 0;
        let oldCount = 0;
        let compromisedCount = 0; // if breach logic passed from above, but we don't have it direct here so let's skip for simple. Wait, we can track re-used!
        
        const pwdCounts = {};
        let duplicateCount = 0;

        logins.forEach(login => {
            const pwd = login.password;
            
            // Check Strength
            if (calculateStrength(pwd) < 3) weakCount++;

            // Check Age
            // Use updatedAt or fallback to createdAt
            const age = getDaysOld(login.updatedAt || login.createdAt);
            if (age > 90) oldCount++;

            // Check reuse
            pwdCounts[pwd] = (pwdCounts[pwd] || 0) + 1;
        });

        // Calculate exact duplicates
        Object.values(pwdCounts).forEach(count => {
            if (count > 1) duplicateCount += (count - 1); // how many extra items share it
        });

        const maxScore = 100;
        let deductions = 0;
        
        // Penetration testing weighted logic
        deductions += (weakCount * 15);
        deductions += (duplicateCount * 20);
        deductions += (oldCount * 5);

        const score = Math.max(0, maxScore - deductions);
        
        let insight = "";
        let statusColor = "";
        let StatusIcon = ShieldCheck;

        if (score >= 90) {
            insight = "Your vault is in perfect cryptographic shape!";
            statusColor = "text-green-500";
            StatusIcon = ShieldCheck;
        } else if (score >= 60) {
            insight = "Your vault needs some cleaning. Address duplicates and weak keys.";
            statusColor = "text-yellow-500";
            StatusIcon = AlertTriangle;
        } else {
            insight = "Critical Security Warning! Highly vulnerable logic detected.";
            statusColor = "text-red-500";
            StatusIcon = AlertOctagon;
        }

        return { score, weakCount, duplicateCount, oldCount, insight, statusColor, StatusIcon };

    }, [items]);

    if (!hygieneData) return null;

    const { score, weakCount, duplicateCount, oldCount, insight, statusColor, StatusIcon } = hygieneData;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20, rotateX: -10 }} 
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            className="mb-8 w-full perspective-1000"
        >
            <div className="glass-panel p-6 sm:p-8 rounded-[2rem] border border-white/10 dark:border-white/5 relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-background via-background to-primary/5">
                
                {/* AI Glow Sphere */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                {/* Score Circular Meter */}
                <div className="relative shrink-0 w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        {/* Track */}
                        <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="8" fill="none" className="text-black/5 dark:text-white/5" />
                        {/* Progress */}
                        <circle 
                            cx="64" cy="64" r="54" 
                            stroke="currentColor" 
                            strokeWidth="8" 
                            fill="none" 
                            className={clsx("transition-all duration-1500 ease-out", statusColor)}
                            strokeDasharray="339.29" 
                            strokeDashoffset={339.29 * (1 - score / 100)} 
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={clsx("text-3xl font-black tracking-tighter", statusColor)}>{score}</span>
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Health</span>
                    </div>
                </div>

                {/* Info Text */}
                <div className="flex-1 space-y-4 text-center md:text-left z-10">
                    <div>
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                            <Zap size={14} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Keeper X AI Analysis</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{insight}</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-black/5 dark:bg-white/5 border border-border/50 rounded-xl p-3 flex flex-col item-center md:items-start text-center md:text-left">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Re-used</span>
                            <span className={clsx("text-lg font-black", duplicateCount > 0 ? "text-yellow-500" : "text-green-500")}>{duplicateCount} Pwds</span>
                        </div>
                        <div className="bg-black/5 dark:bg-white/5 border border-border/50 rounded-xl p-3 flex flex-col item-center md:items-start text-center md:text-left">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Weak</span>
                            <span className={clsx("text-lg font-black", weakCount > 0 ? "text-red-500" : "text-green-500")}>{weakCount} Pwds</span>
                        </div>
                        <div className="bg-black/5 dark:bg-white/5 border border-border/50 rounded-xl p-3 flex flex-col item-center md:items-start text-center md:text-left">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">&gt; 90 Days Old</span>
                            <span className={clsx("text-lg font-black", oldCount > 0 ? "text-orange-500" : "text-green-500")}>{oldCount} Pwds</span>
                        </div>
                    </div>
                </div>

            </div>
        </motion.div>
    );
}
