import express from 'express';
import VaultItem from '../models/VaultItem.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { vaultItemValidator } from '../middleware/validationMiddleware.js';
import fs from 'fs';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// @route   GET /api/vault
// @desc    Get all vault items for the authenticated user
router.get('/', async (req, res) => {
    try {
        const items = await VaultItem.find({ userId: req.user.uid }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        console.error('Error fetching vault items:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/vault
// @desc    Create a new encrypted vault item
router.post('/', vaultItemValidator, async (req, res) => {
    try {
        if (!req.body) {
            console.error('CRITICAL: req.body is completely undefined! Headers:', req.headers);
        }
        
        const { encryptedBlob, category, isFavorite, itemType, tags } = req.body || {};
        
        if (!encryptedBlob) {
            return res.status(400).json({ message: 'Encrypted payload is required' });
        }

        const newItem = new VaultItem({
            userId: req.user.uid,
            encryptedBlob,
            category,
            isFavorite,
            ...(itemType && { itemType }),
            ...(tags && { tags })
        });

        const savedItem = await newItem.save();
        res.status(201).json(savedItem);
    } catch (error) {
        console.error('Error creating vault item:', error);
        try { fs.writeFileSync('vault_500_error.log', String(error.stack || error)); } catch(e){}
        res.status(500).json({ message: 'Server error', details: String(error) });
    }
});

// @route   PUT /api/vault/re-encrypt-all
// @desc    Bulk update vault items during re-encryption
// NOTE: This route MUST be defined BEFORE /:id routes — otherwise Express
//       matches "re-encrypt-all" as an :id parameter and throws a CastError.
router.put('/re-encrypt-all', async (req, res) => {
    try {
        const { items } = req.body; // Array of { id, encryptedBlob }
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ message: 'Items array is required' });
        }

        if (items.length === 0) {
           return res.json({ message: 'No items to update' });
        }

        // Validate structure of items to avoid corrupting db with empty blobs
        const isValid = items.every(item => item.id && item.encryptedBlob && typeof item.encryptedBlob === 'string');
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid payload structure. Expected id and encryptedBlob string for each item.' });
        }

        const bulkOps = items.map(item => ({
            updateOne: {
                filter: { _id: item.id, userId: req.user.uid },
                update: { $set: { encryptedBlob: item.encryptedBlob, updatedAt: Date.now() } }
            }
        }));

        const result = await VaultItem.bulkWrite(bulkOps);
        
        if (result.hasWriteErrors) {
            console.error('Partial failure in bulk update:', result.writeErrors);
            return res.status(207).json({ message: 'Vault re-encryption completed with some errors', errors: result.writeErrors });
        }

        res.json({ message: 'Vault re-encrypted and updated successfully' });
    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({ message: 'Server error during bulk update' });
    }
});

// @route   PUT /api/vault/:id
// @desc    Update an encrypted vault item
router.put('/:id', vaultItemValidator, async (req, res) => {
    try {
        const { encryptedBlob, category, isFavorite, itemType, tags, isDeleted } = req.body;
        
        const currentItem = await VaultItem.findOne({ _id: req.params.id, userId: req.user.uid });
        if (!currentItem) return res.status(404).json({ message: 'Item not found or unauthorized' });

        const updateData = {
            ...(category !== undefined && { category }),
            ...(isFavorite !== undefined && { isFavorite }),
            ...(itemType !== undefined && { itemType }),
            ...(tags !== undefined && { tags }),
            ...(isDeleted !== undefined && { 
                isDeleted, 
                deletedAt: isDeleted ? Date.now() : null 
            }),
            updatedAt: Date.now()
        };

        let dbUpdateQuery = { $set: updateData };

        if (encryptedBlob && currentItem.encryptedBlob !== encryptedBlob) {
            updateData.encryptedBlob = encryptedBlob;
            dbUpdateQuery.$push = {
                passwordHistory: {
                    $each: [{ encryptedBlob: currentItem.encryptedBlob, updatedAt: currentItem.updatedAt }],
                    $slice: -5
                }
            };
        }

        const updatedItem = await VaultItem.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.uid },
            dbUpdateQuery,
            { new: true }
        );

        res.json(updatedItem);
    } catch (error) {
        console.error('Error updating vault item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/vault/:id
// @desc    Soft delete a vault item (move to trash)
router.delete('/:id', async (req, res) => {
    try {
        const updatedItem = await VaultItem.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.uid },
            { $set: { isDeleted: true, deletedAt: Date.now() } },
            { new: true }
        );
        if (!updatedItem) return res.status(404).json({ message: 'Item not found or unauthorized' });
        res.json({ message: 'Item moved to trash' });
    } catch (error) {
        console.error('Error soft deleting vault item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/vault/:id/permanent
// @desc    Permanently delete a vault item
router.delete('/:id/permanent', async (req, res) => {
    try {
        const deletedItem = await VaultItem.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
        if (!deletedItem) {
            return res.status(404).json({ message: 'Item not found or unauthorized' });
        }
        res.json({ message: 'Item permanently removed' });
    } catch (error) {
        console.error('Error permanently deleting vault item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/vault/:id/restore
// @desc    Restore a soft-deleted vault item
router.put('/:id/restore', async (req, res) => {
    try {
        const restoredItem = await VaultItem.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.uid },
            { $set: { isDeleted: false, deletedAt: null } },
            { new: true }
        );
        if (!restoredItem) return res.status(404).json({ message: 'Item not found or unauthorized' });
        res.json(restoredItem);
    } catch (error) {
        console.error('Error restoring vault item:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
