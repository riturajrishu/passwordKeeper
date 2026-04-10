import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SecureFile from '../models/SecureFile.js';
import VaultItem from '../models/VaultItem.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Setup multer disk storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'secure_' + uniqueSuffix + '.enc');
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit to ensure zero-bugs with CryptoJS memory
});

// All routes require authentication
router.use(verifyToken);

// @route   POST /api/files/upload
// @desc    Upload an encrypted file and create a SecureFile record
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Keep track of the original size info for limits, even though it's encrypted here
        const newSecureFile = new SecureFile({
            userId: req.user.uid,
            storagePath: req.file.path,
            originalSize: req.file.size
        });

        const savedFile = await newSecureFile.save();

        res.status(201).json({ 
            message: 'File uploaded securely',
            secureFileId: savedFile._id 
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
});

// @route   GET /api/files/download/:id
// @desc    Download the encrypted file
router.get('/download/:id', async (req, res) => {
    try {
        const secureFile = await SecureFile.findById(req.params.id);
        
        if (!secureFile) {
            return res.status(404).json({ message: 'Secure file not found' });
        }

        if (secureFile.userId !== req.user.uid) {
            return res.status(403).json({ message: 'Unauthorized access to file' });
        }

        if (!fs.existsSync(secureFile.storagePath)) {
            return res.status(404).json({ message: 'Physical file missing from server' });
        }

        // Stream the file back to client
        // Provide generic headers; it's just raw ciphertext data
        res.setHeader('Content-Type', 'text/plain'); 
        res.setHeader('Content-Disposition', `attachment; filename="${secureFile._id}.enc"`);
        
        const fileStream = fs.createReadStream(secureFile.storagePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ message: 'Server error during download' });
    }
});

// @route   DELETE /api/files/:id
// @desc    Delete the encrypted file from disk and database
router.delete('/:id', async (req, res) => {
    try {
        const secureFile = await SecureFile.findById(req.params.id);
        
        if (!secureFile) {
            return res.status(404).json({ message: 'Secure file not found' });
        }

        if (secureFile.userId !== req.user.uid) {
            return res.status(403).json({ message: 'Unauthorized access to file' });
        }

        // Delete physical file
        if (fs.existsSync(secureFile.storagePath)) {
            fs.unlinkSync(secureFile.storagePath);
        }

        // Delete database record
        await SecureFile.deleteOne({ _id: secureFile._id });

        res.status(200).json({ message: 'File deleted securely' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ message: 'Server error during file deletion' });
    }
});

export default router;
