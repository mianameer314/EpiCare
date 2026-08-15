import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

/* ────────────────────────────────────────────────────
   UnsavedChangesProvider
   Global project-wide interceptor for unsaved changes:
   - Blocks in-app React Router navigations (sidebar, topbar, links)
   - Blocks browser back / forward buttons (popstate)
   - Blocks tab closing / window refresh (beforeunload)
   ──────────────────────────────────────────────────── */

interface UnsavedChangesContextType {
  isDirty: boolean;
  setDirty: (dirty: boolean, message?: string) => void;
  confirmNavigation: (onProceed: () => void, message?: string) => void;
  safeNavigate: (to: string | number) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [customMessage, setCustomMessage] = useState<string | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const navigate = useNavigate();

  const setDirty = useCallback((dirty: boolean, message?: string) => {
    setIsDirty(dirty);
    setCustomMessage(message);
  }, []);

  // Safe navigation function (can take path string like '/dashboard' or delta number like -1)
  const safeNavigate = useCallback(
    (to: string | number) => {
      if (!isDirty) {
        if (typeof to === 'number') {
          navigate(to);
        } else {
          navigate(to);
        }
        return;
      }

      pendingActionRef.current = () => {
        setIsDirty(false);
        if (typeof to === 'number') {
          navigate(to);
        } else {
          navigate(to);
        }
      };
      setDialogOpen(true);
    },
    [isDirty, navigate]
  );

  // Wrap arbitrary actions (like modal opens, logouts, etc.)
  const confirmNavigation = useCallback(
    (onProceed: () => void, message?: string) => {
      if (!isDirty) {
        onProceed();
        return;
      }
      if (message) {
        setCustomMessage(message);
      }
      pendingActionRef.current = () => {
        setIsDirty(false);
        onProceed();
      };
      setDialogOpen(true);
    },
    [isDirty]
  );

  // 1. Intercept browser window / tab closing / page refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // 2. Intercept browser Back / Forward buttons (popstate)
  useEffect(() => {
    if (!isDirty) return;

    // Push dummy history entry so back button can be intercepted
    window.history.pushState({ unsavedGuard: true }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Re-push current state to stay on page until confirmed
      window.history.pushState({ unsavedGuard: true }, '', window.location.href);

      pendingActionRef.current = () => {
        setIsDirty(false);
        window.history.back();
      };
      setDialogOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty]);

  // Handle confirming discard
  const handleConfirmDiscard = () => {
    setDialogOpen(false);
    setIsDirty(false);
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action();
    }
  };

  // Handle canceling (stay on page)
  const handleCancelStay = () => {
    setDialogOpen(false);
    pendingActionRef.current = null;
  };

  return (
    <UnsavedChangesContext.Provider
      value={{
        isDirty,
        setDirty,
        confirmNavigation,
        safeNavigate,
      }}
    >
      {children}

      <ConfirmDialog
        isOpen={dialogOpen}
        title="Unsaved Changes Detected"
        description={
          customMessage ||
          "You have unsaved changes on this page. If you leave now without saving, your modifications will be lost. Are you sure you want to discard your changes?"
        }
        confirmText="Discard & Leave"
        cancelText="Stay & Keep Editing"
        variant="warning"
        onConfirm={handleConfirmDiscard}
        onClose={handleCancelStay}
      />
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesContext() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChangesContext must be used within an UnsavedChangesProvider');
  }
  return context;
}

export function useUnsavedChanges(isDirty: boolean, customMessage?: string) {
  const { setDirty } = useUnsavedChangesContext();

  useEffect(() => {
    setDirty(isDirty, customMessage);
    return () => {
      setDirty(false);
    };
  }, [isDirty, customMessage, setDirty]);
}
