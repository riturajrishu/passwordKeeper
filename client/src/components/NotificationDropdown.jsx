import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, Info, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useNotificationStore from '../store/useNotificationStore';
import clsx from 'clsx';

const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
};

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const notifications = useNotificationStore(s => s.notifications);
    const unreadCount = useNotificationStore(s => s.unreadCount);
    const markAsRead = useNotificationStore(s => s.markAsRead);
    const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
    const clearAll = useNotificationStore(s => s.clearAll);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getTypeIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle2 size={16} className="text-green-500" />;
            case 'warning': return <AlertCircle size={16} className="text-yellow-500" />;
            case 'error': return <X size={16} className="text-red-500" />;
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground border border-border/50"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                )}
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 sm:right-0 mt-3 w-[calc(100vw-24px)] sm:w-96 max-w-[400px] bg-background/95 dark:bg-background/95 backdrop-blur-3xl border border-border/60 rounded-2xl sm:rounded-3xl shadow-[0_10px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden -right-2 sm:right-0"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-border/50 bg-background/30 flex items-center justify-between">
                            <h3 className="text-sm font-bold">Notifications</h3>
                            <div className="flex items-center gap-2">
                                {notifications.length > 0 && (
                                    <>
                                        <button 
                                            onClick={markAllAsRead}
                                            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-muted-foreground hover:text-primary transition-colors tooltip"
                                            title="Mark all as read"
                                        >
                                            <CheckCheck size={16} />
                                        </button>
                                        <button 
                                            onClick={clearAll}
                                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                                            title="Clear all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center">
                                    <div className="w-12 h-12 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-muted-foreground/50">
                                        <Bell size={24} />
                                    </div>
                                    <p className="text-sm text-muted-foreground">No new notifications</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-2">
                                    {notifications.map((n) => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => markAsRead(n.id)}
                                            className={clsx(
                                                "p-4 flex gap-3 cursor-pointer transition-all relative group rounded-2xl backdrop-blur-md border",
                                                !n.read 
                                                    ? "bg-primary/10 border-primary/20 shadow-sm shadow-primary/5 hover:bg-primary/15" 
                                                    : "bg-black/5 border-white/10 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                                            )}
                                        >
                                            {!n.read && (
                                                <div className="absolute left-0 top-4 bottom-4 w-1 bg-primary rounded-r-full" />
                                            )}
                                            <div className="shrink-0 mt-0.5">
                                                {getTypeIcon(n.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <p className={clsx("text-sm leading-tight truncate", !n.read ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                                                        {n.title}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground shrink-0 font-medium tracking-wider">
                                                        {timeAgo(n.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                    {n.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="p-3 border-t border-border/50 bg-background/30 text-center">
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                                >
                                    Close Panel
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationDropdown;
