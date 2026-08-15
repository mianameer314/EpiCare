import { ShieldAlert, ArrowLeft, Lock, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './PermissionDenied.css';

/* ────────────────────────────────────────────────────
   PermissionDenied — Informative role restriction screen
   Explains why a screen is disabled and how to gain access.
   ──────────────────────────────────────────────────── */

interface PermissionDeniedProps {
  requiredRoles: Array<'PATIENT' | 'DOCTOR' | 'CARETAKER' | 'ADMIN'>;
}

export function PermissionDenied({ requiredRoles }: PermissionDeniedProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const formattedRoles = requiredRoles.map((r) => r.toLowerCase()).join(' or ');
  const userRole = user?.role ? user.role.toLowerCase() : 'guest';

  return (
    <div className="permission-denied-container">
      <div className="glass-card permission-card">
        <div className="permission-icon-wrap">
          <Lock size={32} />
        </div>

        <span className="glass-badge permission-badge">
          <ShieldAlert size={13} /> Access Restricted
        </span>

        <h2>Permission Required</h2>
        <p className="permission-desc">
          This area is restricted to <strong>{formattedRoles}</strong> accounts. You are currently authenticated as a <strong>{userRole}</strong>.
        </p>

        <div className="permission-explanation">
          <div className="explanation-title">
            <UserCheck size={16} />
            <span>Why is this screen disabled?</span>
          </div>
          <p>
            EpiCare enforces strict clinical data governance. Medical prescriptions, physician verification queues, and patient proxy operations are strictly isolated to protect patient safety.
          </p>

          <div className="explanation-title" style={{ marginTop: 'var(--space-3)' }}>
            <Lock size={16} />
            <span>How to access in the future:</span>
          </div>
          <p>
            {requiredRoles.includes('DOCTOR') && (
              <>• <strong>Doctors:</strong> Register with your valid PMDC license. Once approved by the administrator, physician tools will automatically unlock.<br /></>
            )}
            {requiredRoles.includes('CARETAKER') && (
              <>• <strong>Caretakers:</strong> Request an invitation link from your patient in their Care Network tab.<br /></>
            )}
            {requiredRoles.includes('ADMIN') && (
              <>• <strong>Administrators:</strong> Platform governance is reserved for certified health informatics administrators.</>
            )}
          </p>
        </div>

        <div className="permission-actions">
          <button
            className="btn btn-primary btn-md"
            onClick={() => navigate('/dashboard')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <ArrowLeft size={16} />
            <span>Return to Your {user?.role || 'User'} Console</span>
          </button>
        </div>
      </div>
    </div>
  );
}
