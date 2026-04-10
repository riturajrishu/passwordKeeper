import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Send, CheckCircle2, MessageSquare, Plus, Clock, ShieldCheck } from 'lucide-react';
import useToastStore from '../store/useToastStore';
import { API_URL } from '../lib/api';

export default function SupportCenter() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showNewTicket, setShowNewTicket] = useState(false);
    const [formData, setFormData] = useState({ subject: '', message: '' });
    const addToast = useToastStore(s => s.addToast);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await fetch(`${API_URL}/support`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch tickets');
            const data = await res.json();
            setTickets(data);
        } catch (error) {
            console.error(error);
            addToast('Could not load tickets', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/support`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to create ticket');
            addToast('Ticket submitted successfully', 'success');
            setFormData({ subject: '', message: '' });
            setShowNewTicket(false);
            fetchTickets();
        } catch (error) {
            addToast(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <HelpCircle className="text-primary" size={32} /> Support Center
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium mt-1">Need help or want to delete your account? Open a ticket.</p>
                </div>
                <button
                    onClick={() => setShowNewTicket(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                    <Plus size={20} /> New Ticket
                </button>
            </header>

            <AnimatePresence>
                {showNewTicket && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleSubmit} className="glass-panel border border-border rounded-3xl p-6 space-y-4 relative mb-8">
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                                <MessageSquare className="text-primary" /> Create Support Ticket
                            </h3>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="E.g., Request for Account Deletion"
                                    value={formData.subject}
                                    onChange={(e) => setFormData(f => ({ ...f, subject: e.target.value }))}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 focus:border-primary focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Describe your issue or request in detail..."
                                    value={formData.message}
                                    onChange={(e) => setFormData(f => ({ ...f, message: e.target.value }))}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 focus:border-primary focus:outline-none transition-colors resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowNewTicket(false)} className="px-5 py-2.5 text-muted-foreground font-bold hover:text-foreground">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold disabled:opacity-50">
                                    {isSubmitting ? 'Sending...' : <><Send size={18} /> Submit Ticket</>}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-4">
                <h2 className="text-lg font-bold">Your Tickets</h2>
                {loading ? (
                    <div className="text-center py-10 text-muted-foreground">Loading tickets...</div>
                ) : tickets.length === 0 ? (
                    <div className="glass-panel text-center py-12 rounded-3xl border border-border text-muted-foreground">
                        <MessageSquare className="mx-auto mb-3 opacity-30" size={40} />
                        You have no open support tickets.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {tickets.map(ticket => (
                            <div key={ticket._id} className="glass-panel border border-border rounded-2xl p-5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-bold text-lg">{ticket.subject}</h4>
                                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${ticket.status === 'RESOLVED' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-400'}`}>
                                        {ticket.status === 'RESOLVED' ? <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" /> : <Clock size={12} className="inline mr-1 -mt-0.5" />}
                                        {ticket.status}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                    Submitted on {new Date(ticket.createdAt).toLocaleDateString()}
                                </p>

                                {ticket.adminReply && (
                                    <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/50" />
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                            <ShieldCheck size={14} /> Official Support Reply
                                        </p>
                                        <p className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed">{ticket.adminReply}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
