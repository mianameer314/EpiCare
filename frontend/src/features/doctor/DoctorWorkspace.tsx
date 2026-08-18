import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  Users,
  BrainCircuit,
  Pill,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Clock,
  Loader2,
  ChevronRight,
  ShieldAlert,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { connectionsApi, type ConnectedPatient } from '../../api/connections';
import { usersApi } from '../../api/users';
import { dashboardApi } from '../../api/dashboard';
import { medicationsApi, type MedicationCreate } from '../../api/medications';
import { eegApi, type EegSession } from '../../api/eeg';
import { EEGAnalysisDetail } from '../eeg/components/EEGAnalysisDetail';
import { EEGUploadZone } from '../eeg/components/EEGUploadZone';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { useAuth } from '../../hooks/useAuth';
import { NotificationPermissionBanner } from '../../components/shared/NotificationPermissionBanner';
import './DoctorWorkspace.css';

/* ────────────────────────────────────────────────────
   Doctor Clinical Workspace — Patient Management & Prescriptions
   ──────────────────────────────────────────────────── */

const PATIENTS_PER_PAGE = 6;

export function DoctorWorkspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [cohortPage, setCohortPage] = useState<number>(1);
  const [prescribeModalOpen, setPrescribeModalOpen] = useState(false);
  const [uploadEEGModalOpen, setUploadEEGModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [prescribeError, setPrescribeError] = useState('');

  const [prescribeForm, setPrescribeForm] = useState<MedicationCreate>({
    name: '',
    dosage: '500mg',
    frequency: 'Twice daily (BID)',
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
    is_active: true,
  });

  // Doctor Verification Profile
  const { data: doctorProfile } = useQuery({
    queryKey: ['doctor', 'my-profile'],
    queryFn: usersApi.getDoctorProfile,
  });

  const isVerified = doctorProfile?.is_pmdc_verified ?? true;

  // Queries
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['doctor', 'pending-requests'],
    queryFn: connectionsApi.getDoctorPendingRequests,
  });

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['doctor', 'patients'],
    queryFn: connectionsApi.getDoctorPatients,
  });

  // Auto-select first patient if none selected
  const activePatient = patients.find((p: ConnectedPatient) => p.patient?.id === selectedPatientId) || patients[0];
  const targetPatientUserId = activePatient?.patient?.id;

  // Selected Patient Clinical Data
  const { data: patientStats, isLoading: statsLoading } = useQuery({
    queryKey: ['doctor', 'patient-stats', targetPatientUserId],
    queryFn: () => dashboardApi.getStats({ patient_user_id: targetPatientUserId }),
    enabled: !!targetPatientUserId,
  });

  const { data: patientEEGs, isLoading: eegsLoading } = useQuery({
    queryKey: ['doctor', 'patient-eegs', targetPatientUserId],
    queryFn: () => eegApi.listSessions({ limit: 10, patient_user_id: targetPatientUserId }),
    enabled: !!targetPatientUserId,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (connectionId: number) => connectionsApi.approveDoctorRequest(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (connectionId: number) => connectionsApi.disconnectDoctor(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
    },
  });

  const prescribeMutation = useMutation({
    mutationFn: (data: MedicationCreate) =>
      medicationsApi.createMedication(data, { patient_user_id: targetPatientUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
      setPrescribeModalOpen(false);
      setPrescribeForm({
        name: '',
        dosage: '500mg',
        frequency: 'Twice daily (BID)',
        start_date: new Date().toISOString().split('T')[0],
        notes: '',
        is_active: true,
      });
    },
    onError: (err: any) => setPrescribeError(err.message || 'Failed to register prescription.'),
  });

  const handlePrescribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPrescribeError('');
    if (!prescribeForm.name.trim()) {
      setPrescribeError('Medication name is required.');
      return;
    }
    prescribeMutation.mutate(prescribeForm);
  };

  return (
    <div className="doctor-workspace">
      {/* ── Push Notification Permission Prompt ── */}
      <NotificationPermissionBanner />

      {/* ── Header ── */}
      <div className="doctor-header">
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
            <Stethoscope size={24} />
          </div>
          <div>
            <h1>Neurology Clinical Console</h1>
            <p>Welcome, Dr. {user?.full_name || 'Specialist'}. Monitor your patient cohort and prescribe AED treatments.</p>
          </div>
        </div>

        <div
          className="glass-badge"
          style={{
            color: isVerified ? 'var(--color-success)' : '#d97706',
            fontSize: 'var(--text-xs)',
          }}
        >
          {isVerified ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span>{isVerified ? 'PMDC Verified Practitioner' : 'PMDC Review Pending'}</span>
        </div>
      </div>

      {/* ── Unverified Doctor Permission Warning Banner ── */}
      {!isVerified && (
        <div
          className="glass-card"
          style={{
            padding: 'var(--space-4) var(--space-5)',
            marginBottom: 'var(--space-6)',
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-glow)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <Lock size={20} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 'var(--text-sm)', color: 'var(--color-text-main)' }}>
              Clinical Write Actions Temporarily Locked
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Your PMDC license registration is currently awaiting verification by a platform administrator. Once verified, medication prescribing and diagnostic EEG uploads will unlock automatically.
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Requests Queue (if any) ── */}
      {pendingRequests.length > 0 && (
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)', border: '1px solid var(--color-warning-glow)', background: 'var(--color-warning-bg)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 'bold', color: 'var(--color-text-main)', fontSize: 'var(--text-sm)' }}>
              <Clock size={16} style={{ color: 'var(--color-warning)' }} />
              <span>Pending Patient Connection Requests ({pendingRequests.length})</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {pendingRequests.map((req: ConnectedPatient) => (
              <div
                key={req.connection_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{req.patient?.full_name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{req.patient?.email}</div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => rejectMutation.mutate(req.connection_id)}
                    disabled={rejectMutation.isPending}
                    style={{ color: 'var(--color-error)' }}
                  >
                    <XCircle size={14} /> Decline
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => approveMutation.mutate(req.connection_id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 size={14} /> Accept Patient
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Main Layout: Cohort Sidebar + Active Patient Hub ── */}
      <div className="doctor-grid">
        {/* Left: Connected Patients Cohort */}
        <div className="glass-card" style={{ padding: 'var(--space-5)', height: 'fit-content' }}>
          <div className="bento-header" style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Users size={18} style={{ color: 'var(--color-primary)' }} />
              <h3>My Patient Cohort</h3>
            </div>
            <span className="glass-badge">{patients.length} Total</span>
          </div>

          {patientsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
            </div>
          ) : patients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              No connected patients. Patients will appear here once they send you a connection request.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {patients
                .slice((cohortPage - 1) * PATIENTS_PER_PAGE, cohortPage * PATIENTS_PER_PAGE)
                .map((p: ConnectedPatient) => {
                  const isSelected = p.patient?.id === activePatient?.patient?.id;
                  return (
                    <div
                      key={p.connection_id}
                      onClick={() => setSelectedPatientId(p.patient?.id)}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        background: isSelected ? 'var(--color-primary-50)' : 'var(--color-surface)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border-subtle)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-text-main)' }}>
                          {p.patient?.full_name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {p.patient?.email}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-placeholder)' }} />
                    </div>
                  );
                })}

              <Pagination
                currentPage={cohortPage}
                totalPages={Math.ceil(patients.length / PATIENTS_PER_PAGE)}
                totalItems={patients.length}
                pageSize={PATIENTS_PER_PAGE}
                itemName="patients"
                onPageChange={setCohortPage}
              />
            </div>
          )}
        </div>

        {/* Right: Active Patient Clinical Hub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {activePatient ? (
            <>
              {/* Patient Banner & Actions */}
              <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div>
                    <span className="glass-badge" style={{ color: 'var(--color-primary)', fontSize: '11px', marginBottom: '4px' }}>
                      Active Clinical Focus
                    </span>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', margin: '4px 0 2px' }}>
                      {activePatient.patient?.full_name}
                    </h2>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Patient Email: {activePatient.patient?.email} {activePatient.gender && `· Gender: ${activePatient.gender}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setUploadEEGModalOpen(true)}
                      disabled={!isVerified}
                      title={!isVerified ? 'Disabled: PMDC verification required' : 'Upload EEG recording'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        opacity: !isVerified ? 0.6 : 1,
                        cursor: !isVerified ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {!isVerified ? <Lock size={13} /> : <BrainCircuit size={14} />}
                      <span>Upload EEG for Patient</span>
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setPrescribeModalOpen(true)}
                      disabled={!isVerified}
                      title={!isVerified ? 'Disabled: PMDC verification required' : 'Prescribe medication'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        opacity: !isVerified ? 0.6 : 1,
                        cursor: !isVerified ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {!isVerified ? <Lock size={13} /> : <PlusCircle size={14} />}
                      <span>Prescribe AED Medication</span>
                    </button>
                  </div>
                </div>

                {/* Patient 30-Day Clinical Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Seizures (Past 30d)</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-error)' }}>
                      {statsLoading ? '...' : patientStats?.total_seizures_past_30_days ?? 0}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Days Seizure-Free</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>
                      {statsLoading ? '...' : patientStats?.days_since_last_seizure ?? '30+'}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Medication Adherence</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {statsLoading ? '...' : `${patientStats?.medication_adherence_percent ?? 0}%`}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Avg Sleep Duration</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-secondary)' }}>
                      {statsLoading ? '...' : `${patientStats?.avg_sleep_hours ?? 0} hrs`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient EEG Recordings Hub */}
              <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <BrainCircuit size={18} style={{ color: 'var(--color-primary)' }} />
                    <h3>Diagnostic EEG Recordings & Spectrograms</h3>
                  </div>
                  <span className="glass-badge">{patientEEGs?.items?.length || 0} Sessions</span>
                </div>

                {eegsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
                  </div>
                ) : !patientEEGs || patientEEGs.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                    No EEG sessions on file for this patient. Click "Upload EEG for Patient" to begin diagnostic analysis.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {patientEEGs.items.map((session: EegSession) => (
                      <div
                        key={session.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'var(--color-surface)',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid var(--color-border-subtle)',
                          flexWrap: 'wrap',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{session.original_filename}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            {new Date(session.created_at).toLocaleDateString()} · Status: <strong>{session.status}</strong>
                          </div>
                        </div>

                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setSelectedSessionId(session.id)}
                        >
                          View ML Spectrogram & Probabilities
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Users size={48} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
              <h3>No Connected Patients</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>When patients add your PMDC registration, their medical profile will be managed here.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Prescribe Medication Modal ── */}
      {prescribeModalOpen && (
        <div className="glass-backdrop" onClick={() => setPrescribeModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', zIndex: 1000 }}>
          <motion.div
            className="glass-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ width: '100%', maxWidth: '480px', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Pill size={20} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0 }}>Prescribe for {activePatient?.patient?.full_name}</h3>
              </div>
            </div>

            {prescribeError && (
              <div className="auth-error-banner" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ShieldAlert size={16} />
                <span>{prescribeError}</span>
              </div>
            )}

            <form onSubmit={handlePrescribeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input
                id="doc_med_name"
                label="Antiepileptic Drug (AED) Name"
                placeholder="e.g. Levetiracetam, Lamotrigine, Sodium Valproate"
                required
                value={prescribeForm.name}
                onChange={(e) => setPrescribeForm(p => ({ ...p, name: e.target.value }))}
              />

              <Input
                id="doc_med_dosage"
                label="Dosage Amount"
                placeholder="e.g. 500mg twice daily"
                required
                value={prescribeForm.dosage}
                onChange={(e) => setPrescribeForm(p => ({ ...p, dosage: e.target.value }))}
              />

              <Select
                id="doc_med_freq"
                label="Frequency"
                value={prescribeForm.frequency}
                onChange={(val) => setPrescribeForm(p => ({ ...p, frequency: val }))}
                options={[
                  { value: 'Once daily (QD)', label: 'Once daily (QD)' },
                  { value: 'Twice daily (BID)', label: 'Twice daily (BID)' },
                  { value: 'Three times daily (TID)', label: 'Three times daily (TID)' },
                  { value: 'As needed (PRN)', label: 'As needed (PRN)' },
                ]}
              />

              <Input
                id="doc_med_notes"
                label="Doctor Clinical Instructions"
                placeholder="e.g. Take with water, report side effects immediately"
                value={prescribeForm.notes || ''}
                onChange={(e) => setPrescribeForm(p => ({ ...p, notes: e.target.value }))}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline btn-md" onClick={() => setPrescribeModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-md" disabled={prescribeMutation.isPending}>
                  {prescribeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Prescription'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Diagnostic EEG Upload Modal ── */}
      {uploadEEGModalOpen && (
        <div className="glass-backdrop" onClick={() => setUploadEEGModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', zIndex: 1000 }}>
          <motion.div
            className="glass-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ width: '100%', maxWidth: '640px', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}
          >
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <h3>Upload Diagnostic EEG for {activePatient?.patient?.full_name}</h3>
            </div>
            <EEGUploadZone
              patientUserId={targetPatientUserId}
              onUploadSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['doctor', 'patient-eegs'] });
                setUploadEEGModalOpen(false);
              }}
            />
          </motion.div>
        </div>
      )}

      {/* ── EEG Analysis Detail Modal ── */}
      {selectedSessionId !== null && (
        <EEGAnalysisDetail
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}
