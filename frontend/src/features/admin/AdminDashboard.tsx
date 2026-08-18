import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Users,
  UserCheck,
  BrainCircuit,
  Activity,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Check,
  Ban,
  Stethoscope,
  FileText,
  Loader2,
} from 'lucide-react';
import { adminApi, type DoctorProfile } from '../../api/admin';
import type { User } from '../../types/auth';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';
import './AdminDashboard.css';

/* ────────────────────────────────────────────────────
   Admin Platform Hub — Metrics, Doctors & User Management
   ──────────────────────────────────────────────────── */

type AdminTab = 'doctors' | 'users';

const USERS_PER_PAGE = 8;
const DOCTORS_PER_PAGE = 5;

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('doctors');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [userSearch, setUserSearch] = useState<string>('');
  const [usersPage, setUsersPage] = useState<number>(1);
  const [doctorsPage, setDoctorsPage] = useState<number>(1);
  const [statusUserToChange, setStatusUserToChange] = useState<{ id: number; name: string; isActive: boolean } | null>(null);
  const [doctorToReject, setDoctorToReject] = useState<{ id: number; name: string } | null>(null);
  const [previewingDoctorId, setPreviewingDoctorId] = useState<number | null>(null);

  const previewDoctorCertificate = async (userId: number) => {
    setPreviewingDoctorId(userId);
    try {
      const blob = await adminApi.viewDoctorCertificate(userId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // The queue still remains usable when a legacy doctor has no stored file.
    } finally {
      setPreviewingDoctorId(null);
    }
  };

  // Platform Metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: adminApi.getMetrics,
  });

  // Pending Doctors
  const { data: pendingDoctors, isLoading: doctorsLoading } = useQuery({
    queryKey: ['admin', 'pending-doctors'],
    queryFn: () => adminApi.getPendingDoctors(),
  });

  // Users List
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users', userRoleFilter],
    queryFn: () => adminApi.listUsers({ role: userRoleFilter || undefined, limit: 50 }),
  });

  // Mutations
  const verifyDoctorMutation = useMutation({
    mutationFn: ({ userId, isVerified }: { userId: number; isVerified: boolean }) =>
      adminApi.verifyDoctor(userId, isVerified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      adminApi.updateUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const users = usersData?.items || [];
  const filteredUsers = users.filter((u: User) =>
    userSearch
      ? u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
      : true
  );

  const doctorsList = (pendingDoctors as any)?.items || (Array.isArray(pendingDoctors) ? pendingDoctors : []);

  const paginatedDoctors = doctorsList.slice(
    (doctorsPage - 1) * DOCTORS_PER_PAGE,
    doctorsPage * DOCTORS_PER_PAGE
  );

  const paginatedUsers = filteredUsers.slice(
    (usersPage - 1) * USERS_PER_PAGE,
    usersPage * USERS_PER_PAGE
  );

  return (
    <div className="admin-page">
      {/* ── Header ── */}
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-primary-50)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1>Platform Administration</h1>
            <p>System metrics, physician PMDC verification, and user management.</p>
          </div>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="admin-tab-switcher glass-panel">
          <button
            className={`admin-tab-btn ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            <Stethoscope size={15} />
            <span>Pending Doctors ({doctorsList.length})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={15} />
            <span>User Accounts</span>
          </button>
        </div>
      </div>

      {/* ── High-Level Metric Bento Cards ── */}
      <div className="admin-metrics-grid">
        <div className="glass-card metric-card">
          <div className="metric-icon-wrap" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}>
            <Users size={22} />
          </div>
          <div>
            <div className="metric-label">Total Users</div>
            <div className="metric-value">
              {metricsLoading ? '...' : metrics?.total_users || 0}
            </div>
            <div className="metric-sub">
              {metrics?.total_patients || 0} Patients · {metrics?.total_doctors || 0} Doctors
            </div>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon-wrap" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div className="metric-label">Pending Verifications</div>
            <div className="metric-value" style={{ color: (metrics?.pending_doctors || 0) > 0 ? '#d97706' : 'inherit' }}>
              {metricsLoading ? '...' : metrics?.pending_doctors || 0}
            </div>
            <div className="metric-sub">Awaiting PMDC Review</div>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon-wrap" style={{ background: 'var(--color-secondary-50)', color: 'var(--color-secondary)' }}>
            <BrainCircuit size={22} />
          </div>
          <div>
            <div className="metric-label">EEGs Analyzed</div>
            <div className="metric-value">
              {metricsLoading ? '...' : metrics?.total_eegs_processed || 0}
            </div>
            <div className="metric-sub">AI ML Inferences</div>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon-wrap" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
            <Activity size={22} />
          </div>
          <div>
            <div className="metric-label">Seizures Logged</div>
            <div className="metric-value">
              {metricsLoading ? '...' : metrics?.total_seizures_logged || 0}
            </div>
            <div className="metric-sub">Clinical History Events</div>
          </div>
        </div>
      </div>

      {/* ── Pending Doctors Verification Tab ── */}
      {activeTab === 'doctors' && (
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 'var(--space-6)', padding: 'var(--space-6)' }}
        >
          <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Stethoscope size={18} style={{ color: 'var(--color-primary)' }} />
              <h3>Doctor PMDC Verification Queue</h3>
            </div>
            <span className="glass-badge">{doctorsList.length} Pending</span>
          </div>

          {doctorsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-lg)' }} />)}
            </div>
          ) : doctorsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
              <CheckCircle2 size={40} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-2)', opacity: 0.8 }} />
              <h4 style={{ margin: '0 0 var(--space-1)' }}>Verification Queue Clear</h4>
              <p style={{ fontSize: 'var(--text-xs)', margin: 0 }}>All registered physicians are verified.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {paginatedDoctors.map((doc: DoctorProfile) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-4)',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-primary-50)',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Stethoscope size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                          Doctor #{doc.user_id} · PMDC: <strong>{doc.pmdc_number}</strong>
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          Specialty: {doc.specialty} {doc.hospital_affiliation && `· ${doc.hospital_affiliation}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {doc.pmdc_certificate_path && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => previewDoctorCertificate(doc.user_id)}
                          disabled={previewingDoctorId === doc.user_id}
                        >
                          {previewingDoctorId === doc.user_id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                          <span>Review Certificate</span>
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setDoctorToReject({ id: doc.user_id, name: `PMDC ${doc.pmdc_number} (${doc.specialty})` })}
                        disabled={verifyDoctorMutation.isPending}
                        style={{ color: 'var(--color-error)' }}
                      >
                        <XCircle size={14} />
                        <span>Reject</span>
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => verifyDoctorMutation.mutate({ userId: doc.user_id, isVerified: true })}
                        disabled={verifyDoctorMutation.isPending}
                      >
                        <CheckCircle2 size={14} />
                        <span>Approve PMDC</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                currentPage={doctorsPage}
                totalPages={Math.ceil(doctorsList.length / DOCTORS_PER_PAGE)}
                totalItems={doctorsList.length}
                pageSize={DOCTORS_PER_PAGE}
                itemName="physicians"
                onPageChange={setDoctorsPage}
              />
            </>
          )}
        </motion.div>
      )}

      {/* ── User Accounts Management Tab ── */}
      {activeTab === 'users' && (
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 'var(--space-6)', padding: 'var(--space-6)' }}
        >
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: '220px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0 var(--space-3)' }}>
              <Search size={16} style={{ color: 'var(--color-text-placeholder)' }} />
              <input
                type="text"
                placeholder="Search user by name or email..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUsersPage(1);
                }}
                style={{ border: 'none', background: 'none', padding: 'var(--space-2) 0', outline: 'none', fontSize: 'var(--text-sm)', width: '100%', color: 'var(--color-text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Filter size={16} style={{ color: 'var(--color-text-muted)' }} />
              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUsersPage(1);
                }}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-main)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Roles</option>
                <option value="PATIENT">Patients</option>
                <option value="DOCTOR">Doctors</option>
                <option value="CARETAKER">Caretakers</option>
                <option value="ADMIN">Admins</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          {usersLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: 'var(--space-2)' }}>User ID</th>
                    <th style={{ padding: 'var(--space-2)' }}>Name & Email</th>
                    <th style={{ padding: 'var(--space-2)' }}>Role</th>
                    <th style={{ padding: 'var(--space-2)' }}>Status</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u: User) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-2)', fontWeight: 600 }}>#{u.id}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{u.full_name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                        <span className="glass-badge" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                          {u.role.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                        <span
                          className="glass-badge"
                          style={{
                            fontSize: '11px',
                            color: u.is_active ? 'var(--color-success)' : 'var(--color-error)',
                          }}
                        >
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)', textAlign: 'right' }}>
                        {u.role !== 'ADMIN' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setStatusUserToChange({ id: u.id, name: u.full_name || u.email, isActive: !u.is_active })}
                            disabled={toggleUserStatusMutation.isPending}
                            style={{
                              color: u.is_active ? 'var(--color-error)' : 'var(--color-success)',
                              padding: '4px 8px',
                              fontSize: '12px',
                            }}
                          >
                            {u.is_active ? (
                              <>
                                <Ban size={13} /> Suspend
                              </>
                            ) : (
                              <>
                                <Check size={13} /> Activate
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                currentPage={usersPage}
                totalPages={Math.ceil(filteredUsers.length / USERS_PER_PAGE)}
                totalItems={filteredUsers.length}
                pageSize={USERS_PER_PAGE}
                itemName="users"
                onPageChange={setUsersPage}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* ── Reject Doctor Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={doctorToReject !== null}
        title="Reject Doctor PMDC Verification?"
        description={`Are you sure you want to decline verification for ${doctorToReject?.name}? The practitioner will remain in restricted read-only mode.`}
        confirmText="Yes, Reject"
        cancelText="Cancel"
        variant="danger"
        isLoading={verifyDoctorMutation.isPending}
        onConfirm={() => {
          if (doctorToReject) {
            verifyDoctorMutation.mutate({ userId: doctorToReject.id, isVerified: false });
            setDoctorToReject(null);
          }
        }}
        onClose={() => setDoctorToReject(null)}
      />

      {/* ── User Status Change Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={statusUserToChange !== null}
        title={statusUserToChange?.isActive ? 'Activate User Account?' : 'Suspend User Account?'}
        description={
          statusUserToChange?.isActive
            ? `Are you sure you want to restore full platform access for ${statusUserToChange?.name}?`
            : `Are you sure you want to suspend ${statusUserToChange?.name}? They will be blocked from authenticating until reactivated.`
        }
        confirmText={statusUserToChange?.isActive ? 'Yes, Activate' : 'Yes, Suspend Account'}
        cancelText="Cancel"
        variant={statusUserToChange?.isActive ? 'info' : 'danger'}
        isLoading={toggleUserStatusMutation.isPending}
        onConfirm={() => {
          if (statusUserToChange) {
            toggleUserStatusMutation.mutate({ userId: statusUserToChange.id, isActive: statusUserToChange.isActive });
            setStatusUserToChange(null);
          }
        }}
        onClose={() => setStatusUserToChange(null)}
      />
    </div>
  );
}
