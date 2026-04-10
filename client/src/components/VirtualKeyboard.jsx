import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Delete, RefreshCcw } from 'lucide-react';

const VirtualKeyboard = ({ onKeyPress, onBackspace, onClose }) => {
    const defaultChars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%&*_-=+'.split('');
    const [keys, setKeys] = useState([]);

    const shuffleKeys = () => {
        const shuffled = [...defaultChars];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setKeys(shuffled);
    };

    useEffect(() => {
        shuffleKeys();
    }, []);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-border/50 shadow-inner mt-4"
        >
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    Secure Input Active
                </span>
                <button type="button" onClick={shuffleKeys} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-[10px] font-bold uppercase" title="Shuffle Layout">
                    <RefreshCcw size={12} /> Shuffle
                </button>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
                {keys.map((char, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={(e) => { e.preventDefault(); onKeyPress(char); }}
                        className="w-8 h-8 flex items-center justify-center bg-background rounded-lg border border-border/50 shadow-sm text-sm font-mono font-bold hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
                    >
                        {char}
                    </button>
                ))}
            </div>
            <div className="flex justify-between gap-2 mt-3">
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); if (onClose) onClose(); }}
                    className="flex-1 py-2 bg-background border border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-black/5 transition-colors"
                >
                    Close Pad
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onBackspace(); }}
                    className="flex-1 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500/20 transition-colors"
                >
                    <Delete size={18} />
                </button>
            </div>
            <p className="text-[8px] text-center mt-3 text-muted-foreground opacity-70">
                Bypasses hardware/software keyloggers by injecting characters directly into state memory via pointer events.
            </p>
        </motion.div>
    );
};

export default VirtualKeyboard;
