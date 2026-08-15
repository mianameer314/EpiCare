import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  HeartHandshake,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  X,
  Mail,
  Clock,
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
import './PatientCareNetwork.css';

/* ────────────────────────────────────────────────────
   Patient Care Network — Doctor Search & Caretaker Invites
   ──────────────────────────────────────────────────── */

const NETWORK_PER_PAGE = 5;

export function PatientCareNetwork() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'doctors' | 'caretakers'>('doctors');
  const [searchDoctorQuery, setSearchDoctorQuery] = useState('');
  const [docsPage, setDocsPage] = useState(1);
  const [carePage, setCarePage] = useState(1);
  const [caretakerEmail, setCaretakerEmail] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [docToDisconnect, setDocToDisconnect] = useState<{ id: number; name: string } | null>(null);
  const [careToDisconnect, setCareToDisconnect] = useState<{ id: number; name: string } | null>(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

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

  const { data: searchResults = [], isLoading: searchLoading, refetch: executeDoctorSearch } = useQuery({
    queryKey: ['connections', 'doctor-search', searchDoctorQuery],
    queryFn: () => connectionsApi.searchDoctors({ name: searchDoctorQuery || undefined }),
    enabled: searchDoctorQuery.trim().length >= 2,
  });

  // Mutations
  const requestDocMutation = useMutation({
    mutationFn: (doctorId: number) => connectionsApi.requestDoctorConnection(doctorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'patient-doctors'] });
      showSuccess('Connection request sent to doctor.');
    },
    onError: (err: any) => showErr(err.message || 'Failed to send connection request.'),
  });

  const disconnectDoctorMutation = useMutation({
    mutationFn: (connectionId: number) => connectionsApi.disconnectDoctor(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'patient-doctors'] });
      showSuccess('Doctor disconnected.');
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
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const showErr = (msg: string) => {
    setActionError(msg);
    setActionSuccess('');
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
          {/* Doctor Search Box */}
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div>
                <h3>Find & Connect With Verified Neurologist</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                  Search PMDC-verified physicians to grant clinical visibility into your EEG reports and seizure logs.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0 var(--space-3)' }}>
                <Search size={16} style={{ color: 'var(--color-text-placeholder)' }} />
                <input
                  type="text"
                  placeholder="Search doctor by name, specialty, or PMDC number..."
                  value={searchDoctorQuery}
                  onChange={(e) => setSearchDoctorQuery(e.target.value)}
                  style={{ border: 'none', background: 'none', padding: 'var(--space-3) 0', outline: 'none', fontSize: 'var(--text-sm)', width: '100%', color: 'var(--color-text-main)' }}
                />
              </div>
              <button
                className="btn btn-primary btn-md"
                onClick={() => executeDoctorSearch()}
                disabled={searchLoading}
              >
                {searchLoading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Verified Doctors Found:
                </div>
                {searchResults.map((doc: DoctorSearchItem) => (
                  <div
                    key={doc.doctor_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--color-surface-hover)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-text-main)', fontSize: 'var(--text-sm)' }}>
                        Dr. {doc.full_name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {doc.specialty} · PMDC: <strong>{doc.pmdc_number}</strong> {doc.hospital_affiliation && `· ${doc.hospital_affiliation}`}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => requestDocMutation.mutate(doc.doctor_id)}
                      disabled={requestDocMutation.isPending}
                    >
                      <UserPlus size={14} />
                      <span>Request Connection</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connected Doctors List */}
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
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
                  Use the search bar above to send a connection request to your neurologist.
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
                          Dr. {doc.doctor?.full_name || 'Physician'}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {doc.specialty} · PMDC: {doc.pmdc_number} {doc.hospital_affiliation && `· ${doc.hospital_affiliation}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span
                        className="glass-badge"
                        style={{
                          color: doc.relationship_status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-warning)',
                          fontSize: '11px',
                        }}
                      >
                        {doc.relationship_status === 'ACTIVE' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        <span>{doc.relationship_status}</span>
                      </span>

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDocToDisconnect({ id: doc.connection_id, name: doc.doctor?.full_name || 'Physician' })}
                        style={{ color: 'var(--color-error)', padding: '6px' }}
                        title="Revoke connection"
                      >
                        <Trash2 size={15} />
                      </button>
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
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
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
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {care.caretaker?.email} · Status: <strong>{care.relationship_status}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={care.can_proxy}
                          onChange={(e) => proxyToggleMutation.mutate({ id: care.connection_id, canProxy: e.target.checked })}
                          style={{ accentColor: 'var(--color-primary)' }}
                        />
                        <span>Proxy Write Access</span>
                      </label>

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCareToDisconnect({ id: care.connection_id, name: care.caretaker?.full_name || 'Caregiver' })}
                        style={{ color: 'var(--color-error)', padding: '6px' }}
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
        title="Disconnect Physician?"
        description={`Are you sure you want to disconnect Dr. ${docToDisconnect?.name}? They will no longer be able to review your EEG spectrograms or prescribe antiepileptic regimens.`}
        confirmText="Yes, Disconnect"
        cancelText="Cancel"
        variant="warning"
        isLoading={disconnectDoctorMutation.isPending}
        onConfirm={() => {
          if (docToDisconnect) {
            disconnectDoctorMutation.mutate(docToDisconnect.id);
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
    </div>
  );
}
