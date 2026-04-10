import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trash2, Search, ShieldAlert, AlertCircle, Check, HelpCircle, Phone, FileText, Lock, Activity, Eye, ShieldCheck, Info, MessageSquare } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';
import { API_URL } from '../lib/api';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'tickets'
    const [users, setUsers] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const currentUser = useAuthStore(s => s.user);
    const addToast = useToastStore(s => s.addToast);

    const [deleteModal, setDeleteModal] = useState({ show: false, targetUser: null, confirmation: '' });
    const [selectedUser, setSelectedUser] = useState(null); // For User Detail Modal
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        } else {
            fetchTickets();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/admin/users`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
            addToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/admin/tickets`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setTickets(data);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            addToast('Failed to load tickets', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResolveTicket = async (ticketId) => {
        try {
            const res = await fetch(`${API_URL}/admin/tickets/${ticketId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'RESOLVED' }),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to resolve');
            addToast('Ticket marked as resolved', 'success');
            fetchTickets();
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const handleReplyTicket = async (ticketId, markResolved = false) => {
        try {
            if (replyText.trim() !== '') {
                const res = await fetch(`${API_URL}/admin/tickets/${ticketId}/reply`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reply: replyText }),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error('Failed to send reply');
                addToast('Reply sent', 'success');
            }
            if (markResolved) {
                await handleResolveTicket(ticketId); // this handles fetchTickets internally
            } else {
                fetchTickets();
            }
            setReplyingTo(null);
            setReplyText('');
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const handleDeleteUser = async (e) => {
        e.preventDefault();
        if (deleteModal.confirmation !== 'DELETE') {
            addToast('Please type DELETE to confirm', 'error');
            return;
        }

        try {
            setIsDeleting(true);
            const res = await fetch(`${API_URL}/admin/users/${deleteModal.targetUser._id}`, { 
                method: 'DELETE',
                credentials: 'include' 
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete user');
            }
            addToast('User and all data deleted permanently', 'success');
            setDeleteModal({ show: false, targetUser: null, confirmation: '' });
            setSelectedUser(null);
            fetchUsers();
        } catch (error) {
            console.error('Delete error:', error);
            addToast(error.message || 'Failed to delete user', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Super <span className="text-primary">Admin</span></h1>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium">Manage users, security policies, and support cases.</p>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-4 border-b border-border mb-6">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 font-bold text-sm tracking-wide transition-colors relative ${activeTab === 'users' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Users size={18} className="inline mr-2 -mt-0.5" /> 
                    User Accounts
                    {activeTab === 'users' && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 w-full h-[2px] bg-primary" />}
                </button>
                <button
                    onClick={() => setActiveTab('tickets')}
                    className={`pb-3 font-bold text-sm tracking-wide transition-colors relative ${activeTab === 'tickets' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <HelpCircle size={18} className="inline mr-2 -mt-0.5" /> 
                    Support Tickets
                    {activeTab === 'tickets' && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 w-full h-[2px] bg-primary" />}
                </button>
            </div>

            {/* Content Area */}
            <div className="glass-panel border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6">
                
                {activeTab === 'users' && (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Users className="text-primary" size={24} /> Registered Users
                            </h2>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search email or name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-primary/50"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border/50 text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        <th className="pb-3 px-2 sm:px-4 text-center w-10 sm:w-12">Det.</th>
                                        <th className="pb-3 px-2 sm:px-4">User</th>
                                        <th className="pb-3 px-2 sm:px-4 hidden sm:table-cell">Role</th>
                                        <th className="pb-3 px-2 sm:px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-8 text-muted-foreground">Loading users...</td>
                                        </tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-8 text-muted-foreground">No users found.</td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user._id} className="border-b border-border/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                                                <td className="py-4 px-4 text-center">
                                                    <button onClick={() => setSelectedUser(user)} className="p-1.5 text-muted-foreground hover:text-primary bg-black/5 dark:bg-white/5 rounded-lg">
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                                <td className="py-3 sm:py-4 px-2 sm:px-4">
                                                    <div className="flex items-center gap-2 sm:gap-3">
                                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-xs sm:text-sm font-bold shadow-sm shrink-0">
                                                            {(user.name || user.email).charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-xs sm:text-sm text-foreground truncate max-w-[120px] sm:max-w-none">{user.name || 'No Name'}</div>
                                                            <div className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-none">{user.email}</div>
                                                            <div className="sm:hidden mt-1">
                                                                <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full uppercase tracking-wider ${
                                                                    user.role === 'superadmin' ? 'bg-purple-500/20 text-purple-500' :
                                                                    user.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-border text-foreground opacity-70'
                                                                }`}>
                                                                    {user.role}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 sm:py-4 px-2 sm:px-4 hidden sm:table-cell">
                                                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                                                        user.role === 'superadmin' ? 'bg-purple-500/20 text-purple-500' :
                                                        user.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-border text-foreground opacity-70'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 sm:py-4 px-2 sm:px-4 text-right">
                                                    {user._id !== currentUser.uid && (
                                                        <button
                                                            onClick={() => setDeleteModal({ show: true, targetUser: user, confirmation: '' })}
                                                            className="p-1.5 sm:p-2 ml-auto text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors border border-red-500/30"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={14} className="sm:size-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'tickets' && (
                    <>
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                            <HelpCircle className="text-primary" size={24} /> Support Queue
                        </h2>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
                        ) : tickets.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground bg-black/5 dark:bg-white/5 rounded-2xl border border-border">
                                No active support tickets.
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {tickets.map(ticket => (
                                    <div key={ticket._id} className={`p-5 rounded-2xl border ${ticket.status === 'OPEN' ? 'bg-primary/5 border-primary/20' : 'bg-black/5 dark:bg-white/5 border-border'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-lg">{ticket.subject}</h3>
                                                <p className="text-xs font-bold text-primary mb-3 mt-1">From: {ticket.userId?.email || 'Unknown User'}</p>
                                            </div>
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${ticket.status === 'RESOLVED' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-400'}`}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-background border border-border rounded-xl text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                                            {ticket.message}
                                        </div>
                                        
                                        {ticket.adminReply && (
                                            <div className="mt-2 mb-4 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                                                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1">
                                                    <ShieldCheck size={14} /> Admin Reply
                                                </p>
                                                <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{ticket.adminReply}</p>
                                            </div>
                                        )}

                                        {replyingTo === ticket._id && (
                                            <div className="mt-4 mb-4 space-y-3">
                                                <textarea
                                                    rows={3}
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder="Type your reply here..."
                                                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary resize-none text-sm"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setReplyingTo(null)} className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                                                    <button onClick={() => handleReplyTicket(ticket._id, false)} disabled={!replyText.trim()} className="px-3 py-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1"><MessageSquare size={14}/> Send Reply</button>
                                                    <button onClick={() => handleReplyTicket(ticket._id, true)} disabled={!replyText.trim()} className="px-3 py-1.5 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1"><Check size={14}/> Send & Resolve</button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                                Created: {new Date(ticket.createdAt).toLocaleString()}
                                            </p>
                                            {ticket.status === 'OPEN' && replyingTo !== ticket._id && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { setReplyingTo(ticket._id); setReplyText(ticket.adminReply || ''); }}
                                                        className="px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors rounded-lg text-xs font-bold flex items-center gap-2"
                                                    >
                                                        <MessageSquare size={14} /> Reply
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolveTicket(ticket._id)}
                                                        className="px-4 py-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors rounded-lg text-xs font-bold flex items-center gap-2"
                                                    >
                                                        <Check size={14} /> Mark Resolved
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* User Detail Modal (Zero-Knowledge Verified) */}
            <AnimatePresence>
                {selectedUser && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-card w-full max-w-xl rounded-3xl border border-border p-6 shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground font-bold text-sm bg-black/5 dark:bg-white/5 py-1.5 px-3 rounded-lg">Close</button>
                            </div>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-2xl font-black shadow-lg">
                                    {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedUser.name || 'Unnamed User'}</h2>
                                    <p className="text-muted-foreground text-sm">{selectedUser.email}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Phone size={12}/> Phone Number</p>
                                    <p className="text-sm font-bold">{selectedUser.phoneNumber || 'Not provided'}</p>
                                </div>
                                <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><ShieldCheck size={12}/> Account Role</p>
                                    <p className="text-sm font-bold uppercase text-primary">{selectedUser.role}</p>
                                </div>
                            </div>

                            {/* Zero-Knowledge Stats Presentation */}
                            <div className="p-5 border border-primary/20 bg-primary/5 rounded-3xl relative overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                        <Lock className="text-primary" size={16} /> Zero-Knowledge Security Profile
                                    </h3>
                                    {selectedUser.securityStats?.lastSynced && (
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">
                                            Synced: {new Date(selectedUser.securityStats.lastSynced).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-background rounded-xl p-3 border border-border">
                                        <p className="text-2xl font-black text-foreground">{selectedUser.securityStats?.totalItems || 0}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Total Vault Items</p>
                                    </div>
                                    <div className="bg-background rounded-xl p-3 border border-border">
                                        <p className="text-2xl font-black text-green-500">{selectedUser.securityStats?.strongPasswords || 0}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Strong Passwords</p>
                                    </div>
                                    <div className="bg-background rounded-xl p-3 border border-border">
                                        <p className="text-2xl font-black text-red-500">{selectedUser.securityStats?.weakPasswords || 0}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Weak Passwords</p>
                                    </div>
                                </div>
                                
                                <p className="text-[10px] text-muted-foreground mt-4 flex items-start gap-1.5 leading-relaxed">
                                    <Info size={12} className="shrink-0 mt-0.5 text-primary" />
                                    These statistics are calculated securely on the client-side and synchronized anonymously to respect the zero-knowledge architecture. Placed passwords remain mathematically inaccessible.
                                </p>
                            </div>

                            {selectedUser.role !== 'superadmin' && (
                                <div className="mt-8 pt-6 border-t border-border flex justify-end">
                                    <button
                                        onClick={() => setDeleteModal({ show: true, targetUser: selectedUser, confirmation: '' })}
                                        className="px-5 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors rounded-xl font-bold flex items-center gap-2 text-sm"
                                    >
                                        <Trash2 size={16} /> Delete Account
                                    </button>
                                </div>
                            )}

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Deletion Modal */}
            <AnimatePresence>
                {deleteModal.show && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-card w-full max-w-md rounded-2xl border border-destructive/30 p-6 shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400" />
                            <div className="flex items-center gap-3 mb-4 text-destructive">
                                <ShieldAlert size={28} />
                                <h3 className="text-lg font-bold">Permanently Delete User</h3>
                            </div>
                            
                            <div className="bg-destructive/10 text-destructive p-3 rounded-xl mb-4 text-sm font-medium">
                                <p className="flex items-start gap-2">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    This action is irreversible. It will instantly destroy the user account ({deleteModal.targetUser.email}) and ALL their encrypted vault data.
                                </p>
                            </div>

                            <form onSubmit={handleDeleteUser}>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                                    Type "DELETE" to confirm
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={deleteModal.confirmation}
                                    onChange={(e) => setDeleteModal({ ...deleteModal, confirmation: e.target.value })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-destructive transition-colors text-foreground font-bold"
                                    placeholder="DELETE"
                                />
                                
                                <div className="mt-6 flex justify-end gap-3 text-sm">
                                    <button
                                        type="button"
                                        onClick={() => setDeleteModal({ show: false, targetUser: null, confirmation: '' })}
                                        className="px-4 py-2 text-foreground font-bold hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isDeleting || deleteModal.confirmation !== 'DELETE'}
                                        className="px-4 py-2 bg-destructive text-destructive-foreground font-bold rounded-xl flex items-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Destroy Data'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
