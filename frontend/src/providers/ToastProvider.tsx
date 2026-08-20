import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, Trash2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'delete';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    delete: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const toast = {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    info: (msg: string) => addToast(msg, 'info'),
    delete: (msg: string) => addToast(msg, 'delete'),
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          bg: 'var(--color-success-bg)',
          border: '1px solid var(--color-success)',
          color: 'var(--color-success)',
          icon: <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
        };
      case 'error':
        return {
          bg: 'var(--color-error-bg, rgba(196, 35, 42, 0.08))',
          border: '1px solid var(--color-error, #c4232a)',
          color: 'var(--color-error, #c4232a)',
          icon: <AlertCircle size={20} style={{ color: 'var(--color-error, #c4232a)' }} />
        };
      case 'delete':
        return {
          bg: 'var(--color-warning-bg, rgba(154, 103, 0, 0.08))',
          border: '1px solid var(--color-warning, #9a6700)',
          color: 'var(--color-warning, #9a6700)',
          icon: <Trash2 size={20} style={{ color: 'var(--color-warning, #9a6700)' }} />
        };
      case 'info':
      default:
        return {
          bg: 'var(--color-info-bg, rgba(9, 105, 218, 0.08))',
          border: '1px solid var(--color-info, #0969da)',
          color: 'var(--color-info, #0969da)',
          icon: <Info size={20} style={{ color: 'var(--color-info, #0969da)' }} />
        };
    }
  };


  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div 
        style={{
          position: 'fixed',
          top: 'var(--space-4)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-2)',
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence>
                    {toasts.map((t) => {
            const styles = getToastStyles(t.type);
            return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-xl)',
                background: styles.bg,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0,0,0,0.05)',
                border: styles.border,
                minWidth: '300px',
                maxWidth: '90vw'
              }}
            >
              {styles.icon}
              
              <span style={{ 
                flex: 1, 
                fontSize: 'var(--text-sm)', 
                fontWeight: 500,
                color: styles.color
              }}>
                {t.message}
              </span>

              <button 
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
              >
                <X size={16} />
              </button>
            </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
