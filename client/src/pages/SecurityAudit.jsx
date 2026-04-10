import React, { useState, useEffect, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
    ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2,
    ShieldEllipsis, Zap, Clock, Key, CreditCard,
    Wifi, FileText, UserCircle, KeyRound, ShieldOff,
    RefreshCw, Info, Lock, HardDrive
} from 'lucide-react';
import { motion } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import { fetchVaultItems } from '../lib/api';
import { decryptData } from '../lib/crypto';
import clsx from 'clsx';
import ActivityHeatmap from '../components/ActivityHeatmap';

// ─── Password strength scorer (0-5) ─────────────────────────────────────────
const getStrength = (pwd) => {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length > 7) s++;
    if (pwd.length > 11) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
};

const strengthLabel = (s) => {
    if (s < 2) return 'Weak';
    if (s < 4) return 'Fair';
    return 'Strong';
};

// ─── Custom Tooltip for Recharts ─────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-popover border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
            <p className="font-bold mb-0.5">{label}</p>
            <p className="text-primary font-black">{payload[0].value} item{payload[0].value !== 1 ? 's' : ''}</p>
        </div>
    );
};

const CustomPieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-popover border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
            <p className="font-bold" style={{ color: payload[0].payload.color }}>{payload[0].name}</p>
            <p className="font-black">{payload[0].value}</p>
        </div>
    );
};

// ─── Item type icon map ──────────────────────────────────────────────────────
const TYPE_ICONS = {
    LOGIN:       { Icon: KeyRound,   color: '#a855f7', label: 'Login' },
    CREDIT_CARD: { Icon: CreditCard, color: '#06b6d4', label: 'Credit Card' },
    IDENTITY:    { Icon: UserCircle, color: '#8b5cf6', label: 'Identity' },
    WIFI:        { Icon: Wifi,       color: '#38bdf8', label: 'Wi-Fi' },
    SECURE_NOTE: { Icon: FileText,   color: '#f97316', label: 'Secure Note' },
    FILE:        { Icon: HardDrive,  color: '#8b5cf6', label: 'Secure File' },
};

// ─── How old is a date in days ───────────────────────────────────────────────
const daysOld = (dateStr) => {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
};

const SecurityAudit = () => {
    const masterKey = useAuthStore(s => s.masterKey);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadItems = async () => {
            try {
                const rawItems = await fetchVaultItems();
                const decrypted = rawItems
                    // 🔒 HARDENED FILTER: Exclude anything that is deleted, or marked for deletion
                    .filter(i => i.isDeleted === false || i.isDeleted === undefined || i.isDeleted === null)
                    .filter(i => !i.isDeleted) 
                    .map(item => {
                        const payload = decryptData(item.encryptedBlob, masterKey);
                        if (!payload) return null;
                        return {
                            _id: item._id,
                            // ✅ BUG FIX: preserve itemType from outer DB record, not just decrypted blob
                            itemType: item.itemType || payload.itemType || 'LOGIN',
                            category: item.category || 'Uncategorized',
                            isFavorite: item.isFavorite,
                            tags: item.tags || [],
                            createdAt: item.createdAt,
                            updatedAt: item.updatedAt,
                            passwordHistory: item.passwordHistory || [],
                            ...payload,
                        };
                    })
                    .filter(Boolean);
                setItems(decrypted);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadItems();
    }, [masterKey]);

    // ─── Core stats ────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = items.length;
        if (total === 0) return {
            score: 100, weak: 0, fair: 0, strong: 0, reused: 0,
            total: 0, withPassword: 0, missing2fa: 0, oldPasswords: 0
        };

        const passwordItems = items.filter(i => i.password);
        const withPassword = passwordItems.length;

        const pwdMap = {};
        let weak = 0, fair = 0, strong = 0;

        passwordItems.forEach(i => {
            const s = getStrength(i.password);
            if (s < 2) weak++;
            else if (s < 4) fair++;
            else strong++;
            pwdMap[i.password] = (pwdMap[i.password] || 0) + 1;
        });

        let reused = 0;
        Object.values(pwdMap).forEach(c => { if (c > 1) reused += c; });

        // Missing 2FA: LOGIN items without TOTP secret
        const missing2fa = items.filter(i => i.itemType === 'LOGIN' && !i.totpSecret).length;

        // Old passwords: password items where updatedAt > 90 days ago
        const oldPasswords = passwordItems.filter(i => daysOld(i.updatedAt) > 90).length;

        // Score: perfect = 0 weak + 0 reused + all have 2FA
        const pwdScore = withPassword > 0
            ? Math.round(((strong + fair * 0.6) / withPassword) * 70)
            : 70;
        const faScore = total > 0 ? Math.round(((total - missing2fa) / total) * 20) : 20;
        const reusedPenalty = reused > 0 ? Math.min(20, reused * 5) : 0;
        const score = Math.max(0, Math.min(100, pwdScore + faScore - reusedPenalty));

        return { score, weak, fair, strong, reused, total, withPassword, missing2fa, oldPasswords };
    }, [items]);

    // ─── Silent Admin Stats Sync ───────────────────────────────────────────
    useEffect(() => {
        if (!loading && stats.total > 0) {
            import('../lib/api').then(({ syncSecurityStats }) => {
                syncSecurityStats({
                    totalItems: stats.total,
                    weakPasswords: stats.weak,
                    strongPasswords: stats.strong
                }).catch(console.error);
            });
        }
    }, [loading, stats.total, stats.weak, stats.strong]);

    // ─── Reused passwords list ─────────────────────────────────────────────
    const reusedGroups = useMemo(() => {
        const map = {};
        items.filter(i => i.password).forEach(i => {
            if (!map[i.password]) map[i.password] = [];
            map[i.password].push(i.appName || 'Unnamed');
        });
        return Object.entries(map)
            .filter(([, apps]) => apps.length > 1)
            .map(([pwd, apps]) => ({ pwd, apps, strength: getStrength(pwd) }));
    }, [items]);

    // ─── Old passwords list ────────────────────────────────────────────────
    const oldPasswordItems = useMemo(() =>
        items
            .filter(i => i.password && daysOld(i.updatedAt) > 90)
            .sort((a, b) => daysOld(b.updatedAt) - daysOld(a.updatedAt))
            .slice(0, 5),
        [items]
    );

    // ─── Login items missing 2FA ───────────────────────────────────────────
    const missing2faItems = useMemo(() =>
        items.filter(i => i.itemType === 'LOGIN' && !i.totpSecret).slice(0, 5),
        [items]
    );

    // ─── Strength distribution pie data ───────────────────────────────────
    // ✅ BUG FIX: use explicit hex colors (CSS vars don't work in SVG context)
    const pieData = [
        { name: 'Strong', value: stats.strong, color: '#10b981' },
        { name: 'Fair',   value: stats.fair,   color: '#f59e0b' },
        { name: 'Weak',   value: stats.weak,   color: '#ef4444' },
    ].filter(d => d.value > 0);

    // ─── Item type distribution bar data ──────────────────────────────────
    const typeBarData = useMemo(() => {
        const map = {};
        items.forEach(i => {
            const t = i.itemType || 'LOGIN';
            map[t] = (map[t] || 0) + 1;
        });
        return Object.entries(map)
            .map(([type, count]) => ({ name: TYPE_ICONS[type]?.label || type, count, type }))
            .sort((a, b) => b.count - a.count);
    }, [items]);

    // ─── Score arc color ───────────────────────────────────────────────────
    const scoreColor = stats.score < 50
        ? '#ef4444' : stats.score < 80
        ? '#f59e0b' : '#10b981';

    if (loading) return (
        <div className="p-10 flex justify-center items-center">
            <Zap className="animate-spin text-primary" size={40} />
        </div>
    );

    const fadeUp = (delay = 0) => ({
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }
    });

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 pb-16">
            <header>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Security Audit</h1>
                <p className="text-muted-foreground text-sm">
                    Detailed health analysis of your vault · <span className="font-bold text-foreground">{stats.total}</span> active items
                </p>
            </header>

            {/* ── Top 3 cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Health Score */}
                <motion.div {...fadeUp(0)}
                    className="glass-panel p-6 sm:p-8 rounded-3xl border border-border flex flex-col items-center justify-center text-center relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, transparent, ${scoreColor}, transparent)` }} />
                    <div className="relative w-36 h-36 mb-5">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
                            <circle cx="72" cy="72" r="62" stroke="currentColor" strokeWidth="8" fill="none" className="text-black/5 dark:text-white/8" />
                            <circle
                                cx="72" cy="72" r="62"
                                stroke={scoreColor}
                                strokeWidth="9" fill="none"
                                strokeLinecap="round"
                                strokeDasharray={389.6}
                                strokeDashoffset={389.6 - (389.6 * stats.score) / 100}
                                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black leading-none">{stats.score}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-50 mt-1">Health Score</span>
                        </div>
                    </div>
                    <p className="text-sm font-medium mb-5 leading-relaxed">
                        Your vault is{' '}
                        <span className="font-bold" style={{ color: scoreColor }}>
                            {stats.score >= 80 ? 'well secured' : stats.score >= 50 ? 'moderately secure' : 'at risk'}
                        </span>.{' '}
                        {stats.weak > 0 ? `${stats.weak} weak password${stats.weak > 1 ? 's' : ''} need attention.` : stats.missing2fa > 0 ? `Enable 2FA on ${stats.missing2fa} login${stats.missing2fa > 1 ? 's' : ''}.` : 'Keep it up!'}
                    </p>
                    <div className="grid grid-cols-4 gap-2 w-full pt-4 border-t border-border/50 text-center">
                        {[
                            { label: 'Total', value: stats.total, color: '' },
                            { label: 'Weak', value: stats.weak, color: 'text-red-500' },
                            { label: 'Reused', value: stats.reused, color: 'text-yellow-500' },
                            { label: 'No 2FA', value: stats.missing2fa, color: 'text-orange-400' },
                        ].map(s => (
                            <div key={s.label}>
                                <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Strength Distribution Pie */}
                <motion.div {...fadeUp(0.08)}
                    className="glass-panel p-6 sm:p-8 rounded-3xl border border-border flex flex-col"
                >
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Strength Distribution</h3>
                    {stats.withPassword === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">No passwords stored yet</div>
                    ) : (
                        <>
                            {/* ✅ BUG FIX: fixed height + isAnimationActive=false prevents scroll-freeze */}
                            <div style={{ height: 180, minWidth: 0, minHeight: 0 }}>
                                <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%" cy="50%"
                                            innerRadius={52} outerRadius={72}
                                            paddingAngle={4}
                                            dataKey="value"
                                            isAnimationActive={false}
                                        >
                                            {pieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 mt-3">
                                {pieData.map(d => (
                                    <div key={d.name} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">
                                            {d.name} ({d.value})
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {/* Per-item strength bars */}
                            <div className="mt-4 space-y-2">
                                {items.filter(i => i.password).slice(0, 3).map(i => {
                                    const s = getStrength(i.password);
                                    const pct = Math.round((s / 5) * 100);
                                    const col = s < 2 ? '#ef4444' : s < 4 ? '#f59e0b' : '#10b981';
                                    return (
                                        <div key={i._id} className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold truncate flex-1 min-w-0 opacity-70">{i.appName || 'Untitled'}</span>
                                            <div className="w-20 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: col }} />
                                            </div>
                                            <span className="text-[9px] font-bold w-10 text-right" style={{ color: col }}>{strengthLabel(s)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </motion.div>

                {/* Item Type Distribution */}
                <motion.div {...fadeUp(0.16)}
                    className="glass-panel p-6 sm:p-8 rounded-3xl border border-border flex flex-col"
                >
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                        Item Type Distribution
                    </h3>
                    {typeBarData.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">No items yet</div>
                    ) : (
                        <>
                            {/* ✅ BUG FIX: fixed height chart + isAnimationActive=false */}
                            <div style={{ height: 160, minWidth: 0, minHeight: 0 }}>
                                <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                                    <BarChart data={typeBarData} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false} tickLine={false}
                                            tick={{ fontSize: 9, fill: '#888', fontWeight: 700 }}
                                        />
                                        <YAxis hide allowDecimals={false} />
                                        {/* ✅ BUG FIX: explicit hex color, not CSS var */}
                                        <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                            {typeBarData.map((entry, i) => (
                                                <Cell key={i} fill={TYPE_ICONS[entry.type]?.color || '#a855f7'} />
                                            ))}
                                        </Bar>
                                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)', radius: 6 }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Legend */}
                            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                                {typeBarData.map(d => {
                                    const meta = TYPE_ICONS[d.type] || {};
                                    return (
                                        <div key={d.type} className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color || '#a855f7' }} />
                                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{d.name} · {d.count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </motion.div>
            </div>

            {/* ── Security Insight Rows ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Reused Passwords */}
                <motion.div {...fadeUp(0.2)} className="glass-panel rounded-3xl border border-border overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
                        <div className="p-2 bg-yellow-500/10 rounded-xl text-yellow-500"><RefreshCw size={16} /></div>
                        <div>
                            <h3 className="font-bold text-sm">Reused Passwords</h3>
                            <p className="text-[10px] text-muted-foreground">Same password across multiple sites</p>
                        </div>
                        <span className={clsx(
                            'ml-auto text-xs font-black px-2 py-1 rounded-xl',
                            reusedGroups.length > 0 ? 'bg-yellow-500/15 text-yellow-500' : 'bg-green-500/15 text-green-500'
                        )}>
                            {reusedGroups.length > 0 ? `${reusedGroups.length} group${reusedGroups.length > 1 ? 's' : ''}` : 'All unique ✓'}
                        </span>
                    </div>
                    <div className="p-4 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                        {reusedGroups.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                <CheckCircle2 size={28} className="text-green-500" />
                                No reused passwords — excellent!
                            </div>
                        ) : reusedGroups.map((g, i) => (
                            <div key={i} className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">
                                        {g.apps.length} accounts share this password
                                    </span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500">
                                        {strengthLabel(g.strength)}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {g.apps.map(app => (
                                        <span key={app} className="text-[10px] font-bold px-2 py-0.5 bg-background rounded-lg border border-border/50">{app}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Old / Stale Passwords */}
                <motion.div {...fadeUp(0.26)} className="glass-panel rounded-3xl border border-border overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
                        <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400"><Clock size={16} /></div>
                        <div>
                            <h3 className="font-bold text-sm">Stale Passwords</h3>
                            <p className="text-[10px] text-muted-foreground">Not changed in 90+ days</p>
                        </div>
                        <span className={clsx(
                            'ml-auto text-xs font-black px-2 py-1 rounded-xl',
                            stats.oldPasswords > 0 ? 'bg-orange-500/15 text-orange-400' : 'bg-green-500/15 text-green-500'
                        )}>
                            {stats.oldPasswords > 0 ? `${stats.oldPasswords} stale` : 'All fresh ✓'}
                        </span>
                    </div>
                    <div className="p-4 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                        {oldPasswordItems.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                <CheckCircle2 size={28} className="text-green-500" />
                                All passwords are up to date!
                            </div>
                        ) : oldPasswordItems.map(i => {
                            const age = daysOld(i.updatedAt);
                            return (
                                <div key={i._id} className="flex items-center gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">{i.appName || 'Unnamed'}</p>
                                        <p className="text-[10px] text-muted-foreground">{i.username || i.ssid || ''}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-black text-orange-400">{age}d old</p>
                                        <p className="text-[9px] text-muted-foreground">last changed</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Missing 2FA */}
                <motion.div {...fadeUp(0.32)} className="glass-panel rounded-3xl border border-border overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
                        <div className="p-2 bg-red-500/10 rounded-xl text-red-500"><ShieldOff size={16} /></div>
                        <div>
                            <h3 className="font-bold text-sm">Missing 2FA</h3>
                            <p className="text-[10px] text-muted-foreground">Login items without TOTP</p>
                        </div>
                        <span className={clsx(
                            'ml-auto text-xs font-black px-2 py-1 rounded-xl',
                            stats.missing2fa > 0 ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-500'
                        )}>
                            {stats.missing2fa > 0 ? `${stats.missing2fa} at risk` : 'All secured ✓'}
                        </span>
                    </div>
                    <div className="p-4 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                        {missing2faItems.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                <CheckCircle2 size={28} className="text-green-500" />
                                All logins have 2FA enabled!
                            </div>
                        ) : missing2faItems.map(i => (
                            <div key={i._id} className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                                <ShieldOff size={14} className="text-red-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{i.appName || 'Unnamed'}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{i.username || ''}</p>
                                </div>
                                <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-lg shrink-0">No 2FA</span>
                            </div>
                        ))}
                        {stats.missing2fa > 5 && (
                            <p className="text-center text-[10px] font-bold text-muted-foreground py-1">
                                +{stats.missing2fa - 5} more items without 2FA
                            </p>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* ── Activity Heatmap ──────────────────────────────────────── */}
            <motion.div {...fadeUp(0.38)}>
                <ActivityHeatmap items={items} />
            </motion.div>

            {/* ── Critical Alerts section ───────────────────────────────── */}
            <section className="space-y-4">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <ShieldAlert className="text-primary shrink-0" />
                    Security Recommendations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stats.weak > 0 && (
                        <Alert icon={AlertTriangle} color="red"
                            title={`${stats.weak} Weak Password${stats.weak > 1 ? 's' : ''} Detected`}
                            desc="Use the built-in Password Generator (wand icon on any item) to create secure, random passwords instantly."
                        />
                    )}
                    {stats.reused > 0 && (
                        <Alert icon={ShieldEllipsis} color="yellow"
                            title={`${stats.reused} Reused Password${stats.reused > 1 ? 's' : ''}`}
                            desc="Password reuse enables credential stuffing attacks. Generate a unique password for each account."
                        />
                    )}
                    {stats.missing2fa > 0 && (
                        <Alert icon={ShieldOff} color="orange"
                            title={`${stats.missing2fa} Login${stats.missing2fa > 1 ? 's' : ''} Without 2FA`}
                            desc="Enable TOTP-based two-factor authentication by adding a secret key when editing each login item."
                        />
                    )}
                    {stats.oldPasswords > 0 && (
                        <Alert icon={Clock} color="orange"
                            title={`${stats.oldPasswords} Stale Password${stats.oldPasswords > 1 ? 's' : ''} (90+ days)`}
                            desc="Regularly rotating passwords reduces exposure from unreported data breaches."
                        />
                    )}
                    {stats.score >= 90 && (
                        <Alert icon={CheckCircle2} color="green"
                            title="Excellent Security Profile"
                            desc="Your vault health is top-tier. Keep maintaining unique and strong passwords for each account."
                        />
                    )}
                    <Alert icon={Info} color="blue"
                        title="Dark Web Monitoring"
                        desc='Use the "Audit" button on any vault item to check if your password has appeared in known data breaches via HaveIBeenPwned.'
                    />
                </div>
            </section>
        </div>
    );
};

// ─── Simple Alert Card ───────────────────────────────────────────────────────
const COLOR_MAP = {
    red:    { bg: 'bg-red-500/5 border-red-500/25',    icon: 'text-red-500 bg-red-500/10' },
    yellow: { bg: 'bg-yellow-500/5 border-yellow-500/25', icon: 'text-yellow-500 bg-yellow-500/10' },
    orange: { bg: 'bg-orange-500/5 border-orange-500/25', icon: 'text-orange-400 bg-orange-500/10' },
    green:  { bg: 'bg-green-500/5 border-green-500/25',  icon: 'text-green-500 bg-green-500/10' },
    blue:   { bg: 'bg-blue-500/5 border-blue-500/25',   icon: 'text-blue-500 bg-blue-500/10' },
};

const Alert = ({ icon: Icon, color, title, desc }) => {
    const c = COLOR_MAP[color] || COLOR_MAP.blue;
    return (
        <div className={`glass-panel p-5 rounded-2xl border flex gap-4 ${c.bg}`}>
            <div className={`p-2 rounded-xl h-fit shrink-0 ${c.icon}`}><Icon size={18} /></div>
            <div>
                <p className="font-bold text-sm mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
        </div>
    );
};

export default SecurityAudit;
