import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin, verifySuperAdmin } from '../middleware/adminAuthMiddleware.js';
import User from '../models/User.js';
import VaultItem from '../models/VaultItem.js';
import AuditLog from '../models/AuditLog.js';
import SupportTicket from '../models/SupportTicket.js';

const router = express.Router();

// GET all users (Admin & SuperAdmin only)
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        // Fetch users but exclude sensitive data. Specifically include phoneNumber and securityStats
        const users = await User.find({}, '-passwordHash -masterAuthHash -recoveryHash -sessions -passkeys').lean().sort({ createdAt: -1 });
        
        for (let user of users) {
             const count = await VaultItem.countDocuments({ userId: user._id });
             if (!user.securityStats) user.securityStats = {};
             user.securityStats.totalItems = count;
        }

        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users for admin', error);
        res.status(500).json({ message: 'Internal server error fetching users' });
    }
});

// DELETE a user (SuperAdmin or Admin depending on policy, but we will allow SuperAdmin only, or Admin if configured)
// For max security, let's allow both but SuperAdmin can delete Admins
router.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentAdmin = req.adminUser; // from verifyAdmin middleware

        if (targetUserId === currentAdmin._id.toString()) {
            return res.status(400).json({ message: 'You cannot delete yourself.' });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found.' });
        }

        // Only superadmin can delete another admin
        if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
            if (currentAdmin.role !== 'superadmin') {
                return res.status(403).json({ message: 'Forbidden - Only SuperAdmins can delete Admin accounts.' });
            }
        }

        // Start deletion process
        // 1. Delete all vault items belonging to user
        await VaultItem.deleteMany({ userId: targetUserId });
        await SupportTicket.deleteMany({ userId: targetUserId });

        // 2. Log this action
        await AuditLog.create({
            adminId: currentAdmin._id,
            action: 'DELETE_USER',
            targetUserId: targetUserId,
            details: `Admin ${currentAdmin.email} deleted user ${targetUser.email}`,
            ip: req.ip || req.connection.remoteAddress
        });

        // 3. Delete user
        await User.findByIdAndDelete(targetUserId);

        res.status(200).json({ message: 'User and all associated data deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user by admin', error);
        res.status(500).json({ message: 'Internal server error while deleting user' });
    }
});

// GET all support tickets
router.get('/tickets', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const tickets = await SupportTicket.find().populate('userId', 'email name').sort({ createdAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        console.error('Error fetching admin tickets', error);
        res.status(500).json({ message: 'Internal server error fetching tickets' });
    }
});

// PUT update ticket status
router.put('/tickets/:id/status', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['OPEN', 'RESOLVED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        
        const ticket = await SupportTicket.findByIdAndUpdate(
            req.params.id, 
            { status }, 
            { new: true }
        ).populate('userId', 'email name');
        
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
        
        res.status(200).json(ticket);
    } catch (error) {
        console.error('Error updating ticket status', error);
        res.status(500).json({ message: 'Internal server error updating ticket' });
    }
});

// PUT add admin reply
router.put('/tickets/:id/reply', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { reply } = req.body;
        if (!reply || reply.trim() === '') {
            return res.status(400).json({ message: 'Reply message is required' });
        }

        const ticket = await SupportTicket.findByIdAndUpdate(
            req.params.id,
            { adminReply: reply.trim() },
            { new: true }
        ).populate('userId', 'email name');

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        res.status(200).json(ticket);
    } catch (error) {
        console.error('Error replying to ticket', error);
        res.status(500).json({ message: 'Internal server error replying to ticket' });
    }
});

// PUT Admin force-reset user login password
router.put('/users/:id/reset-login-password', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { newLoginPassword } = req.body;
        if (!newLoginPassword) {
            return res.status(400).json({ message: 'New login password is required' });
        }

        const targetUserId = req.params.id;
        const currentAdmin = req.adminUser;

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        // Only superadmin can reset another admin's or superadmin's password
        if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
            if (currentAdmin.role !== 'superadmin') {
                return res.status(403).json({ message: 'Forbidden - Only SuperAdmins can reset Admin passwords.' });
            }
        }

        targetUser.passwordHash = newLoginPassword;
        await targetUser.save();

        await AuditLog.create({
            adminId: currentAdmin._id,
            action: 'RESET_PASSWORD',
            targetUserId: targetUserId,
            details: `Admin ${currentAdmin.email} forced reset login password for ${targetUser.email}`,
            ip: req.ip || req.connection.remoteAddress
        });

        res.status(200).json({ message: 'User login password reset successfully' });
    } catch (error) {
        console.error('Error resetting login password by admin', error);
        res.status(500).json({ message: 'Internal server error while resetting login password' });
    }
});

export default router;
