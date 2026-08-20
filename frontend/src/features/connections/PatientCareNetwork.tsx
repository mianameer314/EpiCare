import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  HeartHandshake,
  UserPlus,
  UserX,
  RotateCcw,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  X,
  Mail,
  Clock,
  Building,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import {
  connectionsApi,
  type DoctorSearchItem,
  type PatientDoctorConnection,
  type PatientCaretakerConnection,
} from '../../api/connections';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../providers/ToastProvider';
import './PatientCareNetwork.css';

/* ────────────────────────────────────────────────────
   Patient Care Network — Doctor Search & Caretaker Invites
   ──────────────────────────────────────────────────── */

function formatDoctorName(name?: string): string {
  if (!name) return 'Specialist Physician';
  const trimmed = name.trim();
  return /^dr\.?\s+/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

const NETWORK_PER_PAGE = 5;
const DIRECTORY_PER_PAGE = 6;

export function PatientCareNetwork() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'doctors' | 'caretakers'>('doctors');
  const [searchDoctorQuery, setSearchDoctorQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [docsPage, setDocsPage] = useState(1);
  const [carePage, setCarePage] = useState(1);
  const [caretakerEmail, setCaretakerEmail] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [docToDisconnect, setDocToDisconnect] = useState<{ id: number; name: string; action: 'revoke' | 'cancel' | 'remove' } | null>(null);
  const [careToDisconnect, setCareToDisconnect] = useState<{ id: number; name: string } | null>(null);
  const toast = useToast();
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorSearchItem | null>(null);
  const [selectedDoctorPhotoUrl, setSelectedDoctorPhotoUrl] = useState<string | null>(null);
  const [selectedDoctorPhotoLoading, setSelectedDoctorPhotoLoading] = useState(false);

  // Dynamic filter options aggregated from verified doctors in database
  const { data: filterOptions } = useQuery({
    queryKey: ['connections', 'doctor-filter-options'],
    queryFn: connectionsApi.getDoctorFilterOptions,
  });

  const availableSpecialties = filterOptions?.specialties || [];
  const availableLocations = filterOptions?.locations || [];

  // Queries
  const { data: connectedDoctors = [], isLoading: docsLoading } = useQuery({
    queryKey: ['connections', 'patient-doctors'],
    queryFn: connectionsApi.getPatientDoctors,
  });

  const { data: connectedCaretakers = [], isLoading: careLoading } = useQuery({
    queryKey: ['connections', 'patient-caretakers'],
    queryFn: connectionsApi.getPatientCaretakers,
  });

  const paginatedDoctors = connectedDoctors.slice(
    (docsPage - 1) * NETWORK_PER_PAGE,
    docsPage * NETWORK_PER_PAGE
  );

  const paginatedCaretakers = connectedCaretakers.slice(
    (carePage - 1) * NETWORK_PER_PAGE,
    carePage * NETWORK_PER_PAGE
  );

  // Verified Doctors Discovery Directory Query
  const { data: directoryResult, isLoading: directoryLoading } = useQuery({
    queryKey: [
      'connections',
      'doctor-directory',
      searchDoctorQuery,
      selectedSpecialty,
      selectedLocation,
      directoryPage,
    ],
    queryFn: () =>
      connectionsApi.searchDoctors({
        name: searchDoctorQuery.trim() || undefined,
        specialty: selectedSpecialty !== 'ALL' ? selectedSpecialty : undefined,
        city: selectedLocation.trim() || undefined,
        skip: (directoryPage - 1) * DIRECTORY_PER_PAGE,
        limit: DIRECTORY_PER_PAGE,
      }),
  });

  const verifiedDoctors = directoryResult?.items || [];
  const totalVerifiedDoctors = directoryResult?.total || 0;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setSelectedDoctorPhotoUrl(null);
    if (!selectedDoctor?.profile_photo_url) {
      setSelectedDoctorPhotoLoading(false);
      return;
    }
    setSelectedDoctorPhotoLoading(true);
    connectionsApi.getPublicDoctorPhoto(selectedDoctor.doctor_id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSelectedDoctorPhotoUrl(objectUrl);
      })
      .catch(() => {
        if (active) setSelectedDoctorPhotoUrl(null);
      })
      .finally(() => {
        if (active) setSelectedDoctorPhotoLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedDoctor]);

  useEffect(() => {
    if (!selectedDoctor) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedDoctor]);

  const openDoctorProfile = (doctor: DoctorSearchItem) => {
    setActionError('');
    setSelectedDoctor(doctor);
  };

  const closeDoctorProfile = () => {
    setSelectedDoctor(null);
    setSelectedDoctorPhotoUrl(null);
  };

  const handleResetFilters = () => {
    setSearchDoctorQuery('');
    setSelectedSpecialty('ALL');
    setSelectedLocation('');
    setDirectoryPage(1);
  };

  // Mutations
  const requestDocMutation = useMutation({
    mutationFn: (doctorId: number) => connectionsApi.requestDoctorConnection(doctorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'patient-doctors'] });
      closeDoctorProfile();
      showSuccess('Connection request sent to doctor.');
    },
    onError: (err: any) => showErr(err.message || 'Failed to send connection request.'),
  });

  const disconnectDoctorMutation = useMutation({
    mutationFn: ({ connectionId }: { connectionId: number; action: 'revoke' | 'cancel' | 'remove' }) => connectionsApi.disconnectDoctor(connectionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'patient-doctors'] });
      showSuccess(variables.action === 'remove' ? 'Doctor removed from connection history.' : variables.action === 'cancel' ? 'Pending doctor request cancelled.' : 'Doctor clinical access revoked.');
    },
  });

  const inviteCaretakerMutation = useMutation({
    mutationFn: (email: string) => connectionsApi.inviteCaretaker(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'patient-caretakers'] });
      setInviteModalOpen(false);
      setCaretakerEmail('');
      showSuccess('Caretaker invitation sent successfully.');
    },
    onError: (err: any) => showErr(err.message || 'Failed to invite caretaker.'),
  });

  const proxyToggleMutation = useMutation({
    mutationFn: ({ id, canProxy }: { id: number; canProxy: boolean }) =>
      connectionsApi.updateCaretakerProxy(id, canProxy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'patient-caretakers'] });
      showSuccess('Caretaker proxy permissions updated.');
    },
  });

  const disconnectCaretakerMutation = useMutation({
    mutationFn: (id: number) => connectionsApi.disconnectCaretaker(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'patient-caretakers'] });
      showSuccess('Caretaker disconnected.');
    },
  });

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setActionError('');
    toast.success(msg);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const showErr = (msg: string) => {
    setActionError(msg);
    setActionSuccess('');
    toast.error(msg);
  };

  return (
    <div className="care-network-page">
      {/* ── Header ── */}
      <div className="care-network-header">
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
            <HeartHandshake size={24} />
          </div>
          <div>
            <h1>Care Network & Clinical Connections</h1>
            <p>Connect with verified neurologists and invite trusted caretakers with proxy logging permissions.</p>
          </div>
        </div>

        {/* ── Switcher ── */}
        <div className="care-tab-switcher glass-panel">
          <button
            className={`care-tab-btn ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            <Stethoscope size={15} />
            <span>Doctors ({connectedDoctors.length})</span>
          </button>
          <button
            className={`care-tab-btn ${activeTab === 'caretakers' ? 'active' : ''}`}
            onClick={() => setActiveTab('caretakers')}
          >
            <HeartHandshake size={15} />
            <span>Caretakers ({connectedCaretakers.length})</span>
          </button>
        </div>
      </div>

      {/* ── Live Care Network Telemetry Bento Bar ── */}
      <div className="care-overview-bento">
        <div className="care-metric-card">
          <div className="care-metric-icon emerald">
            <Stethoscope size={22} />
          </div>
          <div className="care-metric-content">
            <h4>
              <span>{connectedDoctors.filter(d => d.relationship_status === 'ACTIVE').length} Active Specialists</span>
              <span className="live-badge" style={{ fontSize: '10px', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '999px', fontWeight: 600 }}>Synced</span>
            </h4>
            <p>PMDC-verified clinical oversight & EEG diagnostic review</p>
          </div>
        </div>

        <div className="care-metric-card">
          <div className="care-metric-icon azure">
            <HeartHandshake size={22} />
          </div>
          <div className="care-metric-content">
            <h4>
              <span>{connectedCaretakers.filter(c => c.relationship_status === 'ACTIVE').length} Authorized Caregivers</span>
              <span className="live-badge" style={{ fontSize: '10px', color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '999px', fontWeight: 600 }}>Relay</span>
            </h4>
            <p>Real-time emergency dispatch & proxy medical logging</p>
          </div>
        </div>

        <div className="care-metric-card">
          <div className="care-metric-icon amber">
            <Activity size={22} />
          </div>
          <div className="care-metric-content">
            <h4>
              <span>EEG Telemetry Stream</span>
              <span className="live-badge" style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '999px', fontWeight: 600 }}>Live</span>
            </h4>
            <p>End-to-end encrypted seizure logs & continuous sync</p>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </motion.div>
      )}

      {actionError && (
        <div className="auth-error-banner" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── Doctors Tab ── */}
      {activeTab === 'doctors' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
        >
          {/* Verified Doctor Discovery Directory with City/Country Filters */}
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div>
                <h3>Find & Connect With Verified Neurologists</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                  Search PMDC-verified specialists by name, specialty, city, or country to grant clinical access to your EEG reports.
                </p>
              </div>
              <span className="glass-badge" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary-200)' }}>
                <ShieldAlert size={12} />
                <span>{totalVerifiedDoctors} Verified Available</span>
              </span>
            </div>

            {/* Filter & Search Bar */}
            <div className="doctor-filter-grid" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: '0 var(--space-3)', height: '38px' }}>
                <Search size={15} style={{ color: 'var(--color-text-placeholder)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search doctor by name, PMDC, or hospital..."
                  value={searchDoctorQuery}
                  onChange={(e) => {
                    setSearchDoctorQuery(e.target.value);
                    setDirectoryPage(1);
                  }}
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: 'var(--text-xs)', width: '100%', color: 'var(--color-text-main)' }}
                />
              </div>

              {/* Dynamic Specialty Filter */}
              <select
                className="filter-select"
                value={selectedSpecialty}
                onChange={(e) => {
                  setSelectedSpecialty(e.target.value);
                  setDirectoryPage(1);
                }}
                aria-label="Filter by Specialty"
              >
                <option value="ALL">🩺 All Specialties</option>
                {availableSpecialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>

              {/* Dynamic Location / City / Country Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: '0 var(--space-3)', height: '38px' }}>
                <Building size={14} style={{ color: 'var(--color-text-placeholder)', flexShrink: 0 }} />
                <input
                  type="text"
                  list="dynamic-doctor-locations"
                  placeholder="City, Hospital, or Country..."
                  value={selectedLocation}
                  onChange={(e) => {
                    setSelectedLocation(e.target.value);
                    setDirectoryPage(1);
                  }}
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: 'var(--text-xs)', width: '100%', color: 'var(--color-text-main)' }}
                />
                <datalist id="dynamic-doctor-locations">
                  {availableLocations.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              {/* Reset Filters Button */}
              {(searchDoctorQuery || selectedSpecialty !== 'ALL' || selectedLocation) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleResetFilters}
                  style={{ fontSize: '11px', padding: '6px 10px', height: '38px', color: 'var(--color-text-muted)' }}
                  title="Reset all filters"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Doctor Directory Results */}
            {directoryLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />
                ))}
              </div>
            ) : verifiedDoctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-lg)' }}>
                <Stethoscope size={36} style={{ margin: '0 auto var(--space-2)', opacity: 0.4 }} />
                <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-main)' }}>No Verified Physicians Found</h4>
                <p style={{ fontSize: 'var(--text-xs)', margin: 'var(--space-1) 0 var(--space-3)' }}>
                  Try adjusting your city, country, or specialty filters.
                </p>
                <button className="btn btn-outline btn-sm" onClick={handleResetFilters}>
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
                {verifiedDoctors.map((doc: DoctorSearchItem) => {
                  const existingConn = connectedDoctors.find((c: PatientDoctorConnection) => c.doctor_id === doc.doctor_id || c.doctor?.id === doc.doctor_id);
                  const isAlreadyActive = existingConn?.relationship_status === 'ACTIVE';
                  const isPending = existingConn?.relationship_status === 'PENDING';

                  return (
                    <div key={doc.doctor_id} className="doctor-directory-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: '220px' }}>
                        <div className="doctor-avatar-circle">
                          <Stethoscope size={20} />
                          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: '#16a34a', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={10} strokeWidth={3} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: 'var(--text-sm)' }}>
                              {formatDoctorName(doc.full_name)}
                            </span>
                            <span className="pmdc-badge-pill" title="PMDC Verified Neurologist">
                              <ShieldCheck size={11} />
                              <span>{doc.pmdc_number}</span>
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                            <span className="specialty-pill">
                              🩺 {doc.specialty}
                            </span>
                            {doc.hospital_affiliation && (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Building size={11} style={{ opacity: 0.7 }} />
                                <span>{doc.hospital_affiliation}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isAlreadyActive ? (
                          <span
                            className="glass-badge"
                            style={{
                              color: '#16a34a',
                              background: '#f0fdf4',
                              borderColor: '#bbf7d0',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>Connected</span>
                          </span>
                        ) : isPending ? (
                          <span
                            className="glass-badge"
                            style={{
                              color: '#d97706',
                              background: '#fffbeb',
                              borderColor: '#fde68a',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                            }}
                          >
                            <Clock size={12} />
                            <span>Request Sent</span>
                          </span>
                        ) : (
                          <button
                            className="btn-connect-doctor"
                            onClick={() => openDoctorProfile(doc)}
                            disabled={requestDocMutation.isPending}
                          >
                            <UserPlus size={13} />
                            <span>View Profile</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalVerifiedDoctors > DIRECTORY_PER_PAGE && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Pagination
                  currentPage={directoryPage}
                  totalPages={Math.ceil(totalVerifiedDoctors / DIRECTORY_PER_PAGE)}
                  totalItems={totalVerifiedDoctors}
                  pageSize={DIRECTORY_PER_PAGE}
                  itemName="verified physicians"
                  onPageChange={setDirectoryPage}
                />
              </div>
            )}
          </div>

          {/* Connected Doctors List */}
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <h3>My Connected Doctors</h3>
              <span className="glass-badge">{connectedDoctors.length} Total</span>
            </div>

            {docsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
              </div>
            ) : connectedDoctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                <Stethoscope size={40} style={{ margin: '0 auto var(--space-2)', opacity: 0.4 }} />
                <h4>No Connected Doctors Yet</h4>
                <p style={{ fontSize: 'var(--text-xs)', margin: 'var(--space-1) 0 0' }}>
                  Use the directory above to send a connection request to your neurologist.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {paginatedDoctors.map((doc: PatientDoctorConnection) => (
                  <div
                    key={doc.connection_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-4)',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
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
                        <div style={{ fontWeight: 'bold', color: 'var(--color-text-main)', fontSize: 'var(--text-sm)' }}>
                          {formatDoctorName(doc.doctor?.full_name)}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {doc.specialty} · PMDC: {doc.pmdc_number} {doc.hospital_affiliation && `· ${doc.hospital_affiliation}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {doc.relationship_status === 'ACTIVE' && (
                        <>
                          <span
                            className="glass-badge"
                            style={{
                              color: '#16a34a',
                              background: '#f0fdf4',
                              borderColor: '#bbf7d0',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>Active Connection</span>
                          </span>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setDocToDisconnect({ id: doc.connection_id, name: formatDoctorName(doc.doctor?.full_name), action: 'revoke' })}
                            style={{ color: '#dc2626', borderColor: '#fecaca', fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Revoke doctor clinical access"
                          >
                            <UserX size={13} />
                            <span>Revoke</span>
                          </button>
                        </>
                      )}

                      {doc.relationship_status === 'PENDING' && (
                        <>
                          <span
                            className="glass-badge"
                            style={{
                              color: '#d97706',
                              background: '#fffbeb',
                              borderColor: '#fde68a',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={12} />
                            <span>Pending Approval</span>
                          </span>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setDocToDisconnect({ id: doc.connection_id, name: formatDoctorName(doc.doctor?.full_name), action: doc.relationship_status === 'REVOKED' ? 'remove' : 'cancel' })}
                            style={{ color: '#64748b', borderColor: '#e2e8f0', fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Cancel pending request"
                          >
                            <X size={13} />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}

                      {doc.relationship_status === 'REVOKED' && (
                        <>
                          <span
                            className="glass-badge"
                            style={{
                              color: '#dc2626',
                              background: '#fef2f2',
                              borderColor: '#fecaca',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 700,
                            }}
                          >
                            <ShieldAlert size={12} />
                            <span>Access Revoked</span>
                          </span>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => requestDocMutation.mutate(doc.doctor_id)}
                            disabled={requestDocMutation.isPending}
                            style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Re-send connection request to this doctor"
                          >
                            <RotateCcw size={13} />
                            <span>Re-Connect</span>
                          </button>
                          <button
                            className="btn-delete-hover"
                            onClick={() => setDocToDisconnect({ id: doc.connection_id, name: formatDoctorName(doc.doctor?.full_name), action: doc.relationship_status === 'REVOKED' ? 'remove' : 'cancel' })}
                            title="Remove from history"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                <Pagination
                  currentPage={docsPage}
                  totalPages={Math.ceil(connectedDoctors.length / NETWORK_PER_PAGE)}
                  totalItems={connectedDoctors.length}
                  pageSize={NETWORK_PER_PAGE}
                  itemName="physicians"
                  onPageChange={setDocsPage}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Caretakers Tab ── */}
      {activeTab === 'caretakers' && (
        <motion.div
          key="caretakers"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <HeartHandshake size={20} style={{ color: 'var(--color-primary)' }} />
                <h3>Designated Caretakers & Family Caregivers</h3>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => setInviteModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <UserPlus size={15} />
                <span>Invite Caretaker</span>
              </button>
            </div>

            {careLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
              </div>
            ) : connectedCaretakers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                <HeartHandshake size={40} style={{ margin: '0 auto var(--space-2)', opacity: 0.4 }} />
                <h4>No Caretakers Linked</h4>
                <p style={{ fontSize: 'var(--text-xs)', margin: 'var(--space-1) 0 0' }}>
                  Invite a trusted family member or caregiver to monitor your health and log events on your behalf.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {paginatedCaretakers.map((care: PatientCaretakerConnection) => (
                  <div
                    key={care.connection_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-4)',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-text-main)', fontSize: 'var(--text-sm)' }}>
                        {care.caretaker?.full_name || 'Caregiver'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span>{care.caretaker?.email}</span>
                        <span>·</span>
                        <span
                          className="glass-badge"
                          style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            color:
                              care.relationship_status === 'ACTIVE'
                                ? '#16a34a'
                                : care.relationship_status === 'REVOKED'
                                ? '#dc2626'
                                : '#d97706',
                            background:
                              care.relationship_status === 'ACTIVE'
                                ? '#f0fdf4'
                                : care.relationship_status === 'REVOKED'
                                ? '#fef2f2'
                                : '#fffbeb',
                            borderColor:
                              care.relationship_status === 'ACTIVE'
                                ? '#bbf7d0'
                                : care.relationship_status === 'REVOKED'
                                ? '#fecaca'
                                : '#fde68a',
                            fontWeight: 600,
                          }}
                        >
                          {care.relationship_status}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <div
                        className="proxy-toggle-wrap"
                        role="switch"
                        aria-checked={care.can_proxy}
                        tabIndex={0}
                        onClick={() =>
                          proxyToggleMutation.mutate({
                            id: care.connection_id,
                            canProxy: !care.can_proxy,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            proxyToggleMutation.mutate({
                              id: care.connection_id,
                              canProxy: !care.can_proxy,
                            });
                          }
                        }}
                        title={
                          care.can_proxy
                            ? 'Proxy Logging Active: Caregiver can log symptoms & medications'
                            : 'Proxy Logging Disabled: Read-Only Caregiver View'
                        }
                      >
                        <div className={`proxy-toggle-switch ${care.can_proxy ? 'active' : ''}`}>
                          <div className="proxy-toggle-thumb" />
                        </div>
                        <span className="proxy-toggle-label">
                          {care.can_proxy ? (
                            <span style={{ color: '#15803d', fontWeight: 600 }}>Proxy Active</span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>Proxy Off</span>
                          )}
                        </span>
                      </div>

                      <button
                        className="btn-delete-hover"
                        onClick={() => setCareToDisconnect({ id: care.connection_id, name: care.caretaker?.full_name || 'Caregiver' })}
                        title="Disconnect caretaker"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                <Pagination
                  currentPage={carePage}
                  totalPages={Math.ceil(connectedCaretakers.length / NETWORK_PER_PAGE)}
                  totalItems={connectedCaretakers.length}
                  pageSize={NETWORK_PER_PAGE}
                  itemName="caregivers"
                  onPageChange={setCarePage}
                />
              </div>
            )}
          </div>

          {/* Invite Modal */}
          <AnimatePresence>
            {inviteModalOpen && (
              <div className="glass-backdrop" onClick={() => setInviteModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', zIndex: 1000 }}>
                <motion.div
                  className="glass-modal"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  style={{ width: '100%', maxWidth: '420px', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Invite Caretaker</h3>
                    <button onClick={() => setInviteModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); inviteCaretakerMutation.mutate(caretakerEmail); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Input
                      id="caretaker_email"
                      type="email"
                      label="Caretaker Account Email"
                      placeholder="e.g. opsigma089@gmail.com"
                      required
                      value={caretakerEmail}
                      onChange={(e) => setCaretakerEmail(e.target.value)}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                      <button type="button" className="btn btn-outline btn-md" onClick={() => setInviteModalOpen(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-md" disabled={inviteCaretakerMutation.isPending}>
                        {inviteCaretakerMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        <span>Send Invitation</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Disconnect Doctor Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={docToDisconnect !== null}
        title={docToDisconnect?.action === 'revoke' ? "Revoke Physician Clinical Access?" : docToDisconnect?.action === 'remove' ? "Remove Revoked Physician From History?" : "Cancel Connection Request?"}
        description={
          docToDisconnect?.action === 'revoke'
            ? `Are you sure you want to revoke clinical access for ${docToDisconnect?.name}? The connection will remain visible as revoked history.`
            : docToDisconnect?.action === 'remove'
            ? `This physician is already revoked. Remove ${docToDisconnect?.name} permanently from your connection history? This cannot be undone.`
            : `Cancel the pending connection request for ${docToDisconnect?.name}?`
        }
        confirmText={docToDisconnect?.action === 'revoke' ? "Yes, Revoke Access" : docToDisconnect?.action === 'remove' ? "Yes, Remove From History" : "Yes, Cancel Request"}
        cancelText="Cancel"
        variant="warning"
        isLoading={disconnectDoctorMutation.isPending}
        onConfirm={() => {
          if (docToDisconnect) {
            disconnectDoctorMutation.mutate({ connectionId: docToDisconnect.id, action: docToDisconnect.action });
            setDocToDisconnect(null);
          }
        }}
        onClose={() => setDocToDisconnect(null)}
      />

      {/* ── Disconnect Caretaker Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={careToDisconnect !== null}
        title="Disconnect Caretaker?"
        description={`Are you sure you want to remove ${careToDisconnect?.name} from your care team? They will lose access to your health logs and proxy logging.`}
        confirmText="Yes, Disconnect"
        cancelText="Cancel"
        variant="warning"
        isLoading={disconnectCaretakerMutation.isPending}
        onConfirm={() => {
          if (careToDisconnect) {
            disconnectCaretakerMutation.mutate(careToDisconnect.id);
            setCareToDisconnect(null);
          }
        }}
        onClose={() => setCareToDisconnect(null)}
      />

      {selectedDoctor && createPortal(
        <AnimatePresence>
          <motion.div
            className="doctor-profile-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDoctorProfile();
            }}
          >
            <motion.div
              className="doctor-profile-modal-panel"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="doctor-profile-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="doctor-profile-modal-close"
                onClick={closeDoctorProfile}
                aria-label="Close doctor profile"
              >
                <X size={20} />
              </button>

              <div className="doctor-profile-modal-hero">
                <div className="doctor-profile-modal-photo-wrap">
                  {selectedDoctorPhotoUrl ? (
                    <img src={selectedDoctorPhotoUrl} alt={formatDoctorName(selectedDoctor.full_name)} className="doctor-profile-modal-photo" />
                  ) : selectedDoctorPhotoLoading ? (
                    <Loader2 size={32} className="animate-spin" />
                  ) : (
                    <span className="doctor-profile-modal-initial">
                      {selectedDoctor.full_name?.trim().charAt(0).toUpperCase() || 'D'}
                    </span>
                  )}
                  <span className="doctor-profile-modal-verified" title="PMDC verified">
                    <CheckCircle2 size={15} />
                  </span>
                </div>
                <div className="doctor-profile-modal-heading">
                  <div className="doctor-profile-modal-name-row">
                    <h2 id="doctor-profile-modal-title">{formatDoctorName(selectedDoctor.full_name)}</h2>
                    <span className="pmdc-badge-pill">
                      <ShieldCheck size={12} />
                      <span>PMDC Verified</span>
                    </span>
                  </div>
                  <p className="doctor-profile-modal-specialty">{selectedDoctor.specialty || 'Specialist Physician'}</p>
                  <p className="doctor-profile-modal-pmdc">PMDC License: {selectedDoctor.pmdc_number}</p>
                </div>
              </div>

              <div className="doctor-profile-modal-body">
                <div className="doctor-profile-modal-facts">
                  <div className="doctor-profile-fact">
                    <span className="doctor-profile-fact-label">Practice affiliation</span>
                    <strong>{selectedDoctor.hospital_affiliation?.trim() || 'Not provided'}</strong>
                  </div>
                  <div className="doctor-profile-fact">
                    <span className="doctor-profile-fact-label">Gender</span>
                    <strong>{selectedDoctor.gender?.trim() || 'Not provided'}</strong>
                  </div>
                  <div className="doctor-profile-fact">
                    <span className="doctor-profile-fact-label">Experience</span>
                    <strong>{selectedDoctor.years_of_experience != null ? `${selectedDoctor.years_of_experience} years` : 'Not provided'}</strong>
                  </div>
                  <div className="doctor-profile-fact">
                    <span className="doctor-profile-fact-label">Consultation fee</span>
                    <strong>{selectedDoctor.consultation_fee != null ? `PKR ${selectedDoctor.consultation_fee.toLocaleString()}` : 'Not provided'}</strong>
                  </div>
                  <div className="doctor-profile-fact">
                    <span className="doctor-profile-fact-label">Languages</span>
                    <strong>{selectedDoctor.languages_spoken?.length ? selectedDoctor.languages_spoken.join(', ') : 'Not provided'}</strong>
                  </div>
                </div>

                <div className="doctor-profile-modal-section">
                  <h3>Availability</h3>
                  <div className="doctor-profile-modal-detail-row">
                    <Clock size={16} />
                    <span>{selectedDoctor.available_day_start && selectedDoctor.available_day_end ? `${selectedDoctor.available_day_start} to ${selectedDoctor.available_day_end}` : 'Availability not provided'}</span>
                    <span className="doctor-profile-detail-separator">·</span>
                    <span>{selectedDoctor.available_time_start && selectedDoctor.available_time_end ? `${selectedDoctor.available_time_start} to ${selectedDoctor.available_time_end}` : 'Time not provided'}</span>
                  </div>
                </div>

                <div className="doctor-profile-modal-section">
                  <h3>Consultation options</h3>
                  <div className="doctor-profile-modal-chips">
                    {selectedDoctor.consultation_types?.length ? selectedDoctor.consultation_types.map((type) => (
                      <span key={type} className="doctor-profile-modal-chip">{type}</span>
                    )) : <span className="doctor-profile-modal-muted">Not provided</span>}
                  </div>
                </div>

                <div className="doctor-profile-modal-section">
                  <h3>About the doctor</h3>
                  <p className="doctor-profile-modal-bio">{selectedDoctor.bio?.trim() || 'This physician has not added a public biography yet.'}</p>
                </div>
              </div>

              <div className="doctor-profile-modal-footer">
                {(() => {
                  const connection = connectedDoctors.find((item) => item.doctor_id === selectedDoctor.doctor_id || item.doctor?.id === selectedDoctor.doctor_id);
                  const isActive = connection?.relationship_status === 'ACTIVE';
                  const isPending = connection?.relationship_status === 'PENDING';
                  return (
                    <button
                      type="button"
                      className={`doctor-profile-modal-action ${isActive ? 'is-connected' : isPending ? 'is-pending' : ''}`}
                      disabled={isActive || isPending || requestDocMutation.isPending}
                      onClick={() => requestDocMutation.mutate(selectedDoctor.doctor_id)}
                    >
                      {requestDocMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : isActive ? <CheckCircle2 size={16} /> : isPending ? <Clock size={16} /> : <UserPlus size={16} />}
                      <span>{isActive ? 'Connected' : isPending ? 'Request Sent' : 'Send Connection Request'}</span>
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
