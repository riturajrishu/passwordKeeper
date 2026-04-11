import React, { useState } from 'react';
import useAuthStore from '../store/useAuthStore';
import { deriveKeys } from '../lib/crypto';
import { verifyMasterPassword, logoutUser } from '../lib/api';
import { Lock, Unlock, KeyRound, AlertCircle, Keyboard, Loader2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { recoverSecret } from '../lib/shamir';
import useToastStore from '../store/useToastStore';
import VirtualKeyboard from '../components/VirtualKeyboard';

export default function MasterPasswordPrompt() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryShares, setRecoveryShares] = useState(['', '', '']);
  const [recoveredMasterPassword, setRecoveredMasterPassword] = useState('');
  const user = useAuthStore(s => s.user);
    const setMasterKey = useAuthStore(s => s.setMasterKey);
    const logout = useAuthStore(s => s.logout);
  const addToast = useToastStore(s => s.addToast);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 8) {
      setError('Master password must be at least 8 characters long.');
      triggerShake();
      setLoading(false);
      return;
    }

    try {
      // Derive the strong keys from master password + email as salt
      const { authKey, encKey } = deriveKeys(password, user.email);
      
      // Verify the master password with the server
      await verifyMasterPassword(authKey);
      
      // If success, proceed to unlock
      setMasterKey(encKey);
      addToast('Vault unlocked secondary layer active', 'success');
    } catch (err) {
      setError(err.message || 'Incorrect master password');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser(); // Clears the httpOnly cookie on the server
    } catch {
      // Ignore network errors on logout
    } finally {
      logout(); // Clear client state
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleRecover = () => {
    const validShares = recoveryShares.map(s => s.trim()).filter(Boolean);
    if(validShares.length < 3) return addToast("You need exactly 3 shares", "warning");
    try {
        const secret = recoverSecret(validShares);
        setPassword(secret);
        setRecoveredMasterPassword(secret);
        addToast("Master password reconstructed successfully!", "success");
        // Clear shares but keep UI open to show the recovered password
        setRecoveryShares(['', '', '']);
    } catch(e) {
        addToast("Failed to recover. Invalid or corrupted shares.", "error");
        triggerShake();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Decorative Blob */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-primary/10 rounded-full blur-[100px] -z-10"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : { opacity: 1, y: 0 }}
        transition={isShaking ? { duration: 0.4 } : { duration: 0.5, ease: 'easeOut' }}
        className="glass-panel p-6 md:p-10 rounded-3xl w-full max-w-md flex flex-col items-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6 shadow-inner"
        >
          <KeyRound size={40} className="drop-shadow-lg" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold mb-2 text-center text-foreground tracking-tight"
        >
          Unlock Your Vault
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground text-center mb-8 text-sm md:text-base px-2"
        >
          Enter your master password to decrypt your saved credentials.
          <span className="block mt-1 text-xs opacity-70">
            This password is never sent to the server.
          </span>
        </motion.p>

        <form onSubmit={handleUnlock} className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-4"
          >
            <input
              id="master-password"
              type="password"
              placeholder="Master Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-center tracking-[0.2em] font-mono placeholder:tracking-normal placeholder:font-sans"
              autoFocus
              autoComplete="current-password"
            />
            <div className="flex justify-end mt-2">
              <button 
                type="button" 
                onClick={() => setShowKeyboard(!showKeyboard)}
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
              >
                <Keyboard size={12} /> {showKeyboard ? 'Hide' : 'Use Secure Pad'}
              </button>
            </div>
          </motion.div>

          {showKeyboard && (
            <VirtualKeyboard 
               onKeyPress={(char) => setPassword(prev => prev + char)} 
               onBackspace={() => setPassword(prev => prev.slice(0, -1))}
               onClose={() => setShowKeyboard(false)}
            />
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <p className="text-red-500 text-sm flex items-center justify-center gap-1.5 bg-red-500/10 py-2 rounded-lg">
                  <AlertCircle size={16} /> {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Unlock size={20} />}
            {loading ? 'Verifying...' : 'Decrypt Vault'}
          </motion.button>

          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.7 }}
            className="flex justify-center items-center mt-6"
          >
              <button
                type="button"
                onClick={() => setShowRecovery(!showRecovery)}
                className="text-xs font-bold uppercase tracking-widest text-sky-500/70 hover:text-sky-500 transition-colors"
              >
                {showRecovery ? 'Hide Recovery Tool' : 'Recover Master Password'}
              </button>
          </motion.div>

          <AnimatePresence>
            {showRecovery && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden space-y-4 pt-6 border-t border-border/50"
              >
                <div className="text-left">
                     <h3 className="font-bold text-sm text-sky-500 uppercase tracking-widest mb-2">Recover Vault Access</h3>
                     <p className="text-xs text-muted-foreground leading-relaxed">
                         Paste any 3 trusted fragments below to mathematically reconstruct the master password. Done 100% locally offline.
                     </p>
                </div>
                
                {recoveryShares.map((val, idx) => (
                    <input 
                        key={idx}
                        value={val}
                        onChange={e => {
                            const newShares = [...recoveryShares];
                            newShares[idx] = e.target.value;
                            setRecoveryShares(newShares);
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-sky-500/40 focus:outline-none text-xs font-mono placeholder:font-sans" 
                        placeholder={`Paste Share Fragment ${idx+1}`} 
                    />
                ))}

                <button 
                    type="button"
                    onClick={handleRecover} 
                    className="bg-sky-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-md shadow-sky-500/20 w-full hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 mt-2"
                >
                    <Shield size={18} /> Reconstruct Password
                </button>

                {recoveredMasterPassword && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 bg-green-500/10 border border-green-500/30 rounded-2xl text-center mt-4"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 mb-1">Recovered Master Password Auto-filled</p>
                        <p className="font-mono text-lg font-bold text-green-500 bg-background/50 px-3 py-1 inline-block rounded-xl select-all">
                            {recoveredMasterPassword}
                        </p>
                    </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-sm text-muted-foreground hover:text-red-500 transition-colors"
          onClick={handleSignOut}
        >
          Switch Account / Sign Out
        </motion.button>
      </motion.div>
    </div>
  );
}
