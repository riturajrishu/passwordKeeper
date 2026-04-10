import express from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import User from '../models/User.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const rpName = 'Keeper X';
const rpID = 'localhost'; // In production, this should be the actual domain
const origin = `http://${rpID}:5173`;

// Store challenge temporarily (in production use Redis/DB)
const currentChallenges = {};

// 1. Generate Registration Options (Logged-in user wants to add a passkey)
router.get('/generate-registration-options', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const userPasskeys = user.passkeys || [];

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: new Uint8Array(Buffer.from(user._id.toString(), 'utf8')),
            userName: user.email,
            attestationType: 'none',
            excludeCredentials: userPasskeys.map(passkey => ({
                id: passkey.credentialID,
                type: 'public-key',
                transports: passkey.transports,
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        });

        currentChallenges[user._id.toString()] = options.challenge;

        res.json(options);
    } catch (error) {
        console.error('Registration options error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. Verify Registration Response
router.post('/verify-registration', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const expectedChallenge = currentChallenges[user._id.toString()];
        if (!expectedChallenge) return res.status(400).json({ message: 'Challenge expired or not found' });

        const body = req.body;
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;
            
            user.passkeys.push({
                credentialID: credential.id,
                credentialPublicKey: Buffer.from(credential.publicKey),
                counter: credential.counter,
                transports: credential.transports || body.response.transports || [],
            });
            await user.save();
            
            delete currentChallenges[user._id.toString()];
            return res.json({ verified: true });
        }
        res.status(400).json({ verified: false, message: 'Verification failed' });
    } catch (error) {
        console.error('Verify registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 3. Generate Auth Options (User wants to login with passkey)
router.post('/generate-auth-options', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        const userPasskeys = user.passkeys || [];
        if (userPasskeys.length === 0) {
            return res.status(400).json({ message: 'No passkeys registered for this account' });
        }

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials: userPasskeys.map(key => ({
                id: key.credentialID,
                type: 'public-key',
                transports: key.transports,
            })),
            userVerification: 'preferred',
        });

        currentChallenges[user._id.toString()] = options.challenge;
        res.json(options);
    } catch (error) {
        console.error('Auth options error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. Verify Auth Response
router.post('/verify-auth', async (req, res) => {
    try {
        const { email, response } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const expectedChallenge = currentChallenges[user._id.toString()];
        if (!expectedChallenge) return res.status(400).json({ message: 'Challenge expired' });

        const passkey = user.passkeys.find(k => k.credentialID === response.id);
        if (!passkey) return res.status(400).json({ message: 'Passkey not recognized' });

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: passkey.credentialID,
                publicKey: new Uint8Array(passkey.credentialPublicKey),
                counter: passkey.counter,
                transports: passkey.transports,
            },
        });

        if (verification.verified) {
            passkey.counter = verification.authenticationInfo.newCounter;
            
            // Login success - generate session
            const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET || 'secret-12345', { expiresIn: '14d' });
            
            const userAgent = req.headers['user-agent'] || 'Unknown';
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

            user.sessions.push({
                token, ip, browser: userAgent, os: 'Unknown', lastActive: new Date()
            });
            await user.save();
            delete currentChallenges[user._id.toString()];

            res.cookie('session', token, {
                httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 14 * 24 * 60 * 60 * 1000
            });

            return res.json({ 
                verified: true, 
                message: 'Logged in securely with Passkey',
                uid: user._id,
                email: user.email,
                name: user.name,
                phoneNumber: user.phoneNumber,
                role: user.role
            });
        }
        res.status(400).json({ verified: false });
    } catch (error) {
        console.error('Verify auth error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
