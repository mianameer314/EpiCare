import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PermissionDenied } from './PermissionDenied';

/* ────────────────────────────────────────────────────
   ProtectedRoute — redirects to /auth if not logged in.
   Renders PermissionDenied if role requirement is unmet.
   ──────────────────────────────────────────────────── */

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'PATIENT' | 'DOCTOR' | 'CARETAKER' | 'ADMIN'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="route-loading" aria-label="Authenticating" role="status">
        <div className="route-loading-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <PermissionDenied requiredRoles={allowedRoles} />;
  }

  return <>{children}</>;
}
