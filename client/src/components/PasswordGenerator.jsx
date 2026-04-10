import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, RefreshCw, Check, Zap } from 'lucide-react';
import PasswordStrength from './PasswordStrength';
import clsx from 'clsx';

const Toggle = ({ label, value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={clsx(
      'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all border',
      value
        ? 'bg-primary/15 border-primary/40 text-primary'
        : 'bg-black/5 dark:bg-white/5 border-transparent text-muted-foreground hover:text-foreground'
    )}
  >
    <div className={clsx('w-2.5 h-2.5 rounded-full transition-colors', value ? 'bg-primary' : 'bg-muted-foreground/30')} />
    {label}
  </button>
);

export default function PasswordGenerator({ onUse, onClose }) {
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    let charset = '';
    let lChars = 'abcdefghijklmnopqrstuvwxyz';
    let uChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let nChars = '0123456789';
    let sChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (excludeAmbiguous) {
      lChars = lChars.replace(/[ilo]/g, '');
      uChars = uChars.replace(/[ILO]/g, '');
      nChars = nChars.replace(/[01]/g, '');
      // Symbols usually don't have many ambiguous ones vs letters but sometimes | or .
    }

    if (lower) charset += lChars;
    if (upper) charset += uChars;
    if (numbers) charset += nChars;
    if (symbols) charset += sChars;

    if (!charset) return;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)];
    }
    setPassword(result);
  };

  useEffect(() => { generate(); }, [length, upper, lower, numbers, symbols, excludeAmbiguous]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass-panel border border-border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/50 via-green-400 to-green-500/50" />

        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Zap size={22} className="text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Password Generator</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Password Display */}
          <div className="bg-black/5 dark:bg-black/30 rounded-2xl p-4 flex items-center gap-3 mb-2 border border-white/5 min-h-[64px]">
            <p className="flex-1 font-mono text-base tracking-widest break-all text-foreground select-all">{password}</p>
            <div className="flex gap-1 shrink-0">
              <motion.button whileTap={{ scale: 0.85 }} onClick={generate}
                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" title="Regenerate">
                <RefreshCw size={17} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={handleCopy}
                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" title="Copy">
                {copied ? <Check size={17} className="text-green-400" /> : <Copy size={17} />}
              </motion.button>
            </div>
          </div>

          {/* Strength Bar */}
          <div className="mb-4">
            <PasswordStrength password={password} />
          </div>

          {/* Length Slider */}
          <div className="mb-5 pt-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Length</label>
              <span className="text-sm font-bold bg-primary/15 text-primary px-2.5 py-0.5 rounded-lg">{length}</span>
            </div>
            <input type="range" min="8" max="64" value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-black/10 dark:bg-white/10" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>8</span><span>64</span></div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-2 mb-7">
            <Toggle label="Uppercase" value={upper} onChange={setUpper} />
            <Toggle label="Lowercase" value={lower} onChange={setLower} />
            <Toggle label="Numbers" value={numbers} onChange={setNumbers} />
            <Toggle label="Symbols" value={symbols} onChange={setSymbols} />
            <Toggle label="No Ambi" value={excludeAmbiguous} onChange={setExcludeAmbiguous} />
          </div>

          <div className="flex gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleCopy}
              className="flex-1 py-3 rounded-xl font-semibold border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm">
              {copied ? '✓ Copied!' : 'Copy'}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => onUse(password)}
              className="flex-1 py-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              Use Password
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
