import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import useNotificationStore from '../store/useNotificationStore';
import {
    User, Mail, Phone, Lock, Save, Shield, Download, LogOut,
    Smartphone, Moon, Sun, Clock, Trash2, ArrowRight, Loader2, KeyRound, AlertCircle, ShieldCheck, Check
} from 'lucide-react';
import {
    updateProfile, updateSecurity, reEncryptVault, fetchVaultItems, logoutUser, createVaultItem, regenerateRecoveryHash, API_URL
} from '../lib/api';
import { deriveKey, deriveKeys, encryptData, decryptData, generateRecoveryKey } from '../lib/crypto';
import { useTheme } from '../components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import DeviceManager from '../components/DeviceManager';
import { startRegistration } from '@simplewebauthn/browser';
import { splitSecret, recoverSecret } from '../lib/shamir';

const Settings = () => {
    const user = useAuthStore(s => s.user);
    const masterKey = useAuthStore(s => s.masterKey);
    const logout = useAuthStore(s => s.logout);
    const autoLockTimer = useAuthStore(s => s.autoLockTimer);
    const setAutoLockTimer = useAuthStore(s => s.setAutoLockTimer);
    const addToast = useToastStore(s => s.addToast);
    const addNotification = useNotificationStore(s => s.addNotification);
    const { theme, setTheme } = useTheme();

    // Form States
    const [profileName, setProfileName] = useState(user?.name || '');
    const [profilePhone, setProfilePhone] = useState(user?.phoneNumber || '');
    const [profileEmail, setProfileEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newLoginPassword, setNewLoginPassword] = useState('');
    const [confirmNewLoginPassword, setConfirmNewLoginPassword] = useState('');
    const [newMasterPassword, setNewMasterPassword] = useState('');
    const [confirmNewMasterPassword, setConfirmNewMasterPassword] = useState('');

    // Status States
    const [loading, setLoading] = useState(false);
    const [securityLoading, setSecurityLoading] = useState(false);
    const [reEncryptionStatus, setReEncryptionStatus] = useState('');
    // Shamir's Secret Sharing States
    const [shamirMaster, setShamirMaster] = useState('');
    const [generatedShares, setGeneratedShares] = useState([]);
    
    const [recoveryShares, setRecoveryShares] = useState(['', '', '']);
    const [recoveredPassword, setRecoveredPassword] = useState('');

    // Recovery Key Generation States
    const [recoveryModal, setRecoveryModal] = useState(false);
    const [recoveryLoginPassword, setRecoveryLoginPassword] = useState('');
    const [newGeneratedRecoveryKey, setNewGeneratedRecoveryKey] = useState('');
    const [recoveryKeyLoading, setRecoveryKeyLoading] = useState(false);
    const [recoveryCopied, setRecoveryCopied] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileName(user.name || '');
            setProfilePhone(user.phoneNumber || '');
            setProfileEmail(user.email || '');
        }
    }, [user]);

    // Prevent tab close/refresh during sensitive re-encryption operations
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (securityLoading) {
                e.preventDefault();
                e.returnValue = ''; // Required for most browsers to show the confirmation dialog
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [securityLoading]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await updateProfile(profileName, profilePhone);
            useAuthStore.getState().setUser({
                ...user,
                name: data.name,
                phoneNumber: data.phoneNumber
            });
            addToast("Profile updated successfully", "success");
            addNotification("Profile Updated", "Your account information has been successfully updated.", "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSecurity = async (e) => {
        e.preventDefault();
        if (newLoginPassword && newLoginPassword !== confirmNewLoginPassword) return addToast("New login passwords do not match", "error");
        if (newMasterPassword && newMasterPassword !== confirmNewMasterPassword) return addToast("New master passwords do not match", "error");

        setSecurityLoading(true);
        setReEncryptionStatus('verifying');

        try {
            const { authKey: currentAuthKey } = deriveKeys(currentPassword, user.email);
            const currentAuthHash = currentAuthKey;
            const isEmailChanged = profileEmail !== user.email;
            const isMasterPasswordChanged = !!newMasterPassword;
            const isLoginPasswordChanged = !!newLoginPassword;

            // 1. Update Auth info on server
            let newMasterAuthHash = null;
            if (isMasterPasswordChanged) {
                const { authKey } = deriveKeys(newMasterPassword, profileEmail);
                newMasterAuthHash = authKey;
            } else if (isEmailChanged) {
                // email changed, password same — re-derive auth key with same password but new email as salt
                const { authKey } = deriveKeys(currentPassword, profileEmail);
                newMasterAuthHash = authKey;
            }
            
            await updateSecurity(currentPassword, currentAuthHash, isEmailChanged ? profileEmail : null, newLoginPassword || null, newMasterAuthHash);

            // 2. If email or master password changed, re-encrypt everything
            if (isEmailChanged || isMasterPasswordChanged) {
                setReEncryptionStatus('re-encrypting');
                const rawItems = await fetchVaultItems();
                const newKeyPara = isMasterPasswordChanged ? newMasterPassword : currentPassword;
                const { encKey: newEncKey } = deriveKeys(newKeyPara, profileEmail);
                const newMasterKey = newEncKey;

                const reEncryptedItems = rawItems.map(item => {
                    const decrypted = decryptData(item.encryptedBlob, masterKey);
                    if (!decrypted) return null;
                    const newBlob = encryptData(decrypted, newMasterKey);
                    return { id: item._id, encryptedBlob: newBlob };
                }).filter(Boolean);

                setReEncryptionStatus('updating-server');
                await reEncryptVault(reEncryptedItems);
                useAuthStore.getState().setMasterKey(newMasterKey);
                addToast("Vault re-encrypted with new key", "success");
                addNotification("Security Overhaul", "Your vault has been re-encrypted with a new master key/email.", "success");
            }

            useAuthStore.getState().setUser({ ...user, email: profileEmail });
            addToast("Security settings updated", "success");
            if (!isEmailChanged && !isMasterPasswordChanged && !isLoginPasswordChanged) {
                addNotification("Security Settings", "Authentication settings updated.", "info");
            }
            setCurrentPassword('');
            setNewLoginPassword('');
            setConfirmNewLoginPassword('');
            setNewMasterPassword('');
            setConfirmNewMasterPassword('');
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setSecurityLoading(false);
            setReEncryptionStatus('');
        }
    };

    const registerPasskey = async () => {
        try {
            setLoading(true);
            const resp = await fetch(`${API_URL}/passkeys/generate-registration-options`, { credentials: 'include' });
            if (!resp.ok) throw new Error('Failed to get passkey options');
            
            const options = await resp.json();
            const attResp = await startRegistration({ optionsJSON: options });
            
            const verifyResp = await fetch(`${API_URL}/passkeys/verify-registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attResp),
                credentials: 'include'
            });

            if (verifyResp.ok) {
                const data = await verifyResp.json();
                if (data.verified) {
                    addToast('Passkey registered successfully!', 'success');
                    addNotification('New Passkey', 'A passkey was added to your account for quick and secure logins.', 'success');
                }
            } else {
                addToast('Passkey verification failed', 'error');
            }
        } catch (error) {
            console.error(error);
            if (error.name === 'NotAllowedError') {
                addToast('Setup cancelled by user', 'info');
            } else {
                addToast(error.message || 'Failed to register passkey', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const exportPasswords = async () => {
        try {
            const rawItems = await fetchVaultItems();
            const items = rawItems.map(i => decryptData(i.encryptedBlob, masterKey)).filter(Boolean);

            if (items.length === 0) return addToast("Vault is empty", "warning");

            const headers = ["Application", "Username", "Password", "URL", "Category"];
            const csvRows = [headers.join(",")];
            items.forEach(i => {
                const row = [i.appName || 'N/A', i.username || 'N/A', i.password || 'N/A', i.url || 'N/A', i.category || 'N/A'];
                csvRows.push(row.map(v => `"${v?.toString().replace(/"/g, '""')}"`).join(","));
            });

            const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `KeeperX_Export_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            addToast("Exported successfully", "success");
            addNotification("Data Exported", "A backup CSV of your vault was successfully generated.", "info");
        } catch (err) {
            addToast("Export failed", "error");
        }
    };

    const importPasswords = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const lines = text.split('\n');
                if (lines.length < 2) throw new Error("File is empty or invalid format");

                let importedCount = 0;
                for (let i = 1; i < lines.length; i++) {
                    const row = lines[i].trim();
                    if (!row) continue;
                    
                    // Simple regex to handle comma separation with basic quotes
                    const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));

                    if (cleanCols.length >= 3) {
                        const payload = {
                            itemType: 'LOGIN',
                            appName: cleanCols[0] || 'Imported Item',
                            username: cleanCols[1] || '',
                            password: cleanCols[2] || '',
                            url: cleanCols[3] || '',
                            category: cleanCols[4] || 'Personal'
                        };
                        const encryptedBlob = encryptData(payload, masterKey);
                        if (encryptedBlob) {
                            await createVaultItem(encryptedBlob, payload.category, false, 'LOGIN', []);
                            importedCount++;
                        }
                    }
                }
                
                addToast(`Successfully imported ${importedCount} items!`, "success");
                addNotification("Data Imported", `${importedCount} items added to your vault.`, "success");
            } catch (err) {
                console.error(err);
                addToast("Failed to parse CSV file", "error");
            } finally {
                setLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleGenerateShares = () => {
        if(!shamirMaster) return addToast("Please enter master password to split", "warning");
        try {
            const shares = splitSecret(shamirMaster, 5, 3);
            setGeneratedShares(shares);
            setShamirMaster(''); // clear from memory
            addToast("Cryptographic shares generated safely!", "success");
            addNotification("Shamir's Split Active", "You have generated 5 trusted shares. Save them securely.", "info");
        } catch(e) {
            addToast("Failed to split secret", "error");
        }
    };

    const handleRecoverSecret = () => {
        const validShares = recoveryShares.map(s => s.trim()).filter(Boolean);
        if(validShares.length < 3) return addToast("You need exactly 3 shares", "warning");
        try {
            const secret = recoverSecret(validShares);
            setRecoveredPassword(secret);
            addToast("Secret successfully recovered!", "success");
        } catch(e) {
            addToast("Failed to recover. Invalid shares.", "error");
        }
    };

    const handleRegenerateRecoveryKey = async (e) => {
        e.preventDefault();
        setRecoveryKeyLoading(true);
        try {
            const rawKey = generateRecoveryKey();
            await regenerateRecoveryHash(recoveryLoginPassword, rawKey);
            setNewGeneratedRecoveryKey(rawKey);
            addToast("Recovery Key successfully regenerated!", "success");
            addNotification("Recovery Key Updated", "A new account recovery key was generated securely.", "info");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setRecoveryKeyLoading(false);
            setRecoveryLoginPassword('');
        }
    };

    return (
        <div className="p-3 sm:p-4 lg:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-10 pb-20 relative">
            {securityLoading && (
                <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-300">
                    <div className="relative mb-6">
                        <Loader2 size={56} className="text-primary animate-spin" />
                        <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse rounded-full"></div>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black capitalize tracking-tight text-foreground mb-4">
                        {reEncryptionStatus.replace('-', ' ')}...
                    </h3>
                    <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl max-w-md space-y-3 shadow-2xl">
                        <p className="text-red-500 font-bold text-sm sm:text-base uppercase tracking-widest flex items-center justify-center gap-2">
                            <AlertCircle size={18} className="animate-pulse" /> Critical Warning
                        </p>
                        <p className="text-base sm:text-lg font-medium text-foreground">
                            Do NOT refresh, close this tab, or navigate away. 
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            Your vault is being locally re-encrypted with your new security keys. Interruption may cause sync issues.
                        </p>
                    </div>
                </div>
            )}
            <header>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mb-2">Settings</h1>
                <p className="text-muted-foreground text-sm">Personalize and secure your Keeper X experience.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10">
                {/* Left Column: Account & Security */}
                <div className="lg:col-span-8 space-y-6 sm:space-y-10">

                    {/* General Profile Section */}
                    <section className="glass-panel p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-border space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><User size={20} /></div>
                            <h2 className="text-xl font-bold">Account Profile</h2>
                        </div>
                        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm transition-all" placeholder="Enter your name" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</label>
                                <div className="relative">
                                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm transition-all" placeholder="+91 11224-23132" />
                                </div>
                            </div>
                            <div className="md:col-span-2 pt-4 flex justify-end">
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={loading} className="bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2">
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Profile
                                </motion.button>
                            </div>
                        </form>
                    </section>

                    {/* Security & Re-encryption Section */}
                    <section className="glass-panel p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-border space-y-4 sm:space-y-6 relative overflow-hidden">
                        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Shield size={20} /></div>
                            <h2 className="text-xl font-bold">Security & Authentication</h2>
                        </div>
                        <form onSubmit={handleUpdateSecurity} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Associated Email (Changing triggers re-encryption)</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                    <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm transition-all" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div className="space-y-4 col-span-1 border border-border/50 rounded-2xl p-4 bg-black/5 dark:bg-white/5">
                                    <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">Change Login Password</h3>
                                    <div className="space-y-2">
                                        <input type="password" value={newLoginPassword} onChange={e => setNewLoginPassword(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm transition-all" placeholder="New Login Password" />
                                    </div>
                                    <div className="space-y-2">
                                        <input type="password" value={confirmNewLoginPassword} onChange={e => setConfirmNewLoginPassword(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm transition-all" placeholder="Confirm Login Password" />
                                    </div>
                                </div>

                                <div className="space-y-4 col-span-1 border border-border/50 rounded-2xl p-4 bg-black/5 dark:bg-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -z-10" />
                                    <h3 className="text-sm font-bold tracking-widest uppercase text-primary">Change Master Password</h3>
                                    <div className="space-y-2">
                                        <input type="password" value={newMasterPassword} onChange={e => setNewMasterPassword(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-primary/20 focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm transition-all shadow-inner" placeholder="New Master Password" />
                                    </div>
                                    <div className="space-y-2">
                                        <input type="password" value={confirmNewMasterPassword} onChange={e => setConfirmNewMasterPassword(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-primary/20 focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm transition-all shadow-inner" placeholder="Confirm Master Password" />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-border/50">
                                <div className="space-y-3 max-w-sm bg-primary/5 border border-primary/10 p-5 rounded-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -z-10 blur-xl" />
                                    <div>
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-1">
                                            <Lock size={14} /> Verification Required
                                        </label>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Please enter your <strong className="text-foreground">Current Vault Master Password</strong> to authorize these security changes.
                                        </p>
                                    </div>
                                    <input 
                                        required 
                                        type="password" 
                                        value={currentPassword} 
                                        onChange={e => setCurrentPassword(e.target.value)} 
                                        className="w-full px-4 py-3 rounded-xl bg-background/50 border border-primary/20 focus:ring-2 focus:ring-primary/50 focus:outline-none text-sm font-medium tracking-widest" 
                                        placeholder="••••••••••••" 
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2">
                                    Update Secrets & Re-encrypt <ArrowRight size={18} />
                                </motion.button>
                            </div>
                        </form>
                    </section>

                    {/* Account Recovery Key Section */}
                    <section className="glass-panel p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-border space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><AlertCircle size={20} /></div>
                            <div>
                                <h2 className="text-xl font-bold">Account Recovery Key</h2>
                                <p className="text-xs text-muted-foreground mt-1">If you forget your login password, this key is the only way to regain access.</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/50 gap-4">
                            <div>
                                <h4 className="font-bold text-sm">Regenerate Lost Key</h4>
                                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                                    Forgot your recovery key? Generate a new one immediately. Previous keys will become invalid.
                                </p>
                            </div>
                            <button 
                                onClick={() => { setRecoveryModal(true); setNewGeneratedRecoveryKey(''); setRecoveryLoginPassword(''); }}
                                className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm transition-colors border border-primary/20 shrink-0 whitespace-nowrap"
                            >
                                Get New Key
                            </button>
                        </div>
                    </section>

                    {/* Passkey Section */}
                    <section className="glass-panel p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-border space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><KeyRound size={20} /></div>
                            <h2 className="text-xl font-bold">Passkeys & WebAuthn</h2>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/50 gap-3">
                            <div>
                                <h4 className="font-bold text-sm">Biometric Login Setup</h4>
                                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                                    Register your fingerprint, FaceID, or Windows Hello passkey to login instantly next time.
                                </p>
                            </div>
                            <motion.button 
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={registerPasskey}
                                disabled={loading}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 shrink-0"
                            >
                                Add Passkey
                            </motion.button>
                        </div>
                    </section>

                    {/* Active Sessions / Devices Section */}
                    <DeviceManager />

                    {/* Shamir's Secret Sharing (Emergency Recovery) */}
                    <section className="glass-panel p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-border border-l-4 border-l-orange-500 space-y-4 sm:space-y-6 bg-gradient-to-br from-background to-orange-500/5">
                        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500"><Lock size={20} /></div>
                            <div>
                                <h2 className="text-xl font-bold">Emergency Cryptographic Recovery</h2>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Split your Vault Master Password using <strong>Shamir's Secret Sharing</strong>. You'll get 5 cryptographic keys. Give them to trusted allies. Any 3 keys can reconstruct the password.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">
                            {/* Generator */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm text-primary uppercase tracking-widest">Generate Shares</h3>
                                <input 
                                    type="password" 
                                    value={shamirMaster} 
                                    onChange={e => setShamirMaster(e.target.value)} 
                                    className="w-full px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-primary/40 focus:outline-none text-sm font-mono placeholder:font-sans" 
                                    placeholder="Enter Master Password to Split" 
                                />
                                <button onClick={handleGenerateShares} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold shadow-md shadow-primary/20 w-full hover:scale-[1.02] transition-transform">
                                    Split into 5 Fragments
                                </button>

                                {generatedShares.length > 0 && (
                                    <div className="space-y-2 mt-4 p-4 bg-black/10 dark:bg-white/5 rounded-2xl border border-border/50">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-2">Print & Distribute (Requires 3 to build)</p>
                                        {generatedShares.map((share, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span className="w-5 text-xs text-muted-foreground font-bold mt-2">#{idx+1}</span>
                                                <input 
                                                    readOnly 
                                                    value={share} 
                                                    className="flex-1 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/10 border border-border text-xs font-mono text-muted-foreground focus:outline-none" 
                                                    onClick={e => { e.target.select(); document.execCommand('copy'); addToast('Share copied', 'success'); }}
                                                    title="Click to copy"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recovery */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm text-sky-500 uppercase tracking-widest">Recover Vault Access</h3>
                                <p className="text-xs text-muted-foreground">Paste any 3 trusted fragments below to mathematically reconstruct the master password. Done 100% locally offline.</p>
                                
                                {recoveryShares.map((val, idx) => (
                                    <input 
                                        key={idx}
                                        value={val}
                                        onChange={e => {
                                            const newShares = [...recoveryShares];
                                            newShares[idx] = e.target.value;
                                            setRecoveryShares(newShares);
                                        }}
                                        className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:ring-2 focus:ring-sky-500/40 focus:outline-none text-xs font-mono" 
                                        placeholder={`Paste Share Fragment ${idx+1}`} 
                                    />
                                ))}

                                <button onClick={handleRecoverSecret} className="bg-sky-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-sky-500/20 w-full hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                                    <Shield size={16} /> Reconstruct Password
                                </button>

                                {recoveredPassword && (
                                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-2xl text-center mt-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 mb-1">Recovered Master Password</p>
                                        <p className="font-mono text-lg font-bold text-green-500 bg-background/50 px-3 py-1 inline-block rounded-xl">{recoveredPassword}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Preferences & Extra Actions */}
                <div className="lg:col-span-4 space-y-6 sm:space-y-10">

                    {/* Appearance Section */}
                    <section className="glass-panel p-6 rounded-3xl border border-border space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Sun size={18} /></div>
                            <h3 className="font-bold">Preferences</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-background rounded-lg text-primary"><Clock size={16} /></div>
                                    <span className="text-sm font-medium">Auto-lock Vault</span>
                                </div>
                                <select value={autoLockTimer} onChange={e => setAutoLockTimer(Number(e.target.value))} className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer hover:text-primary transition-colors">
                                    <option value={1}>1 Min</option>
                                    <option value={2}>2 Min</option>
                                    <option value={3}>3 Min</option>
                                    <option value={5}>5 Min</option>
                                    <option value={10}>10 Min</option>
                                    <option value={15}>15 Min</option>
                                    <option value={20}>20 Min</option>
                                    <option value={30}>30 Min</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-background rounded-lg text-primary"><Moon size={16} /></div>
                                    <span className="text-sm font-medium">Dark Appearance</span>
                                </div>
                                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={clsx("w-10 h-5 rounded-full transition-colors relative", theme === 'dark' ? 'bg-primary' : 'bg-muted')}>
                                    <motion.div animate={{ x: theme === 'dark' ? 20 : 2 }} className="w-4 h-4 bg-white rounded-full absolute top-0.5" />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Data & Backup Section */}
                    <section className="glass-panel p-6 rounded-3xl border border-border space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Download size={18} /></div>
                            <h3 className="font-bold">Data Management</h3>
                        </div>
                        <div className="space-y-3">
                            <button onClick={exportPasswords} className="w-full flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors group">
                                <span className="text-sm font-medium">Export CSV Backup</span>
                                <Download size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                            <label className="w-full flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors group cursor-pointer">
                                <span className="text-sm font-medium">Import from CSV</span>
                                <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                <input type="file" accept=".csv" className="hidden" onChange={importPasswords} disabled={loading} />
                            </label>
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section className="p-6 rounded-3xl border border-red-500/20 bg-red-500/5 space-y-4">
                        <div className="flex items-center gap-3 text-red-500">
                            <Shield size={18} />
                            <h3 className="font-bold">Danger Zone</h3>
                        </div>
                        <button onClick={() => addToast("Account deletion requires support ticket", "warning")} className="w-full flex items-center justify-between p-3 hover:bg-red-500/10 rounded-2xl transition-colors group">
                            <span className="text-sm font-bold text-red-500">Delete Account</span>
                            <Trash2 size={16} className="text-red-400" />
                        </button>
                    </section>
                </div>
            </div>

            {/* Recovery Key Generator Modal */}
            <AnimatePresence>
                {recoveryModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl relative overflow-hidden"
                        >
                            {!newGeneratedRecoveryKey ? (
                                <form onSubmit={handleRegenerateRecoveryKey} className="space-y-6">
                                    <div className="flex items-center gap-3 mb-2 text-primary">
                                        <AlertCircle size={28} />
                                        <h3 className="text-xl font-bold">Verify Identity</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        To generate a new Account Recovery Key, please enter your <strong className="text-foreground">Current Account Login Password</strong>.
                                    </p>

                                    <div className="space-y-2">
                                        <input
                                            type="password"
                                            required
                                            value={recoveryLoginPassword}
                                            onChange={(e) => setRecoveryLoginPassword(e.target.value)}
                                            className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-sm"
                                            placeholder="Enter Login Password"
                                        />
                                    </div>
                                    
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setRecoveryModal(false)}
                                            className="px-4 py-2 font-bold text-muted-foreground hover:text-foreground rounded-xl transition-colors text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={recoveryKeyLoading}
                                            className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-xl flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all text-sm"
                                        >
                                            {recoveryKeyLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                            Generate Key
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-6 text-center">
                                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500 mb-4">
                                        <Check size={32} />
                                    </div>
                                    <h3 className="text-2xl font-bold">New Key Generated</h3>
                                    <p className="text-sm text-muted-foreground">
                                        This is your new Account Recovery Key. Your old keys will no longer work. Save this securely right now!
                                    </p>

                                    <div 
                                        className="bg-black/20 border border-primary/30 p-5 rounded-2xl cursor-pointer group relative overflow-hidden"
                                        onClick={() => {
                                            navigator.clipboard.writeText(newGeneratedRecoveryKey);
                                            setRecoveryCopied(true);
                                            setTimeout(() => setRecoveryCopied(false), 2000);
                                            addToast("Recovery Key Copied", "success");
                                        }}
                                    >
                                        <p className="font-mono text-xl tracking-widest text-primary font-bold group-hover:blur-[2px] transition-all">
                                            {newGeneratedRecoveryKey}
                                        </p>
                                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                            {recoveryCopied ? <span className="font-bold text-white text-sm">Copied!</span> : <span className="font-bold text-white text-sm">Click to Copy</span>}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setRecoveryModal(false)}
                                        className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all"
                                    >
                                        I've Saved It Safely
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Settings;
