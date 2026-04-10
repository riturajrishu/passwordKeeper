import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.cookies.session;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized - No session cookie provided' });
        }

        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error("FATAL: JWT_SECRET environment variable is not set!");
                return res.status(500).json({ message: 'Internal Server Error - Security Configuration Missing' });
            }
            const decodedToken = jwt.verify(token, secret);
            req.user = { uid: decodedToken.uid };

            // ── Dead Man's Switch: Update lastActiveAt silently ───────────
            // Fire-and-forget: do NOT await — must not slow down requests
            User.updateOne(
                { _id: decodedToken.uid },
                { $set: { lastActiveAt: new Date() } }
            ).exec().catch(() => { /* silent — non-critical */ });

            next();
        } catch (error) {
            console.error('Error verifying auth token', error);
            res.status(401).json({ message: 'Unauthorized - Invalid session token' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error during Authentication' });
    }
};
