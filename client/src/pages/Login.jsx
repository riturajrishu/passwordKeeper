import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { loginUser, registerUser, getHint, resetPassword as apiResetPassword, API_URL } from '../lib/api';
import { deriveKeys, generateRecoveryKey } from '../lib/crypto';
import { splitSecret } from '../lib/shamir';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import {
    ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight,
    UserPlus, LogIn, Loader2, Shield, User, Phone,
    KeyRound, AlertCircle, Copy, Check, ChevronLeft, Keyboard
} from 'lucide-react';
import clsx from 'clsx';
import VirtualKeyboard from '../components/VirtualKeyboard';
import { startAuthentication } from '@simplewebauthn/browser';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [hint, setHint] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showMasterPassword, setShowMasterPassword] = useState(false);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Recovery System states
    const [recoveryKey, setRecoveryKey] = useState('');
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [forgotMode, setForgotMode] = useState(null); // 'email', 'hint', 'reset'
    const [resetEmail, setResetEmail] = useState('');
    const [foundHint, setFoundHint] = useState('');
    const [userRecoveryKey, setUserRecoveryKey] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [copied, setCopied] = useState(false);
    const [generatedShares, setGeneratedShares] = useState([]);
    const [copiedShareIndex, setCopiedShareIndex] = useState(-1);

    const navigate = useNavigate();
    const setUser = useAuthStore(s => s.setUser);
    const setMasterKey = useAuthStore(s => s.setMasterKey);
    const addToast = useToastStore(s => s.addToast);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (!email.includes('@')) throw new Error("Please enter a valid email");
            if (loginPassword.length < 8) throw new Error("Login password must be at least 8 chars");
            if (!isLogin && masterPassword.length < 8) throw new Error("Master password must be at least 8 chars");

            let data;
            if (isLogin) {
                const { authKey } = deriveKeys(loginPassword, email); // V1 fallback hash derivation
                data = await loginUser(email, loginPassword, authKey);
                addToast(`Welcome back, ${data.name || email.split('@')[0]}`, 'success');
                // No setMasterKey here, User is prompted upon entering the app
                setUser({
                    uid: data.uid,
                    email: data.email,
                    name: data.name,
                    phoneNumber: data.phoneNumber,
                    role: data.role
                });
                navigate('/');
            } else {
                const { authKey, encKey } = deriveKeys(masterPassword, email);
                const masterAuthHash = authKey; // We use authKey to communicate with server

                const newRecoveryKey = generateRecoveryKey();
                // To keep ZK, we must hash the recovery key on server, but we show it to user once.
                data = await registerUser(name, email, phone, loginPassword, masterAuthHash, hint, newRecoveryKey);
                
                setMasterKey(encKey); // Save EncKey for the session since we have the master password
                setRecoveryKey(newRecoveryKey);

                try {
                    const shares = splitSecret(masterPassword, 5, 3);
                    setGeneratedShares(shares);
                } catch(e) {
                    console.error("Failed to generate shares", e);
                }

                setShowRecoveryModal(true); // Modal will navigate to home when closed
                
                // We don't navigate yet, user must see recovery key
                setUser({
                    uid: data.uid,
                    email: data.email,
                    name: data.name,
                    phoneNumber: data.phoneNumber,
                    role: data.role
                });
            }
        } catch (err) {
            setError(err.message);
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGetHint = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await getHint(resetEmail);
            setFoundHint(data.hint);
            setForgotMode('hint');
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) return addToast("Passwords do not match", "error");
        if (newPassword.length < 8) return addToast("Min 8 characters", "error");
        
        setLoading(true);
        try {
            await apiResetPassword(resetEmail, userRecoveryKey, newPassword);
            addToast("Account Login Password reset successful! Please login.", "success");
            setForgotMode(null);
            setEmail(resetEmail);
            setLoginPassword('');
            setIsLogin(true);
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        if (!email) return addToast("Please enter your email first", "warning");
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/passkeys/generate-auth-options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.message || 'Passkey login failed');
            }

            const options = await resp.json();
            const asseResp = await startAuthentication({ optionsJSON: options });

            const verifyResp = await fetch(`${API_URL}/passkeys/verify-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, response: asseResp }),
                credentials: 'include'
            });

            if (verifyResp.ok) {
                const data = await verifyResp.json();
                if (data.verified) {
                    addToast(`Welcome back! Passkey authenticated.`, 'success');
                    
                    // NOTE: Passkeys bypass the Master Password, which means we CANNOT derive the vault decryption key (encKey).
                    // In a true Zero-Knowledge system, passkeys should decrypt a securely stored wrapped master key, or they can only be used for 2FA.
                    // For this simplified demo/phase, we'll log the user in, but they will need to type their master password once to decrypt the vault.
                    setUser({
                        uid: data.uid,
                        email: data.email,
                        name: data.name,
                        phoneNumber: data.phoneNumber,
                        role: data.role
                    });
                    navigate('/'); // Go to dashboard, but prompt for Master Key there if missing
                }
            } else {
                throw new Error('Passkey verification failed');
            }
        } catch (error) {
            console.error(error);
            if (error.name === 'NotAllowedError') {
                addToast('Passkey login cancelled', 'info');
            } else {
                addToast(error.message || 'Passkey authentication failed', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const copyRecoveryKey = () => {
        navigator.clipboard.writeText(recoveryKey);
        setCopied(true);
        addToast("Recovery Key copied to clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
    };

    const copyShare = (share, idx) => {
        navigator.clipboard.writeText(share);
        setCopiedShareIndex(idx);
        addToast(`Fragment #${idx+1} copied!`, "success");
        setTimeout(() => setCopiedShareIndex(-1), 2000);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] relative p-4 overflow-hidden selection:bg-primary/30">

            {/* Dynamic Background Mesh */}
            <div className="absolute inset-0 z-0">
                <motion.div
                    animate={{
                        x: [0, 40, 0],
                        y: [0, -40, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        x: [0, -30, 0],
                        y: [0, 50, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[140px]"
                />
                <div className="absolute inset-0 bg-black/20 opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-[440px] z-10"
            >
                {/* Logo Section */}
                <div className="flex flex-col items-center mb-8">
                    <motion.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                        className="w-16 h-16 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20 mb-4"
                    >
                        <ShieldCheck size={36} className="text-primary" />
                    </motion.div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
                        Password <span className="text-primary">Keeper X</span>
                    </h1>
                    <p className="text-slate-400 text-sm font-medium tracking-wide border-b border-primary/20 pb-1">Zero-Knowledge Vault</p>
                </div>

                {/* Main Auth Card */}
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                    <AnimatePresence mode="wait">
                        {forgotMode ? (
                            <motion.div
                                key="forgot"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <button 
                                    onClick={() => setForgotMode(null)}
                                    className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest mb-4"
                                >
                                    <ChevronLeft size={16} /> Back to Login
                                </button>
                                
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-white mb-2">Account Recovery</h2>
                                    <p className="text-slate-400 text-sm">
                                        {forgotMode === 'email' ? "Enter your email to find your hint." : 
                                         forgotMode === 'hint' ? "Review your hint. If you still can't remember, use your Recovery Key." :
                                         "Reset your Account Login Password using your Recovery Key."}
                                    </p>
                                </div>

                                {forgotMode === 'email' && (
                                    <form onSubmit={handleGetHint} className="space-y-4">
                                        <div className="space-y-1">
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                                                    <Mail size={18} />
                                                </div>
                                                <input
                                                    type="email"
                                                    value={resetEmail}
                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                    placeholder="Enter your email"
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            type="submit" disabled={loading}
                                            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={20} /> : "Find My Hint"}
                                        </button>
                                    </form>
                                )}

                                {forgotMode === 'hint' && (
                                    <div className="space-y-6">
                                        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Your Password Hint</p>
                                            <p className="text-lg text-white font-medium italic">"{foundHint}"</p>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <button 
                                                onClick={() => setForgotMode(null)}
                                                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all text-sm"
                                            >
                                                I Remember Now
                                            </button>
                                            <button 
                                                onClick={() => setForgotMode('reset')}
                                                className="w-full py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl font-bold transition-all text-sm"
                                            >
                                                Still Locked? Reset Login Password
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {forgotMode === 'reset' && (
                                    <form onSubmit={handleResetPassword} className="space-y-4">
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={userRecoveryKey}
                                                onChange={(e) => setUserRecoveryKey(e.target.value.toUpperCase())}
                                                placeholder="XXXX-XXXX-XXXX"
                                                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold tracking-widest text-center"
                                                required
                                            />
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                                                    <Lock size={18} />
                                                </div>
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="New Account Login Password"
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm tracking-widest"
                                                    required
                                                />
                                            </div>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm New Password"
                                                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm tracking-widest"
                                                required
                                            />
                                        </div>
                                        <button 
                                            type="submit" disabled={loading}
                                            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={20} /> : "Reset Login Password"}
                                        </button>
                                        <p className="text-[10px] text-center text-blue-400 font-bold uppercase px-4 leading-relaxed mt-4">
                                            Note: This resets your Account Login Password. Your Vault Master Password remains unchanged.
                                        </p>
                                    </form>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key={isLogin ? 'login' : 'signup'}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.4, ease: "circOut" }}
                            >
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    {isLogin ? 'Welcome back' : 'Get started'}
                                </h2>
                                <p className="text-slate-400 text-sm">
                                    {isLogin
                                        ? 'Unlock your credentials with your master identity.'
                                        : 'Create your private vault today. It takes less than a minute.'}
                                </p>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-5">
                                {!isLogin && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 group-focus-within/input:text-primary transition-colors">
                                                    <User size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="Ritu Raj"
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                                                    required={!isLogin}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 group-focus-within/input:text-primary transition-colors">
                                                    <Phone size={18} />
                                                </div>
                                                <input
                                                    type="tel"
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    placeholder="+91 99999-00000"
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password Hint</label>
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 group-focus-within/input:text-primary transition-colors">
                                                    <AlertCircle size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={hint}
                                                    onChange={(e) => setHint(e.target.value)}
                                                    placeholder="Something to help you remember"
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                                                    required={!isLogin}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 group-focus-within/input:text-primary transition-colors">
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@example.com"
                                            className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                                            required
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                            {isLogin ? 'Login Password' : 'Account Login Password'}
                                        </label>
                                        {isLogin && (
                                            <button 
                                                type="button" 
                                                onClick={() => { setForgotMode('email'); setResetEmail(email); }}
                                                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tighter opacity-70"
                                            >
                                                Forgot Password?
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 group-focus-within/input:text-primary transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type={showLoginPassword ? "text" : "password"}
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            placeholder="••••••••••••"
                                            className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm tracking-widest"
                                            required
                                            autoComplete={isLogin ? "current-password" : "new-password"}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-white transition-colors"
                                        >
                                            {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {isLogin && (
                                    <div className="flex justify-end pt-1">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowKeyboard(!showKeyboard)}
                                            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 hover:text-primary transition-colors"
                                        >
                                            <Keyboard size={12} /> {showKeyboard ? 'Hide Pad' : 'Use Secure Pad'}
                                        </button>
                                    </div>
                                    )}
                                </div>

                                {showKeyboard && isLogin && (
                                    <VirtualKeyboard 
                                       onKeyPress={(char) => setLoginPassword(prev => prev + char)} 
                                       onBackspace={() => setLoginPassword(prev => prev.slice(0, -1))}
                                       onClose={() => setShowKeyboard(false)}
                                    />
                                )}

                                {!isLogin && (
                                <div className="space-y-1 mt-4">
                                    <label className="text-xs font-bold text-primary uppercase tracking-widest ml-1">Vault Master Password</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 group-focus-within/input:text-primary transition-colors">
                                            <Shield size={18} />
                                        </div>
                                        <input
                                            type={showMasterPassword ? "text" : "password"}
                                            value={masterPassword}
                                            onChange={(e) => setMasterPassword(e.target.value)}
                                            placeholder="••••••••••••"
                                            className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm tracking-widest border-primary/30"
                                            required
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowMasterPassword(!showMasterPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-white transition-colors"
                                        >
                                            {showMasterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowKeyboard(!showKeyboard)}
                                            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1 hover:text-primary transition-colors"
                                        >
                                            <Keyboard size={12} /> {showKeyboard ? 'Hide Pad' : 'Use Secure Pad'}
                                        </button>
                                    </div>
                                </div>
                                )}

                                {showKeyboard && !isLogin && (
                                    <VirtualKeyboard 
                                       onKeyPress={(char) => setMasterPassword(prev => prev + char)} 
                                       onBackspace={() => setMasterPassword(prev => prev.slice(0, -1))}
                                       onClose={() => setShowKeyboard(false)}
                                    />
                                )}

                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    type="submit"
                                    disabled={loading}
                                    className={clsx(
                                        "w-full py-4 rounded-2xl font-bold text-sm tracking-wide shadow-xl transition-all flex items-center justify-center gap-2",
                                        isLogin
                                            ? "bg-primary text-primary-foreground shadow-primary/20 hover:shadow-primary/40"
                                            : "bg-white text-black hover:bg-slate-100 shadow-white/10"
                                    )}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />)}
                                    {loading ? 'Authenticating...' : (isLogin ? 'Sign In to Vault' : 'Create My Vault')}
                                </motion.button>
                                
                                {isLogin && (
                                    <div className="pt-2">
                                        <div className="relative flex py-2 items-center">
                                            <div className="flex-grow border-t border-slate-800"></div>
                                            <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase tracking-widest">Or access with</span>
                                            <div className="flex-grow border-t border-slate-800"></div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handlePasskeyLogin}
                                            disabled={loading}
                                            className="w-full mt-2 py-3.5 rounded-2xl font-bold text-sm tracking-wide bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 border border-primary/20"
                                        >
                                            <KeyRound size={20} /> Sign in with Passkey / Biometrics
                                        </button>
                                    </div>
                                )}
                            </form>

                        </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom Toggle Link */}
                <div className="mt-8 text-center">
                    <p className="text-slate-400 text-sm font-medium">
                        {isLogin ? "Don't have an account yet?" : "Already protecting your data?"}
                        <button
                            onClick={() => { setIsLogin(!isLogin); setError(''); }}
                            className="ml-2 text-primary font-bold hover:underline"
                        >
                            {isLogin ? 'Join KeeperX' : 'Access Vault'}
                        </button>
                    </p>
                </div>

                {/* Trust & Security Info Section */}
                <div className="mt-8 p-4 rounded-3xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center sm:items-start gap-4 max-w-md mx-auto text-center sm:text-left shadow-2xl backdrop-blur-sm relative overflow-hidden group hover:border-primary/40 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                    <div className="relative p-3 bg-primary/10 rounded-2xl text-primary shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                        <Shield size={24} />
                    </div>
                    <div className="relative">
                        <p className="text-sm font-black text-white mb-1 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-2">
                            Zero-Knowledge Architecture
                        </p>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                            Your Master Password never leaves your device. Unbreakable encryption happens purely offline via AES-256 before synchronization.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Recovery Key Modal */}
            <AnimatePresence>
                {showRecoveryModal && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            className="w-full max-w-md bg-slate-900 border border-primary/30 rounded-[2.5rem] p-6 sm:p-8 md:p-10 text-center relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
                            
                            <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary shadow-2xl shadow-primary/20">
                                <KeyRound size={44} />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-2">Your Lifeline Credentials</h3>
                            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                Save these securely. They are the <span className="text-white font-bold">only way</span> to recover your data if you are locked out.
                            </p>

                            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 pb-2 text-left">
                                {/* Recovery Key Block */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                        <AlertCircle size={14} /> Account Recovery Key
                                    </h4>
                                    <p className="text-[11px] text-slate-400">Use this to reset your login password. Does NOT decrypt vault.</p>
                                    <div className="relative group cursor-pointer" onClick={copyRecoveryKey}>
                                        <div className="bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-base md:text-xl tracking-widest text-primary font-bold shadow-inner flex justify-between items-center break-all transition-colors group-hover:border-primary/50">
                                            {recoveryKey}
                                            {copied ? <Check size={20} className="text-green-400 shrink-0 ml-2" /> : <Copy size={20} className="text-primary/50 group-hover:text-primary transition-colors shrink-0 ml-2" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Cryptographic Fragments Block */}
                                {generatedShares.length > 0 && (
                                    <div className="space-y-3 pt-5 border-t border-white/10">
                                         <h4 className="text-xs font-bold uppercase tracking-widest text-orange-500 flex items-center gap-2">
                                            <Shield size={14} /> Vault Cryptographic Fragments
                                         </h4>
                                         <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm">
                                             Give them to trusted allies. <span className="text-orange-400 font-bold">Any 3 keys</span> can mathematically reconstruct your Vault Master Password offline.
                                         </p>
                                         <div className="grid grid-cols-1 gap-2 mt-2">
                                            {generatedShares.map((share, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => copyShare(share, idx)}
                                                    className="flex items-center gap-3 bg-black/40 border border-white/10 hover:border-orange-500/50 rounded-xl p-3 cursor-pointer group transition-all"
                                                >
                                                    <span className="text-[10px] font-bold text-orange-500/70 w-4">#{idx+1}</span>
                                                    <span className="font-mono text-xs text-white/70 group-hover:text-white truncate flex-1">{share}</span>
                                                    {copiedShareIndex === idx ? (
                                                        <Check size={16} className="text-green-400 shrink-0" />
                                                    ) : (
                                                        <Copy size={16} className="text-white/20 group-hover:text-orange-500 transition-colors shrink-0" />
                                                    )}
                                                </div>
                                            ))}
                                         </div>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => navigate('/')}
                                className="w-full mt-6 py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all font-medium"
                            >
                                I've Saved Everything Securely
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
