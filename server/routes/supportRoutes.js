import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import SupportTicket from '../models/SupportTicket.js';

const router = express.Router();

// @route   POST /api/support
// @desc    Create a new support ticket
router.post('/', verifyToken, async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        if (!subject || !message) {
            return res.status(400).json({ message: 'Subject and message are required' });
        }

        const ticket = new SupportTicket({
            userId: req.user.uid,
            subject,
            message
        });

        await ticket.save();
        res.status(201).json({ message: 'Ticket created successfully', ticket });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ message: 'Server error creating ticket' });
    }
});

// @route   GET /api/support
// @desc    Get all support tickets for the logged-in user
router.get('/', verifyToken, async (req, res) => {
    try {
        const tickets = await SupportTicket.find({ userId: req.user.uid }).sort({ createdAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        res.status(500).json({ message: 'Server error fetching tickets' });
    }
});

export default router;
