import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Shield, LayoutDashboard, ShieldCheck, Radar,
    Bot, Trash2, Settings, LogOut, Star, Lock,
    ChevronLeft, ChevronRight, X, Users, HelpCircle, ShieldAlert,
    HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logoutUser, fetchVaultItems } from '../lib/api';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import clsx from 'clsx';

const navItems = [
    { to: '/',         Icon: LayoutDashboard, label: 'Vault',         badge: 'total' },
    { to: '/audit',    Icon: ShieldCheck,      label: 'Security Audit' },
    { to: '/scanner',  Icon: Radar,            label: 'Breach Scanner' },
    { to: '/phishing', Icon: Bot,              label: 'AI Analyzer' },
    { to: '/locker',   Icon: HardDrive,        label: 'Document Locker' },
    { to: '/trash',     Icon: Trash2,        label: 'Trash',            badge: 'trash', danger: true },
    { to: '/emergency', Icon: ShieldAlert,    label: 'Emergency Access' },
    { to: '/support',   Icon: HelpCircle,    label: 'Support Tickets' },
    { to: '/settings',  Icon: Settings,      label: 'Settings' },
];

export default function Sidebar({ isOpen, onClose }) {
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const lockVault = useAuthStore(s => s.lockVault);
    const logout = useAuthStore(s => s.logout);
    const addToast = useToastStore(s => s.addToast);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [trashCount, setTrashCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    // Load item counts for badges
    useEffect(() => {
        const loadCounts = async () => {
            try {
                const items = await fetchVaultItems();
                setTrashCount(items.filter(i => i.isDeleted).length);
                setTotalCount(items.filter(i => !i.isDeleted && i.itemType !== 'FILE').length);
            } catch { /* silent */ }
        };
        loadCounts();
        const interval = setInterval(loadCounts, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        try {
            await logoutUser();
            logout();
            navigate('/login');
        } catch {
            addToast('Logout failed', 'error');
        }
    };

    const handleLock = () => {
        lockVault();
        addToast('Vault locked', 'info');
    };

    const getBadgeValue = (badge) => {
        if (badge === 'trash') return trashCount > 0 ? trashCount : null;
        if (badge === 'total') return totalCount > 0 ? totalCount : null;
        return null;
    };

    const sidebarInner = (
        <div className="flex flex-col h-full">
            {/* Brand */}
            <div className={clsx('px-4 sm:px-5 py-4 sm:py-5 border-b border-border/50 shrink-0 flex items-center gap-2.5 sm:gap-3', isCollapsed && 'justify-center px-3')}>
                <div className="relative shrink-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg text-white shrink-0">
                        <Shield size={16} className="sm:size-[18px]" />
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                </div>
                {!isCollapsed && (
                    <div className="min-w-0">
                        <span className="font-extrabold text-[15px] sm:text-base tracking-tight leading-none block">Keeper<span className="text-primary">X</span></span>
                        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80 mt-1 block">Enterprise Vault</span>
                    </div>
                )}
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-1">
                {navItems.map(({ to, Icon, label, badge, danger }) => {
                    const badgeVal = badge ? getBadgeValue(badge) : null;
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            onClick={onClose}
                            className={({ isActive }) => clsx(
                                'flex items-center gap-3 font-semibold text-[13px] sm:text-sm rounded-xl transition-all relative group',
                                isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                                isActive
                                    ? 'bg-primary/10 text-primary border border-primary/10'
                                    : danger
                                        ? 'text-muted-foreground hover:text-red-500 hover:bg-red-500/5'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon size={18} className={clsx('shrink-0', isCollapsed ? 'opacity-100' : 'opacity-80 group-hover:opacity-100')} />
                                    {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
                                    
                                    {/* Active Indicator bar */}
                                    <div className={clsx(
                                        "absolute left-0 w-1 bg-primary rounded-full transition-all duration-300",
                                        isActive ? "h-5 sm:h-6" : "h-0"
                                    )} />

                                    {badgeVal != null && !isCollapsed && (
                                        <span className={clsx(
                                            'text-[10px] font-black px-1.5 py-0.5 rounded-md leading-none',
                                            badge === 'trash'
                                                ? 'bg-red-500/10 text-red-500 border border-red-500/10'
                                                : 'bg-primary/10 text-primary border border-primary/10'
                                        )}>
                                            {badgeVal}
                                        </span>
                                    )}
                                    {isCollapsed && badgeVal != null && (
                                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
                                    )}
                                    {/* Tooltip for collapsed sidebar */}
                                    {isCollapsed && (
                                        <span className="absolute left-full ml-3 px-3 py-2 bg-surface-1 border border-border rounded-xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap shadow-premium pointer-events-none z-50">
                                            {label}{badgeVal != null ? ` (${badgeVal})` : ''}
                                        </span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    );
                })}
                
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <NavLink
                        to="/admin/dashboard"
                        onClick={onClose}
                        className={({ isActive }) => clsx(
                            'flex items-center gap-3 font-bold text-sm rounded-xl transition-all relative group mt-6',
                            isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                            isActive
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'text-primary/80 hover:text-primary hover:bg-primary/5 border border-primary/10'
                        )}
                    >
                        <Users size={18} className="shrink-0" />
                        {!isCollapsed && <span className="flex-1 truncate">Admin Dashboard</span>}
                        {isCollapsed && (
                            <span className="absolute left-full ml-3 px-3 py-2 bg-surface-1 border border-border rounded-xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap shadow-premium pointer-events-none z-50">
                                Admin Dashboard
                            </span>
                        )}
                    </NavLink>
                )}
            </div>

            {/* Footer */}
            <div className={clsx('p-3 border-t border-border/50 shrink-0 space-y-1', isCollapsed && 'px-2')}>
                {/* User */}
                {!isCollapsed && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl mb-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-sm font-bold shadow-sm shrink-0">
                            {(user?.name || user?.email)?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{user?.name || 'My Account'}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{user?.email}</p>
                        </div>
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-primary/10 text-primary rounded-full uppercase tracking-wider">Pro</span>
                    </div>
                )}

                {/* Lock */}
                <button
                    onClick={handleLock}
                    className={clsx(
                        'w-full flex items-center gap-3 font-bold text-sm px-3 py-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-all relative group',
                        isCollapsed && 'justify-center px-2.5'
                    )}
                >
                    <Lock size={18} className="shrink-0" />
                    {!isCollapsed && <span>Lock Vault</span>}
                    {isCollapsed && (
                        <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover border border-border rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none z-50">
                            Lock Vault
                        </span>
                    )}
                </button>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className={clsx(
                        'w-full flex items-center gap-3 font-bold text-sm px-3 py-2.5 rounded-xl text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-all relative group',
                        isCollapsed && 'justify-center px-2.5'
                    )}
                >
                    <LogOut size={18} className="shrink-0" />
                    {!isCollapsed && <span>Sign Out</span>}
                    {isCollapsed && (
                        <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover border border-border rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none z-50">
                            Sign Out
                        </span>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <motion.aside
                className={clsx(
                    'fixed lg:relative h-full glass-panel border-r border-border flex flex-col z-50 transition-all duration-300 lg:translate-x-0 bg-background/95 lg:bg-transparent',
                    isOpen ? 'translate-x-0' : '-translate-x-full',
                    isCollapsed ? 'w-[68px]' : 'w-64'
                )}
            >
                {sidebarInner}

                {/* Mobile close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-white/10 transition-colors lg:hidden"
                >
                    <X size={18} />
                </button>

                {/* Desktop collapse toggle */}
                <button
                    onClick={() => setIsCollapsed(c => !c)}
                    className="hidden lg:flex absolute -right-3.5 top-20 w-7 h-7 items-center justify-center bg-background border border-border rounded-full shadow-md hover:bg-black/5 dark:hover:bg-white/5 transition-all z-10"
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </motion.aside>
        </>
    );
}
