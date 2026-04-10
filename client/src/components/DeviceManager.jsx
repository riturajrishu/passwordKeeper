import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Laptop, Globe, LogOut, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import useToastStore from '../store/useToastStore';
import { API_URL } from '../lib/api';

export default function DeviceManager() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const addToast = useToastStore(s => s.addToast);

    const fetchSessions = async () => {
        try {
            const res = await fetch(`${API_URL}/devices`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const revokeSession = async (sessionId) => {
        try {
            const res = await fetch(`${API_URL}/devices/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                addToast('Device disconnected', 'success');
                setSessions(s => s.filter(x => x.id !== sessionId));
            } else {
                addToast('Failed to disconnect device', 'error');
            }
        } catch (e) {
            addToast('Error disconnecting device', 'error');
        }
    };

    const revokeAllOthers = async () => {
        try {
            const res = await fetch(`${API_URL}/devices/revoke-all`, {
                method: 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                addToast('All other devices disconnected', 'success');
                setSessions(s => s.filter(x => x.isCurrent));
            }
        } catch (e) {
            addToast('Error disconnecting devices', 'error');
        }
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <section className="glass-panel p-8 rounded-3xl border border-border space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Smartphone size={20} /></div>
                    <h2 className="text-xl font-bold">Active Devices</h2>
                </div>
                {sessions.length > 1 && (
                    <button
                        onClick={revokeAllOthers}
                        className="text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <ShieldAlert size={14} /> Revoke Others
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {sessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/50">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-background rounded-xl text-primary shadow-sm border border-border/50">
                                {session.browser?.toLowerCase().includes('mobile') ? <Smartphone size={24} /> : <Laptop size={24} />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-sm">
                                        {session.browser !== 'Unknown' ? session.browser : 'Unknown Browser'}
                                    </h4>
                                    {session.isCurrent && (
                                        <span className="text-[9px] uppercase tracking-widest font-bold bg-green-500/20 text-green-500 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Current
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1"><Globe size={12} /> {session.ip || 'Unknown IP'}</span>
                                    <span>•</span>
                                    <span>Last active: {new Date(session.lastActive).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {!session.isCurrent && (
                            <button
                                onClick={() => revokeSession(session.id)}
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                title="Log out device"
                            >
                                <LogOut size={18} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
