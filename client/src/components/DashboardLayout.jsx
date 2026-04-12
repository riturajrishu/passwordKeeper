import React, { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationDropdown from './NotificationDropdown';
import { Menu, Sun, Moon, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeProvider';
import clsx from 'clsx';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import { useEffect, useCallback } from 'react';
import CommandPalette from './CommandPalette';
import useNotificationStore from '../store/useNotificationStore';
import { API_URL } from '../lib/api';

const ActivityManager = () => {
    const lastActivity = useAuthStore(s => s.lastActivity);
    const updateActivity = useAuthStore(s => s.updateActivity);
    const autoLockTimer = useAuthStore(s => s.autoLockTimer);
    const lockVault = useAuthStore(s => s.lockVault);
    const addToast = useToastStore(s => s.addToast);

    useEffect(() => {
        let lastUpdate = Date.now();
        const handleUserActivity = () => {
            const now = Date.now();
            // Only update activity state if at least 2 seconds have passed since the last update
            // to avoid excessive re-renders during mouse movement.
            if (now - lastUpdate > 2000) {
                updateActivity();
                lastUpdate = now;
            }
        };

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
        events.forEach(event => window.addEventListener(event, handleUserActivity, { passive: true }));
        
        const checkInactivity = setInterval(() => {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - lastActivity) / 1000);
            const limitSeconds = autoLockTimer * 60;

            if (elapsedSeconds >= limitSeconds) {
                lockVault();
                addToast(`Vault locked due to ${autoLockTimer}m inactivity`, "info");
                clearInterval(checkInactivity);
            }
        }, 1000);

        return () => {
            events.forEach(event => window.removeEventListener(event, handleUserActivity));
            clearInterval(checkInactivity);
        };
    }, [lastActivity, autoLockTimer, lockVault, addToast, updateActivity]);

    return null;
};

const TicketNotificationsManager = () => {
    const user = useAuthStore(s => s.user);
    const addNotification = useNotificationStore(s => s.addNotification);

    useEffect(() => {
        if (!user) return;
        const checkKey = `lastTicketCheck_${user.uid}`;
        
        const checkTickets = async () => {
            try {
                const endpoint = (user.role === 'admin' || user.role === 'superadmin') ? '/admin/tickets' : '/support';
                const res = await fetch(`${API_URL}${endpoint}`, { credentials: 'include' });
                if (!res.ok) return;
                const tickets = await res.json();
                
                let lastCheck = localStorage.getItem(checkKey);
                
                // If it's the very first time, just store the latest ticket time and don't notify to avoid spam
                if (!lastCheck) {
                    let maxTime = Date.now();
                    tickets.forEach(t => {
                        const tTime = Math.max(new Date(t.createdAt).getTime(), new Date(t.updatedAt).getTime());
                        maxTime = Math.max(maxTime, tTime);
                    });
                    localStorage.setItem(checkKey, maxTime.toString());
                    return; 
                }

                lastCheck = parseInt(lastCheck);
                let latestTime = lastCheck;

                tickets.forEach(ticket => {
                    const createdTime = new Date(ticket.createdAt).getTime();
                    const updatedTime = new Date(ticket.updatedAt).getTime();
                    
                    // ADMIN NOTIFICATIONS: Only show to admins/superadmins
                    if (user.role === 'admin' || user.role === 'superadmin') {
                        if (createdTime > lastCheck && ticket.status === 'OPEN' && ticket.userId?._id !== user.uid) {
                            addNotification(`New Support Request`, `Subject: ${ticket.subject}`, 'warning');
                            latestTime = Math.max(latestTime, createdTime);
                        }
                    } 
                    
                    // USER NOTIFICATIONS: Only show to regular users
                    if (user.role !== 'admin' && user.role !== 'superadmin') {
                        if (updatedTime > lastCheck) {
                            if (ticket.status === 'RESOLVED') {
                                addNotification('Support: Ticket Resolved', `Ticket "${ticket.subject}" is now closed.`, 'success');
                                latestTime = Math.max(latestTime, updatedTime);
                            } else if (ticket.adminReply && updatedTime > createdTime) {
                                // Only notify if updatedAt is greater than createdAt (meaning it was modified/replied by admin)
                                addNotification('Support: New Reply', `Admin replied to: ${ticket.subject}`, 'info');
                                latestTime = Math.max(latestTime, updatedTime);
                            }
                        }
                    }
                });

                if (latestTime > lastCheck) {
                    localStorage.setItem(checkKey, latestTime.toString());
                }
            } catch (error) {
                // Silently fail polling
            }
        };

        checkTickets();
        const interval = setInterval(checkTickets, 30000);
        return () => clearInterval(interval);
    }, [user, addNotification]);

    return null;
};

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const user = useAuthStore(s => s.user);
    const location = useLocation();
    const currentOutlet = useOutlet();

    // Fix: Force scroll to top on route change. Prevents the layout from being shifted up out of bounds,
    // which happens when the mobile keyboard is open during login and leaves the viewport scrolled down.
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [location.pathname]);

    return (
        <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
            {/* Background Managers (No-UI) */}
            <ActivityManager />
            <TicketNotificationsManager />

            {/* Global Search CMD+K Palette */}
            <CommandPalette />

            {/* Nav Sidebar Component */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
                {/* Global Header */}
                <header className="h-14 sm:h-16 lg:h-20 border-b border-border flex items-center justify-between px-3 sm:px-4 lg:px-8 glass-panel relative z-40 bg-background/80 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-3 flex-1 lg:hidden">
                        <button 
                            className="p-2 text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <Shield size={24} className="text-primary lg:hidden" />
                    </div>

                    <div className="hidden lg:flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <span className="text-primary italic">Status:</span> 
                        <span className="flex items-center gap-1.5 text-green-500">
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> End-to-End Encrypted
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 shrink-0 ml-auto">
                        <NotificationDropdown />

                        <motion.button 
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground border border-border/50"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </motion.button>
                        
                        <div className="h-8 w-[1px] bg-border/50 mx-1 hidden sm:block" />
                        
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold leading-none mb-1">{user?.name || 'Account'}</p>
                                <p className="text-[10px] text-muted-foreground">Pro Member</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20">
                                {(user?.name || user?.email)?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content Holder */}
                <div className="flex-1 overflow-auto relative custom-scrollbar overscroll-contain -webkit-overflow-scrolling-touch">
                    {/* Background Decorative Gradients */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none opacity-50" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px] -z-10 pointer-events-none opacity-30" />
                    
                    {/* Route Transitions */}
                    <AnimatePresence mode="wait">
                         <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, scale: 0.98, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.02, y: -5 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full transform-gpu will-change-transform"
                         >
                            {currentOutlet}
                         </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
