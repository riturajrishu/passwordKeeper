import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Subtle notification sound
const playNotificationSound = () => {
    try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
        audio.volume = 0.4;
        audio.play();
    } catch (err) {
        console.error("Audio playback failed:", err);
    }
};

const useNotificationStore = create(
    persist(
        (set, get) => ({
            notifications: [
                {
                    id: 'welcome',
                    title: 'Welcome to Password Keeper X! 🛡️',
                    description: 'Your digital vault is ready. Add your first password to get started.',
                    type: 'info',
                    timestamp: new Date().toISOString(),
                    read: false
                }
            ],
            unreadCount: 1,

            addNotification: (title, description, type = 'info') => {
                const state = get();
                
                // Deduplication: Don't add if an identical unread notification exists
                // or if it was added in the last 10 seconds (to prevent multi-tab spam)
                const isDuplicate = state.notifications.some(n => 
                    n.title === title && 
                    n.description === description && 
                    (!n.read || (new Date() - new Date(n.timestamp)) < 10000)
                );

                if (isDuplicate) return;

                const id = Math.random().toString(36).substr(2, 9);
                const newNotification = {
                    id,
                    title,
                    description,
                    type,
                    timestamp: new Date().toISOString(),
                    read: false
                };

                set((state) => ({
                    notifications: [newNotification, ...state.notifications].slice(0, 50), // Limit to 50
                    unreadCount: state.unreadCount + 1
                }));

                // Play sound
                playNotificationSound();
            },

            markAsRead: (id) => {
                set((state) => {
                    const updated = state.notifications.map(n => 
                        n.id === id ? { ...n, read: true } : n
                    );
                    const unreadCount = updated.filter(n => !n.read).length;
                    return { notifications: updated, unreadCount };
                });
            },

            markAllAsRead: () => {
                set((state) => {
                    const updated = state.notifications.map(n => ({ ...n, read: true }));
                    return { notifications: updated, unreadCount: 0 };
                });
            },

            clearAll: () => {
                set({ notifications: [], unreadCount: 0 });
            }
        }),
        {
            name: 'notification-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export default useNotificationStore;
