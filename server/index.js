import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import vaultRoutes from './routes/vaultRoutes.js';
import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import passkeyRoutes from './routes/passkeyRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import shareRoutes from './routes/shareRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import fileRoutes from './routes/fileRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Production Check
if (process.env.NODE_ENV === 'production') {
  console.log('--- PRODUCTION MODE ACTIVE ---');
  if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for easier initial deployment, can be hardened later
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(cookieParser());

// Static Files (Frontend Build)
const buildPath = path.join(__dirname, '../client/dist');
app.use(express.static(buildPath));

// Database Connection
console.log('Connecting to Database...');
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/passkeys', passkeyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/files', fileRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'API is running' });
});

// Catch-all route for SPA (MUST be after API routes)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
