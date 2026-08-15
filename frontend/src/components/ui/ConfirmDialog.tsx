import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, X, Loader2 } from 'lucide-react';
import './ConfirmDialog.css';

/* ────────────────────────────────────────────────────
   ConfirmDialog — Unified modal confirmation dialog
   Designed for safe medical data actions, deletions,
   and administrative account status modifications.
   ──────────────────────────────────────────────────── */

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="glass-backdrop confirm-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          onClick={() => !isLoading && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <motion.div
            className="glass-modal confirm-dialog-box"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.96, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 6 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header / Icon */}
            <div className="confirm-dialog-header">
              <div className={`confirm-icon-chip ${variant}`}>
                {variant === 'danger' && <AlertCircle size={22} />}
                {variant === 'warning' && <AlertTriangle size={22} />}
                {variant === 'info' && <Info size={22} />}
              </div>

              {!isLoading && (
                <button
                  className="confirm-close-btn"
                  onClick={onClose}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="confirm-dialog-body">
              <h3 id="confirm-dialog-title" className="confirm-dialog-title">
                {title}
              </h3>
              <p className="confirm-dialog-desc">{description}</p>
            </div>

            {/* Actions */}
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn btn-outline btn-md confirm-cancel-btn"
                onClick={onClose}
                disabled={isLoading}
              >
                {cancelText}
              </button>

              <button
                type="button"
                className={`btn btn-md ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={onConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmText}</span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
