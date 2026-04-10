import { create } from 'zustand';
import useNotificationStore from './useNotificationStore';

const savedKey = sessionStorage.getItem('vault_key');

const useAuthStore = create((set) => ({
    user: null,           // { uid, email } — from server session
    masterKey: savedKey || null,      // Derived AES key (NEVER stored in localStorage)
    isVaultUnlocked: !!savedKey,
    isLoading: true,
    autoLockTimer: Number(localStorage.getItem('vault_autolock')) || 5, // Default 5
    lastActivity: Date.now(),

    setUser: (user) => set({ user, isLoading: false }),
    setMasterKey: (key) => {
        if (key) sessionStorage.setItem('vault_key', key);
        set({ masterKey: key, isVaultUnlocked: !!key, lastActivity: Date.now() });
    },
    updateActivity: () => set({ lastActivity: Date.now() }),
    setAutoLockTimer: (minutes) => {
        localStorage.setItem('vault_autolock', minutes);
        set({ autoLockTimer: minutes });
    },
    lockVault: () => {
        sessionStorage.removeItem('vault_key');
        set({ masterKey: null, isVaultUnlocked: false });
    },
    logout: () => {
        sessionStorage.removeItem('vault_key');
        useNotificationStore.getState().clearAll();
        set({ user: null, masterKey: null, isVaultUnlocked: false, isLoading: false });
    },
    setLoading: (status) => set({ isLoading: status }),
}));

export default useAuthStore;
