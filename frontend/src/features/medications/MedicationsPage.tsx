import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Search,
  Check,
  Bell,
  Sun,
  Moon,
  Sunrise,
  ShieldAlert,
  Info,
  ListFilter,
  X,
  Stethoscope,
  Activity,
  Award,
  Sparkles,
} from 'lucide-react';
import {
  medicationsApi,
  type Medication,
  type MedicationCreate,
  type TodayScheduleSlot,
} from '../../api/medications';
import { useToast } from '../../providers/ToastProvider';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';
import './MedicationsPage.css';

/* ────────────────────────────────────────────────────
   Epilepsy Medications & Daily Adherence Center
   Built for patient empowerment, live calculated daily dosing
   reminders from DB, doctor prescriber linking, search, and
   clinical missed-dose safety protocols.
   ──────────────────────────────────────────────────── */

type MedsTab = 'schedule' | 'prescriptions' | 'history';

const PRESETS = [
  { name: 'Levetiracetam', brand_name: 'Keppra', generic_name: 'Levetiracetam', dosage: '500mg', frequency: 'Twice daily (BID)', intake_timing: 'After meals with water', notes: 'First-line therapy for focal and generalized seizures.' },
  { name: 'Lamotrigine', brand_name: 'Lamictal', generic_name: 'Lamotrigine', dosage: '100mg', frequency: 'Twice daily (BID)', intake_timing: '12-hour regular interval', notes: 'Maintain strict 12-hour intervals. Report any skin rashes.' },
  { name: 'Sodium Valproate', brand_name: 'Epilim', generic_name: 'Valproic Acid', dosage: '300mg', frequency: 'Twice daily (BID)', intake_timing: 'With or after food', notes: 'Take with food to minimize gastric irritation.' },
  { name: 'Carbamazepine', brand_name: 'Tegretol', generic_name: 'Carbamazepine', dosage: '200mg', frequency: 'Twice daily (BID)', intake_timing: 'During or after meals', notes: 'Consistent dosing. Avoid grapefruit juice.' },
  { name: 'Topiramate', brand_name: 'Topamax', generic_name: 'Topiramate', dosage: '50mg', frequency: 'Once daily (Night)', intake_timing: 'Before bedtime', notes: 'Drink plenty of fluids throughout the day.' },
  { name: 'Clobazam', brand_name: 'Frisium', generic_name: 'Clobazam', dosage: '10mg', frequency: 'Once daily (Night)', intake_timing: 'At bedtime', notes: 'Adjunctive nocturnal seizure prevention.' },
];

const MEDS_PER_PAGE = 6;
const LOGS_PER_PAGE = 8;

export function MedicationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MedsTab>('schedule');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'night'>('all');
  const [medsPage, setMedsPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [medToDelete, setMedToDelete] = useState<{ id: number; name: string } | null>(null);
  const [missedProtocolOpen, setMissedProtocolOpen] = useState(false);
  const [loggedPrescriptionIds, setLoggedPrescriptionIds] = useState<Set<number>>(new Set());
  const toast = useToast();

  // Form State
  const [formData, setFormData] = useState<MedicationCreate>({
    name: '',
    generic_name: '',
    brand_name: '',
    dosage: '500mg',
    frequency: 'Twice daily (BID)',
    intake_timing: 'With water after food',
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
    is_active: true,
  });

  // Queries from PostgreSQL Backend
  const { data: medsData, isLoading: medsLoading } = useQuery({
    queryKey: ['medications', 'list', searchQuery],
    queryFn: () => medicationsApi.getMedications({ is_active: true, search: searchQuery || undefined }),
  });

  const { data: dailySlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['medications', 'daily-schedule'],
    queryFn: () => medicationsApi.getDailySchedule(),
  });

  const { data: adherenceStats } = useQuery({
    queryKey: ['medications', 'adherence-stats'],
    queryFn: () => medicationsApi.getAdherenceStats(),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['medications', 'logs'],
    queryFn: () => medicationsApi.getLogs({ limit: 50 }),
  });

  const medications = medsData?.items || [];
  const logs = logsData?.items || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: MedicationCreate) => medicationsApi.createMedication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      closeModal();
      toast.success('Prescription saved to database and live schedules generated.');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to add medication prescription.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => medicationsApi.deleteMedication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setMedToDelete(null);
      toast.info('Prescription removed.');
    },
  });

  const logDoseMutation = useMutation({
    mutationFn: (medId: number) =>
      medicationsApi.logMedicationDose(medId, { status: 'TAKEN' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      
      // Mark this specific prescription ID as locally logged for UI idempotency
      setLoggedPrescriptionIds(prev => new Set(prev).add(variables));
      
      toast.success('Dose recorded as taken! Daily adherence updated.');
    },
  });

  // Filtered Daily Schedule Slots
  const morningSlots = dailySlots.filter(s => s.time_window === 'Morning');
  const afternoonSlots = dailySlots.filter(s => s.time_window === 'Afternoon');
  const nightSlots = dailySlots.filter(s => s.time_window === 'Night');

  // Filtered Prescriptions by Time of day
  const filteredMeds = medications.filter(m => {
    if (timeFilter === 'morning') {
      return m.frequency.toLowerCase().includes('bid') ||
             m.frequency.toLowerCase().includes('morning') ||
             m.frequency.toLowerCase().includes('tid');
    }
    if (timeFilter === 'afternoon') {
      return m.frequency.toLowerCase().includes('tid') ||
             m.frequency.toLowerCase().includes('afternoon');
    }
    if (timeFilter === 'night') {
      return m.frequency.toLowerCase().includes('bid') ||
             m.frequency.toLowerCase().includes('night') ||
             m.frequency.toLowerCase().includes('tid') ||
             m.frequency.toLowerCase().includes('bedtime');
    }
    return true;
  });

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    if (selectedPreset === preset.name) {
      // If clicking the active preset again -> clear form back to empty
      setSelectedPreset(null);
      setFormData({
        name: '',
        generic_name: '',
        brand_name: '',
        dosage: '',
        frequency: 'Twice daily (BID)',
        intake_timing: '',
        start_date: new Date().toISOString().split('T')[0],
        notes: '',
        is_active: true,
      });
    } else {
      // Fill form with preset data
      setSelectedPreset(preset.name);
      setFormData({
        name: `${preset.name} (${preset.brand_name})`,
        generic_name: preset.generic_name,
        brand_name: preset.brand_name,
        dosage: preset.dosage,
        frequency: preset.frequency,
        intake_timing: preset.intake_timing,
        start_date: new Date().toISOString().split('T')[0],
        notes: preset.notes,
        is_active: true,
      });
    }
  };

  const openAddModal = () => {
    setSelectedPreset(null);
    setFormData({
      name: '',
      generic_name: '',
      brand_name: '',
      dosage: '500mg',
      frequency: 'Twice daily (BID)',
      intake_timing: 'With water after food',
      start_date: new Date().toISOString().split('T')[0],
      notes: '',
      is_active: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Medication name is required.');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="medications-page">
      {/* ── Header ── */}
      <div className="medications-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="med-header-icon-aura">
            <Pill size={24} />
          </div>
          <div>
            <h1>Medication & Daily Dosing Regimen</h1>
            <p>Track doctor-prescribed antiepileptics (AEDs), live daily intake windows, and adherence safety logs.</p>
          </div>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="meds-tab-switcher glass-panel">
          <button
            className={`meds-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <Clock size={15} />
            <span>Today's Schedule ({dailySlots.length})</span>
          </button>
          <button
            className={`meds-tab-btn ${activeTab === 'prescriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('prescriptions')}
          >
            <Pill size={15} />
            <span>All Prescriptions ({medications.length})</span>
          </button>
          <button
            className={`meds-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Calendar size={15} />
            <span>Dose History</span>
          </button>
        </div>
      </div>

      {/* ── Live Metrics from PostgreSQL ── */}
      <div className="meds-metrics-grid">
        <div className="glass-card med-stat-card">
          <div className="stat-icon-aura" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}>
            <Pill size={20} />
          </div>
          <div>
            <div className="stat-label">Active Prescriptions</div>
            <div className="stat-val">{adherenceStats?.active_prescriptions_count ?? medications.length} AEDs</div>
            <div className="stat-sub">Regimen Prescribed by Doctor</div>
          </div>
        </div>

        <div className="glass-card med-stat-card">
          <div className="stat-icon-aura" style={{ background: 'rgba(45, 90, 63, 0.1)', color: 'var(--color-primary-dark)' }}>
            <Award size={20} />
          </div>
          <div>
            <div className="stat-label">7-Day Adherence Rate</div>
            <div className="stat-val" style={{ color: 'var(--color-success)' }}>
              {adherenceStats?.adherence_7d_percent ?? 100}%
            </div>
            <div className="stat-sub">Status: {adherenceStats?.status_level ?? 'OPTIMAL'}</div>
          </div>
        </div>

        <div className="glass-card med-stat-card">
          <div className="stat-icon-aura" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <Bell size={20} />
          </div>
          <div>
            <div className="stat-label">Next Reminder</div>
            <div className="stat-val">
              {adherenceStats && adherenceStats.active_prescriptions_count > 0
                ? adherenceStats.next_reminder_time
                : 'No Reminders'}
            </div>
            <div className="stat-sub">
              {adherenceStats && adherenceStats.active_prescriptions_count > 0
                ? 'Automated FCM Push Ready'
                : 'Add prescription to set alerts'}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TAB 1: TODAY'S LIVE DOSING SCHEDULE (DB CALCULATED)
          ══════════════════════════════════════════════════ */}
      {activeTab === 'schedule' && (
        <motion.div
          key="schedule"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
        >
          {/* ── Unified Missed Dose Clinical Safety Card (Expands in Place) ── */}
          <div className="glass-card missed-dose-safety-bar">
            <div className="missed-dose-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(217, 119, 6, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  flexShrink: 0,
                }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-main)' }}>
                    Epilepsy Clinical Safety Reminder:
                  </strong>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    Missing antiepileptic doses is the leading trigger for breakthrough seizures. Mark your doses as taken promptly.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setMissedProtocolOpen(!missedProtocolOpen)}
                style={{ fontSize: '11.5px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}
              >
                <Info size={13} />
                <span>{missedProtocolOpen ? 'Hide Protocol' : 'Missed Dose Protocol'}</span>
              </button>
            </div>

            {/* Collapsible Guidelines Expanded Directly Inside the Same Card */}
            <AnimatePresence>
              {missedProtocolOpen && (
                <motion.div
                  className="missed-protocol-inner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden', width: '100%' }}
                >
                  <div style={{
                    borderTop: '1px solid rgba(217, 119, 6, 0.2)',
                    marginTop: 'var(--space-3)',
                    paddingTop: 'var(--space-3)',
                  }}>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', color: '#92400e', fontWeight: 600 }}>
                      Clinical Protocol: What to do if you missed an AED dose:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      <li><strong>If remembered within 4–6 hours:</strong> Take the missed dose immediately, then resume your normal schedule.</li>
                      <li><strong>If near your next scheduled dose:</strong> Skip the missed dose and take your next regular dose. <em>Never double up doses.</em></li>
                      <li><strong>If you vomited within 30 minutes of intake:</strong> Consult your neurologist or emergency care if seizure clusters occur.</li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {slotsLoading ? (
            <div className="dosing-timeline">
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-xl)' }} />)}
            </div>
          ) : dailySlots.length === 0 ? (
            <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <Pill size={48} style={{ color: 'var(--color-text-placeholder)', margin: '0 auto var(--space-4)', opacity: 0.4 }} />
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>No Prescriptions in Your Schedule</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                Your neurologist will assign your medications, or you can record your current prescription to start daily tracking.
              </p>
              <button className="btn btn-primary btn-md" onClick={openAddModal}>
                Record Your Prescription
              </button>
            </div>
          ) : (
            <div className="dosing-timeline">
              {/* Morning Slot */}
              <div className="glass-card dosing-slot-card">
                <div className="dosing-slot-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Sunrise size={18} style={{ color: '#d97706' }} />
                    <span className="slot-title">Morning Window</span>
                  </div>
                  <span className="slot-time-badge">08:00 AM</span>
                </div>

                {morningSlots.length === 0 ? (
                  <div className="slot-empty">No morning medications scheduled.</div>
                ) : (
                  <div className="slot-meds-list">
                    {morningSlots.map((slot: TodayScheduleSlot) => (
                      <div key={slot.slot_id} className="slot-med-item">
                        <div className="slot-med-info">
                          <div className="slot-med-name">{slot.medication_name}</div>
                          <div className="slot-med-meta">
                            {slot.dosage} · {slot.intake_timing}
                          </div>
                          {slot.prescribed_by_name && (
                            <div style={{ fontSize: '10px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                              <Stethoscope size={10} />
                              <span>{slot.prescribed_by_name}</span>
                            </div>
                          )}
                        </div>

                        {slot.status === 'TAKEN' || loggedPrescriptionIds.has(slot.medication_id) ? (
                          <span className="glass-badge" style={{ color: 'var(--color-success)', fontSize: '11px' }}>
                            <CheckCircle2 size={12} /> Taken
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm take-dose-btn"
                            onClick={() => logDoseMutation.mutate(slot.medication_id)}
                            disabled={logDoseMutation.isPending && logDoseMutation.variables === slot.medication_id}
                          >
                            <Check size={14} />
                            <span>Mark Taken</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Afternoon Slot */}
              <div className="glass-card dosing-slot-card">
                <div className="dosing-slot-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Sun size={18} style={{ color: '#ea580c' }} />
                    <span className="slot-title">Afternoon Window</span>
                  </div>
                  <span className="slot-time-badge">02:00 PM</span>
                </div>

                {afternoonSlots.length === 0 ? (
                  <div className="slot-empty">No mid-day medications scheduled.</div>
                ) : (
                  <div className="slot-meds-list">
                    {afternoonSlots.map((slot: TodayScheduleSlot) => (
                      <div key={slot.slot_id} className="slot-med-item">
                        <div className="slot-med-info">
                          <div className="slot-med-name">{slot.medication_name}</div>
                          <div className="slot-med-meta">
                            {slot.dosage} · {slot.intake_timing}
                          </div>
                          {slot.prescribed_by_name && (
                            <div style={{ fontSize: '10px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                              <Stethoscope size={10} />
                              <span>{slot.prescribed_by_name}</span>
                            </div>
                          )}
                        </div>

                        {slot.status === 'TAKEN' || loggedPrescriptionIds.has(slot.medication_id) ? (
                          <span className="glass-badge" style={{ color: 'var(--color-success)', fontSize: '11px' }}>
                            <CheckCircle2 size={12} /> Taken
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm take-dose-btn"
                            onClick={() => logDoseMutation.mutate(slot.medication_id)}
                            disabled={logDoseMutation.isPending && logDoseMutation.variables === slot.medication_id}
                          >
                            <Check size={14} />
                            <span>Mark Taken</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Night Slot */}
              <div className="glass-card dosing-slot-card">
                <div className="dosing-slot-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Moon size={18} style={{ color: '#4f46e5' }} />
                    <span className="slot-title">Night Window</span>
                  </div>
                  <span className="slot-time-badge">08:00 PM</span>
                </div>

                {nightSlots.length === 0 ? (
                  <div className="slot-empty">No nocturnal medications scheduled.</div>
                ) : (
                  <div className="slot-meds-list">
                    {nightSlots.map((slot: TodayScheduleSlot) => (
                      <div key={slot.slot_id} className="slot-med-item">
                        <div className="slot-med-info">
                          <div className="slot-med-name">{slot.medication_name}</div>
                          <div className="slot-med-meta">
                            {slot.dosage} · {slot.intake_timing}
                          </div>
                          {slot.prescribed_by_name && (
                            <div style={{ fontSize: '10px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                              <Stethoscope size={10} />
                              <span>{slot.prescribed_by_name}</span>
                            </div>
                          )}
                        </div>

                        {slot.status === 'TAKEN' || loggedPrescriptionIds.has(slot.medication_id) ? (
                          <span className="glass-badge" style={{ color: 'var(--color-success)', fontSize: '11px' }}>
                            <CheckCircle2 size={12} /> Taken
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm take-dose-btn"
                            onClick={() => logDoseMutation.mutate(slot.medication_id)}
                            disabled={logDoseMutation.isPending && logDoseMutation.variables === slot.medication_id}
                          >
                            <Check size={14} />
                            <span>Mark Taken</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 2: ALL PRESCRIPTIONS & REAL-TIME SEARCH FILTER
          ══════════════════════════════════════════════════ */}
      {activeTab === 'prescriptions' && (
        <motion.div
          key="prescriptions"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
        >
          {/* Search & Action Bar */}
          <div className="meds-search-bar-wrap">
            <div className="meds-search-input-box">
              <Search size={16} style={{ color: 'var(--color-text-placeholder)' }} />
              <input
                type="text"
                placeholder="Search prescription by drug name or clinical note..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setMedsPage(1);
                }}
                className="meds-search-input"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <div className="time-filter-chips">
                <button
                  className={`filter-chip-btn ${timeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTimeFilter('all')}
                >
                  All
                </button>
                <button
                  className={`filter-chip-btn ${timeFilter === 'morning' ? 'active' : ''}`}
                  onClick={() => setTimeFilter('morning')}
                >
                  <Sunrise size={12} /> Morning
                </button>
                <button
                  className={`filter-chip-btn ${timeFilter === 'afternoon' ? 'active' : ''}`}
                  onClick={() => setTimeFilter('afternoon')}
                >
                  <Sun size={12} /> Noon
                </button>
                <button
                  className={`filter-chip-btn ${timeFilter === 'night' ? 'active' : ''}`}
                  onClick={() => setTimeFilter('night')}
                >
                  <Moon size={12} /> Night
                </button>
              </div>

              <button className="btn btn-primary btn-sm" onClick={openAddModal} style={{ whiteSpace: 'nowrap' }}>
                <Pill size={14} />
                <span>+ Add Prescription</span>
              </button>
            </div>
          </div>

          {/* Prescriptions Grid */}
          {medsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-xl)' }} />)}
            </div>
          ) : filteredMeds.length === 0 ? (
            <div className="glass-card" style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
              <ListFilter size={40} style={{ color: 'var(--color-text-placeholder)', margin: '0 auto var(--space-3)', opacity: 0.4 }} />
              <h4 style={{ margin: '0 0 var(--space-1)' }}>No matching prescriptions found</h4>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                Try adjusting your search query or time filter.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                {filteredMeds
                  .slice((medsPage - 1) * MEDS_PER_PAGE, medsPage * MEDS_PER_PAGE)
                  .map((med: Medication) => (
                    <motion.div
                      key={med.id}
                      className="glass-card prescription-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="rx-card-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div className="rx-icon-aura">
                            <Pill size={20} />
                          </div>
                          <div>
                            <h3 className="rx-name">{med.name}</h3>
                            <span className="rx-dosage">{med.dosage} · {med.frequency}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setMedToDelete({ id: med.id, name: med.name })}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-error)', padding: '6px' }}
                          title="Remove prescription"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="rx-details-list">
                        {med.prescribed_by_name ? (
                          <div className="rx-detail-row" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                            <Stethoscope size={13} style={{ color: 'var(--color-primary)' }} />
                            <span>
                              {med.prescribed_by_name} {med.prescribed_by_pmdc && `(PMDC: ${med.prescribed_by_pmdc})`}
                            </span>
                          </div>
                        ) : (
                          <div className="rx-detail-row">
                            <Activity size={13} style={{ color: 'var(--color-text-placeholder)' }} />
                            <span>Prescriber: <strong>Self-Reported / Patient Logged</strong></span>
                          </div>
                        )}

                        <div className="rx-detail-row">
                          <Clock size={13} style={{ color: 'var(--color-secondary)' }} />
                          <span>Timing: <strong>{med.intake_timing || 'With water after food'}</strong></span>
                        </div>
                        <div className="rx-detail-row">
                          <Calendar size={13} style={{ color: 'var(--color-primary)' }} />
                          <span>Started: <strong>{new Date(med.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                        </div>
                        {med.notes && (
                          <div className="rx-notes-box">
                            <Info size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                            <span>"{med.notes}"</span>
                          </div>
                        )}
                      </div>

                      <div className="rx-card-footer">
                        <span className="glass-badge" style={{ color: 'var(--color-success)', fontSize: '11px' }}>
                          <CheckCircle2 size={12} /> Active Therapy
                        </span>

                        {loggedPrescriptionIds.has(med.id) ? (
                          <span className="glass-badge" style={{ color: 'var(--color-success)', fontSize: '11px' }}>
                            <CheckCircle2 size={12} /> Logged Today
                          </span>
                        ) : (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => logDoseMutation.mutate(med.id)}
                            disabled={logDoseMutation.isPending && logDoseMutation.variables === med.id}
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            <Check size={13} style={{ color: 'var(--color-success)' }} />
                            <span>Log Dose</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
              </div>

              <Pagination
                currentPage={medsPage}
                totalPages={Math.ceil(filteredMeds.length / MEDS_PER_PAGE)}
                totalItems={filteredMeds.length}
                pageSize={MEDS_PER_PAGE}
                itemName="prescriptions"
                onPageChange={setMedsPage}
              />
            </>
          )}
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 3: ADHERENCE LOGS & HISTORICAL AUDIT (POSTGRESQL)
          ══════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <motion.div
          key="history"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                <h3>Medication Adherence History</h3>
              </div>
              <span className="glass-badge">{logs.length} Recorded Doses</span>
            </div>

            {logsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius-md)' }} />)}
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                No dose logs recorded yet. Use the "Mark Taken" buttons in Today's Schedule to log intake.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: 'var(--space-2)' }}>Log ID</th>
                      <th style={{ padding: 'var(--space-2)' }}>Medication / Schedule</th>
                      <th style={{ padding: 'var(--space-2)' }}>Timestamp Taken</th>
                      <th style={{ padding: 'var(--space-2)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs
                      .slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE)
                      .map((l) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: 'var(--space-3) var(--space-2)', fontWeight: 600 }}>#{l.id}</td>
                          <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                              {l.medication_name || 'Prescription Dose'}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                              {l.notes || (l.dose_taken ? `Dose: ${l.dose_taken}` : 'Routine dose taken on time')}
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-2)', fontSize: 'var(--text-xs)' }}>
                            {new Date(l.taken_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                            <span
                              className="glass-badge"
                              style={{
                                color: l.status === 'TAKEN' ? 'var(--color-success)' : 'var(--color-warning)',
                                fontSize: '11px',
                              }}
                            >
                              <CheckCircle2 size={11} /> {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                <Pagination
                  currentPage={logsPage}
                  totalPages={Math.ceil(logs.length / LOGS_PER_PAGE)}
                  totalItems={logs.length}
                  pageSize={LOGS_PER_PAGE}
                  itemName="dose logs"
                  onPageChange={setLogsPage}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Add Medication Modal (Spacious & Clean) ── */}
      <AnimatePresence>
        {modalOpen && (
          <div className="glass-backdrop" onClick={closeModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', zIndex: 1000 }}>
            <motion.div
              className="glass-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ maxWidth: '720px', width: '100%', padding: 'var(--space-8)', borderRadius: 'var(--radius-2xl)' }}
            >
              {/* Header */}
              <div className="bento-header" style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--color-primary-50)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Pill size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Record Prescription Regimen</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Enter doctor-prescribed medication, daily dosage timings, and clinical notes.
                    </p>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={closeModal} style={{ padding: '6px', borderRadius: 'var(--radius-full)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Clean Quick Preset Panel */}
              <div className="rx-presets-panel">
                <div className="rx-presets-header">
                  <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Quick Presets — Standard Antiepileptic Drugs (AEDs):</span>
                </div>
                <div className="rx-presets-grid">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      className={`preset-chip-btn ${selectedPreset === p.name ? 'active' : ''}`}
                      onClick={() => applyPreset(p)}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span className="preset-brand-tag">{p.brand_name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                  id="med_name"
                  label="Medication Name & Formulation"
                  placeholder="e.g. Levetiracetam (Keppra)"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                  <Input
                    id="med_dosage"
                    label="Dosage per Intake"
                    placeholder="e.g. 500mg, 10ml"
                    required
                    value={formData.dosage}
                    onChange={(e) => setFormData(p => ({ ...p, dosage: e.target.value }))}
                  />

                  <Select
                    id="med_freq"
                    label="Dosing Frequency"
                    value={formData.frequency}
                    onChange={(val) => setFormData(p => ({ ...p, frequency: val }))}
                    options={[
                      { value: 'Twice daily (BID)', label: 'Twice daily (Morning & Night)' },
                      { value: 'Once daily (Morning)', label: 'Once daily (Morning)' },
                      { value: 'Once daily (Night)', label: 'Once daily (Bedtime)' },
                      { value: 'Three times daily (TID)', label: 'Three times daily (TID)' },
                      { value: 'As needed (PRN Rescue)', label: 'Emergency Rescue (PRN)' },
                    ]}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                  <Input
                    id="med_start"
                    type="date"
                    label="Prescription Start Date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData(p => ({ ...p, start_date: e.target.value }))}
                  />

                  <Input
                    id="med_timing"
                    label="Intake Timing Instructions"
                    placeholder="e.g. With water after food"
                    value={formData.intake_timing || ''}
                    onChange={(e) => setFormData(p => ({ ...p, intake_timing: e.target.value }))}
                  />
                </div>

                <Input
                  id="med_notes"
                  label="Doctor Instructions / Notes"
                  placeholder="e.g. Prescribed by Dr. Faisal. Titrate up every 2 weeks."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                />

                {formError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-error)', fontSize: 'var(--text-xs)' }}>
                    <AlertCircle size={14} />
                    <span>{formError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                  <button type="button" className="btn btn-outline btn-md" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-md" disabled={createMutation.isPending} style={{ minWidth: '160px' }}>
                    {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Pill size={16} />}
                    <span>Save Prescription</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Confirm Delete Prescription Dialog ── */}
      <ConfirmDialog
        isOpen={medToDelete !== null}
        title="Discontinue Medication Prescription?"
        description={`Are you sure you want to remove ${medToDelete?.name} from your active medication regimen? This will cease daily dosage reminders.`}
        confirmText="Yes, Discontinue"
        cancelText="Keep Prescription"
        variant="danger"
        onConfirm={() => {
          if (medToDelete) deleteMutation.mutate(medToDelete.id);
        }}
        onClose={() => setMedToDelete(null)}
      />
    </div>
  );
}
