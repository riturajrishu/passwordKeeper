import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { registerValidator } from '../middleware/validationMiddleware.js';

const router = express.Router();

const generateAuthToken = (userId) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET environment variable is missing");
    }
    return jwt.sign({ uid: userId }, secret, { expiresIn: '14d' });
};

router.post('/register', registerValidator, async (req, res) => {
    try {
        const { email, loginPassword, masterAuthHash, name, phoneNumber, passwordHint, recoveryHash } = req.body;
        
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({ 
            email, 
            passwordHash: loginPassword,
            masterAuthHash: masterAuthHash,
            name: name || '',
            phoneNumber: phoneNumber || '',
            passwordHint: passwordHint || '',
            recoveryHash: recoveryHash
        });
        await user.save();

        const token = generateAuthToken(user._id);
        res.cookie('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
        });

        res.status(201).json({ 
            message: 'User registered successfully', 
            uid: user._id, 
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, loginPassword, authHash } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        let isMatch = false;
        if (user.masterAuthHash) {
            isMatch = await user.comparePassword(loginPassword);
        } else {
            isMatch = await user.comparePassword(authHash);
        }

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateAuthToken(user._id);
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Add to active sessions
        user.sessions.push({
            token,
            ip,
            browser: userAgent,
            os: 'Unknown',
            lastActive: new Date()
        });
        await user.save();

        res.cookie('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
        });

        res.json({ 
            message: 'Logged in successfully', 
            uid: user._id, 
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/logout', async (req, res) => {
    const token = req.cookies.session;
    if (token) {
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) throw new Error("JWT_SECRET missing");
            const decoded = jwt.verify(token, secret);
            const user = await User.findById(decoded.uid);
            if (user) {
                user.sessions = user.sessions.filter(s => s.token !== token);
                await user.save();
            }
        } catch (e) {
            console.error('Logout error updating sessions:', e);
        }
    }
    res.cookie('session', '', { maxAge: 0 });
    res.json({ message: 'Logged out successfully' });
});

router.get('/verify', async (req, res) => {
    try {
        const token = req.cookies.session;
        if (!token) return res.status(200).json({ authenticated: false });

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT_SECRET missing during verification");
            return res.status(200).json({ authenticated: false });
        }
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.uid).select('-passwordHash');
        if (!user) return res.status(200).json({ authenticated: false });

        // Check if session is revoked
        const sessionExists = user.sessions.some(s => s.token === token);
        if (!sessionExists && user.sessions.length > 0) { 
            res.cookie('session', '', { maxAge: 0 });
            return res.status(200).json({ authenticated: false, message: 'Session revoked' });
        }

        // Update lastActive opportunistically (can ignore errors)
        if (sessionExists) {
            User.updateOne(
                { _id: user._id, "sessions.token": token },
                { $set: { "sessions.$.lastActive": new Date() } }
            ).exec();
        }

        res.json({ 
            authenticated: true, 
            uid: user._id, 
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role
        });
    } catch (error) {
        console.error('Verify session error:', error);
        res.status(200).json({ authenticated: false });
    }
});

// @route   POST /api/auth/verify-master
// @desc    Verify master password without creating new session
router.post('/verify-master', verifyToken, async (req, res) => {
    try {
        const { authHash } = req.body;
        if (!authHash) return res.status(400).json({ message: 'Auth hash required' });

        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await user.compareMaster(authHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect master password' });
        }

        res.json({ message: 'Verified successfully' });
    } catch (error) {
        console.error('Verify master error:', error);
        res.status(500).json({ message: 'Server error during verification' });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile details
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { name, phoneNumber } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.uid,
            { $set: { name, phoneNumber } },
            { new: true }
        ).select('-passwordHash');

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ 
            message: 'Profile updated successfully',
            uid: user._id,
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error during profile update' });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Get password hint for an email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        // Generic response to prevent email enumeration
        const genericMessage = { message: 'If an account with that email exists, the password hint has been retrieved.' };
        
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        
        if (!user) {
            // Success status but generic message (Privacy: don't reveal if email exists)
            return res.json({ ...genericMessage, hint: 'Check your email for instructions' });
        }

        res.json({ email: user.email, hint: user.passwordHint || 'No hint set' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset master password using recovery key
router.post('/reset-password', async (req, res) => {
    try {
        const { email, recoveryKey, newMasterAuthHash } = req.body;
        const user = await User.findOne({ email });

        if (!user || !user.recoveryHash) {
            return res.status(400).json({ message: 'Recovery not available for this account' });
        }

        const isMatch = await bcrypt.compare(recoveryKey, user.recoveryHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid recovery key' });
        }

        if (!user.masterAuthHash) {
            // Legacy user fallback
            user.passwordHash = newMasterAuthHash;
        } else {
            user.masterAuthHash = newMasterAuthHash;
        }
        await user.save();

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ message: 'Server error during password reset' });
    }
});

// @route   PUT /api/auth/update-security
// @desc    Update user email, loginPassword, or masterAuthHash
router.put('/update-security', verifyToken, async (req, res) => {
    try {
        const { currentLoginPassword, currentAuthHash, newEmail, newLoginPassword, newMasterAuthHash } = req.body;
        
        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Verify current password first
        let isMatch = false;
        if (user.masterAuthHash) {
            isMatch = await user.comparePassword(currentLoginPassword);
        } else {
            isMatch = await user.comparePassword(currentAuthHash);
        }

        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        // Check if new email already exists (if email is being changed)
        if (newEmail && newEmail !== user.email) {
            const existingUser = await User.findOne({ email: newEmail });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            user.email = newEmail;
        }

        if (newLoginPassword) {
            user.passwordHash = newLoginPassword;
        }
        if (newMasterAuthHash) {
            user.masterAuthHash = newMasterAuthHash;
        }

        await user.save();

        res.json({ 
            message: 'Security details updated successfully',
            email: user.email,
            uid: user._id
        });
    } catch (error) {
        console.error('Security update error:', error);
        res.status(500).json({ message: 'Server error during security update' });
    }
});

// @route   PUT /api/auth/stats
// @desc    Sync zero-knowledge security stats calculated locally by the client
router.put('/stats', verifyToken, async (req, res) => {
    try {
        const { totalItems, weakPasswords, strongPasswords } = req.body;
        
        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.securityStats = {
            totalItems: totalItems || 0,
            weakPasswords: weakPasswords || 0,
            strongPasswords: strongPasswords || 0,
            lastSynced: new Date()
        };

        await user.save();
        res.status(200).json({ message: 'Stats synced successfully' });
    } catch (error) {
        console.error('Stats sync error:', error);
        res.status(500).json({ message: 'Server error during stats sync' });
    }
});

export default router;
