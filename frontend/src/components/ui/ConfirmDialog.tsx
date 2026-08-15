import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, X, Loader2 } from 'lucide-react';
import './ConfirmDialog.css';

/* ────────────────────────────────────────────────────
   ConfirmDialog — Unified modal confirmation dialog
   Rendered into React Portal at document.body
   ──────────────────────────────────────────────────── */

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  message?: string; // alias for description
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmVariant?: 'danger' | 'warning' | 'info'; // alias for variant
  isLoading?: boolean;
  onConfirm: () => void;
  onClose?: () => void;
  onCancel?: () => void; // alias for onClose
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant,
  confirmVariant,
  isLoading = false,
  onConfirm,
  onClose,
  onCancel,
}: ConfirmDialogProps) {
  const resolvedDesc = description || message || '';
  const resolvedVariant = variant || confirmVariant || 'warning';
  const handleClose = onClose || onCancel || (() => {});

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, handleClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="glass-backdrop confirm-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => !isLoading && handleClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <motion.div
            className="glass-modal confirm-dialog-box"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              zIndex: 100000,
              maxWidth: '440px',
              width: '92%',
              background: '#ffffff',
              borderRadius: 'var(--radius-2xl, 20px)',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(45, 90, 63, 0.15)',
              pointerEvents: 'auto',
            }}
          >
            {/* Header / Icon */}
            <div className="confirm-dialog-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div
                className={`confirm-icon-chip ${resolvedVariant}`}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: resolvedVariant === 'danger' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                  color: resolvedVariant === 'danger' ? '#dc2626' : '#d97706',
                }}
              >
                {resolvedVariant === 'danger' && <AlertCircle size={22} />}
                {resolvedVariant === 'warning' && <AlertTriangle size={22} />}
                {resolvedVariant === 'info' && <Info size={22} />}
              </div>

              {!isLoading && (
                <button
                  type="button"
                  className="confirm-close-btn"
                  onClick={handleClose}
                  aria-label="Close dialog"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="confirm-dialog-body" style={{ marginBottom: '24px' }}>
              <h3
                id="confirm-dialog-title"
                className="confirm-dialog-title"
                style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-text-main)' }}
              >
                {title}
              </h3>
              {resolvedDesc && (
                <p
                  className="confirm-dialog-desc"
                  style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}
                >
                  {resolvedDesc}
                </p>
              )}
            </div>

            {/* Actions */}
            <div
              className="confirm-dialog-actions"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}
            >
              <button
                type="button"
                className="btn btn-outline btn-md confirm-cancel-btn"
                onClick={handleClose}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                {cancelText}
              </button>

              <button
                type="button"
                className={`btn btn-md ${resolvedVariant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={onConfirm}
                disabled={isLoading}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: resolvedVariant === 'danger' ? '#dc2626' : 'var(--color-primary)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>{confirmText}</span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
