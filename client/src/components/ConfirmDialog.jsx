import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Professional in-app Confirm Dialog to replace window.confirm()
 * Usage:
 *   <ConfirmDialog
 *     isOpen={showConfirm}
 *     title="Delete Item?"
 *     message="This action cannot be undone."
 *     confirmLabel="Delete"
 *     confirmVariant="danger"   // 'danger' | 'primary'
 *     onConfirm={() => { doAction(); setShowConfirm(false); }}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */
export default function ConfirmDialog({
    isOpen,
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'danger',
    onConfirm,
    onCancel,
    icon: Icon = AlertTriangle,
}) {
    if (!isOpen) return null;

    const confirmClasses =
        confirmVariant === 'danger'
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 16 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                        className="glass-panel border border-border w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Top accent */}
                        <div className={`h-1 w-full ${confirmVariant === 'danger' ? 'bg-gradient-to-r from-red-500/40 via-red-500 to-red-500/40' : 'bg-gradient-to-r from-primary/40 via-primary to-primary/40'}`} />

                        <div className="p-6">
                            {/* Icon + Title */}
                            <div className="flex items-start gap-4 mb-4">
                                <div className={`p-3 rounded-2xl shrink-0 ${confirmVariant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                                    <Icon size={22} />
                                </div>
                                <div className="flex-1 pt-0.5">
                                    <h3 className="font-bold text-lg leading-tight mb-1">{title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                                </div>
                                <button
                                    onClick={onCancel}
                                    className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground transition-colors shrink-0"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    {cancelLabel}
                                </button>
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={onConfirm}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${confirmClasses}`}
                                >
                                    {confirmLabel}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
