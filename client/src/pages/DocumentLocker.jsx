import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UploadCloud, FileText, Download, Trash2, Eye, ShieldCheck,
    Loader2, AlertCircle, Search, Filter, HardDrive, Lock
} from 'lucide-react';
import {
    fetchVaultItems,
    createVaultItem,
    deleteVaultItem,
    uploadSecureFile,
    downloadSecureFile,
    deleteSecureFile
} from '../lib/api';
import { encryptData, decryptData, encryptFile, decryptFile } from '../lib/crypto';
import useAuthStore from '../store/useAuthStore';
import useToastStore from '../store/useToastStore';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit to prevent browser memory issues

const CATEGORIES = ['Identity', 'Finance', 'Medical', 'Work', 'General'];

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function DocumentLocker() {
    const masterKey = useAuthStore(s => s.masterKey);
    const addToast = useToastStore(s => s.addToast);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Action states
    const [downloadingId, setDownloadingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const rawItems = await fetchVaultItems();
            const decryptedFiles = rawItems
                .filter(item => !item.isDeleted && item.itemType === 'FILE')
                .map(item => {
                    const decryptedPayload = decryptData(item.encryptedBlob, masterKey);
                    if (!decryptedPayload) return null;
                    return {
                        _id: item._id,
                        category: item.category || 'General',
                        createdAt: item.createdAt,
                        ...decryptedPayload
                    };
                })
                .filter(Boolean);
            
            setItems(decryptedFiles);
        } catch (error) {
            console.error(error);
            addToast('Failed to load secure documents', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFileProcess = async (file) => {
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            addToast('File too large. Max allowed size is 15MB.', 'error');
            return;
        }

        try {
            setUploading(true);
            
            // Step 1: Encrypt file in browser memory
            addToast('Encrypting document...', 'info');
            const arrayBuffer = await file.arrayBuffer();
            const encryptedBase64 = encryptFile(arrayBuffer, masterKey);
            if (!encryptedBase64) {
                throw new Error("Local encryption failed");
            }
            
            // Secure Blob has arbitrary type since it's just ciphertext
            const secureBlob = new Blob([encryptedBase64], { type: 'text/plain' });

            // Step 2: Upload to backend
            addToast('Securing in vault...', 'info');
            const uploadRes = await uploadSecureFile(secureBlob);
            const secureFileId = uploadRes.secureFileId;

            // Step 3: Create VaultItem metadata
            // Auto-detect a rough category if possible, or default to general
            let guessCategory = 'General';
            if (file.name.toLowerCase().match(/(passport|aadhaar|id|driver|license|pan)/)) guessCategory = 'Identity';
            else if (file.name.toLowerCase().match(/(bank|statement|invoice|receipt|tax|w2)/)) guessCategory = 'Finance';
            else if (file.name.toLowerCase().match(/(medical|report|doctor|health|prescription)/)) guessCategory = 'Medical';
            else if (file.name.toLowerCase().match(/(offer|work|resume|cv)/)) guessCategory = 'Work';

            const payloadToEncrypt = {
                secureFileId,
                filename: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                note: ''
            };

            await createVaultItem(
                encryptData(payloadToEncrypt, masterKey), // encryptedBlob
                guessCategory,                            // category
                false,                                    // isFavorite
                'FILE',                                   // itemType
                []                                        // tags
            );

            addToast('Document secured successfully!', 'success');
            loadFiles();
            
        } catch (error) {
            console.error('File Upload Error:', error);
            addToast(error.message || 'Failed to upload document', 'error');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = null;
        }
    };

    const handleDownload = async (fileItem, viewOnly = false) => {
        try {
            setDownloadingId(fileItem._id);
            // 1. Download ciphertext
            const encryptedBase64 = await downloadSecureFile(fileItem.secureFileId);
            
            // 2. Decrypt to ArrayBuffer
            const decryptedBuffer = decryptFile(encryptedBase64, masterKey);
            if (!decryptedBuffer) throw new Error("Local decryption failed. Invalid key?");
            
            // 3. Reconstruct original file blob
            const fileBlob = new Blob([decryptedBuffer], { type: fileItem.mimeType });
            const localUrl = URL.createObjectURL(fileBlob);

            if (viewOnly) {
                window.open(localUrl, '_blank');
            } else {
                const a = document.createElement('a');
                a.href = localUrl;
                a.download = fileItem.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            
            // Clean up memory
            setTimeout(() => URL.revokeObjectURL(localUrl), 15000);
            
        } catch (error) {
            console.error(error);
            addToast('Failed to download or decrypt file', 'error');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDelete = async (fileItem) => {
        if (!window.confirm('Erase this secure document forever?')) return;
        
        try {
            setDeletingId(fileItem._id);
            // Delete physical file
            await deleteSecureFile(fileItem.secureFileId);
            // Delete metadata from Vault
            await deleteVaultItem(fileItem._id);
            
            addToast('Document erased', 'success');
            setItems(prev => prev.filter(i => i._id !== fileItem._id));
        } catch (error) {
            console.error(error);
            addToast('Failed to erase document', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // Filter Logic
    const filteredItems = items.filter(item => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch = item.filename?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto pb-40">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black mb-2 flex items-center gap-2 sm:gap-3">
                        <HardDrive className="text-primary shrink-0" size={24} />
                        Document Locker
                    </h1>
                    <p className="text-muted-foreground">Secure your sensitive files with zero-knowledge encryption.</p>
                </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div 
                className={`w-full relative rounded-2xl border-2 border-dashed transition-all p-6 sm:p-12 flex flex-col items-center justify-center text-center overflow-hidden mb-6 sm:mb-8
                    ${dragActive ? 'border-primary bg-primary/10' : 'border-border bg-black/5 dark:bg-white/5'}
                    ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-primary/50'}
                `}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); if(e.dataTransfer.files && e.dataTransfer.files[0]) handleFileProcess(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => { if(e.target.files && e.target.files[0]) handleFileProcess(e.target.files[0]); }} 
                />
                
                {uploading ? (
                    <div className="flex flex-col items-center text-primary">
                        <Loader2 size={48} className="animate-spin mb-4" />
                        <p className="text-lg font-bold">Encrypting & Uploading...</p>
                        <p className="text-sm opacity-80 mt-1">Please keep this tab open.</p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-4">
                            <UploadCloud size={32} />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Drag & Drop to Secure</h3>
                        <p className="text-muted-foreground mb-4">or click to browse from your device</p>
                        
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                            <Lock size={12} />
                            Files are AES-256 encrypted before leaving your browser
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 font-mono">Max size: 15MB</p>
                    </>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search secure documents..."
                        className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                    {['All', ...CATEGORIES].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all ${
                                selectedCategory === cat
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-background border border-border/50 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* File List */}
            {loading ? (
                <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
                    <Loader2 size={32} className="animate-spin mb-4 text-primary" />
                    Loading your digital vault...
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 px-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/50 border-dashed">
                    <FileText size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-bold mb-2">No documents found</h3>
                    <p className="text-muted-foreground">Upload your first secure document to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {filteredItems.map(item => (
                            <motion.div
                                key={item._id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                className="group relative bg-background border border-border/50 rounded-2xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-opacity group-hover:opacity-10 text-primary">
                                    <ShieldCheck size={100} />
                                </div>
                                
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold px-2 py-1 bg-black/5 dark:bg-white/10 rounded-md">
                                            {item.category}
                                        </span>
                                    </div>
                                </div>

                                <div className="relative z-10 mb-6 flex-1">
                                    <h4 className="font-bold text-lg mb-1 truncate" title={item.filename}>
                                        {item.filename}
                                    </h4>
                                    <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                                        {formatBytes(item.size)} • {new Date(item.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="grid grid-cols-3 gap-2 relative z-10 border-t border-border/50 pt-4 mt-auto">
                                    <button 
                                        onClick={() => handleDownload(item, true)}
                                        disabled={downloadingId === item._id || deletingId === item._id}
                                        className="flex flex-col items-center justify-center py-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium text-xs gap-1 disabled:opacity-50"
                                    >
                                        {(downloadingId === item._id) ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                                        View
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(item, false)}
                                        disabled={downloadingId === item._id || deletingId === item._id}
                                        className="flex flex-col items-center justify-center py-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium text-xs gap-1 disabled:opacity-50"
                                    >
                                        <Download size={16} />
                                        Save
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item)}
                                        disabled={downloadingId === item._id || deletingId === item._id}
                                        className="flex flex-col items-center justify-center py-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors font-medium text-xs gap-1 disabled:opacity-50"
                                    >
                                        {(deletingId === item._id) ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        Erase
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
