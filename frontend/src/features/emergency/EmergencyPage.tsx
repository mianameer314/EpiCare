import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Siren,
  PhoneCall,
  MapPin,
  Loader2,
  AlertCircle,
  History,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Clock,
  ShieldAlert,
  X,
  Radio,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { emergencyApi, type SosEventCreateResponse, type SosEvent } from '../../api/emergency';
import { EmergencyContactsManager } from './components/EmergencyContactsManager';
import { SeizureFirstAidGuide } from './components/SeizureFirstAidGuide';
import { EmergencyProtocolOverlay } from './components/EmergencyProtocolOverlay';
import { getAccurateLocation } from '../../utils/geolocation';
import { useToast } from '../../providers/ToastProvider';
import './EmergencyPage.css';

/* ────────────────────────────────────────────────────
   Emergency Command Center & Real-Time Incident Telemetry
   ──────────────────────────────────────────────────── */

function getRelativeTimeString(dateStr: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function EmergencyPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeProtocol, setActiveProtocol] = useState<SosEventCreateResponse | null>(null);
  const [triggerCoords, setTriggerCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [triggerError, setTriggerError] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Pagination & Filtering state for logs (default 5 items per page)
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<SosEvent | null>(null);

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['emergency', 'contacts'],
    queryFn: emergencyApi.getContacts,
  });

  const {
    data: sosHistory,
    isLoading: historyLoading,
    isFetching: historyFetching,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['emergency', 'sos-history', page, pageSize, statusFilter],
    queryFn: () =>
      emergencyApi.getSOSEvents({
        skip: page * pageSize,
        limit: pageSize,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    refetchInterval: 15000,
  });

  const sosMutation = useMutation({
    mutationFn: async () => {
      const geo = await getAccurateLocation();
      setTriggerCoords({ lat: geo.latitude, lng: geo.longitude });

      return emergencyApi.triggerSOS({
        latitude: geo.latitude,
        longitude: geo.longitude,
        location_available: geo.location_available,
      });
    },
    onSuccess: (res) => {
      setActiveProtocol(res);
      queryClient.invalidateQueries({ queryKey: ['emergency', 'sos-history'] });
      toast.error('Emergency SOS dispatched to response network.');
    },
    onError: (err: any) => {
      setTriggerError(err.message || 'Failed to trigger SOS dispatch.');
      toast.error(err.message || 'Failed to trigger SOS dispatch.');
    },
  });

  const handleTriggerSOS = () => {
    if (sosMutation.isPending || isLocating) return;
    setTriggerError('');
    setIsLocating(true);
    sosMutation.mutate(undefined, {
      onSettled: () => setIsLocating(false),
    });
  };

  // Filter items by search query if applicable
  const filteredEvents = useMemo(() => {
    if (!sosHistory?.items) return [];
    if (!searchTerm.trim()) return sosHistory.items;
    const query = searchTerm.toLowerCase().trim();
    return sosHistory.items.filter((ev) => {
      const idMatch = `#${ev.id}`.includes(query) || String(ev.id).includes(query);
      const statusMatch = ev.status.toLowerCase().includes(query);
      const contactMatch = ev.deliveries?.some((d) => d.contact_name.toLowerCase().includes(query));
      const registeredContactMatch = contacts.some((c) => c.name.toLowerCase().includes(query));
      return idMatch || statusMatch || contactMatch || registeredContactMatch;
    });
  }, [sosHistory, searchTerm, contacts]);

  const totalPages = sosHistory ? Math.ceil(sosHistory.total / pageSize) : 1;

  return (
    <div className="emergency-page">
      {/* ── Header ── */}
      <div className="emergency-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Siren size={24} />
          </div>
          <div>
            <h1>Emergency & SOS Command</h1>
            <p>Immediate alert dispatch, emergency contact management, and seizure first-aid protocols.</p>
          </div>
        </div>
      </div>

      {triggerError && (
        <div className="auth-error-banner" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <AlertCircle size={16} />
          <span>{triggerError}</span>
        </div>
      )}

      {/* ── Main SOS Trigger Hero Card ── */}
      <motion.div
        className="sos-trigger-card glass-card"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="sos-hero-content">
          <div className="sos-text-block">
            <span className="glass-badge" style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)', border: '1px solid rgba(207, 34, 46, 0.25)' }}>
              ⚡ Immediate Crisis Protocol
            </span>
            <h2 className="sos-title">Broadcast Emergency SOS</h2>
            <p className="sos-desc">
              Triggering SOS immediately relays your live GPS map link and SMS alert dispatch to all {contacts.length} registered emergency caregivers and opens the step-by-step first-aid protocol.
            </p>
          </div>

          <div className="sos-button-wrap">
            <button
              className="sos-big-btn"
              onClick={handleTriggerSOS}
              disabled={sosMutation.isPending || isLocating}
              aria-label="Activate Emergency SOS Alert"
            >
              {sosMutation.isPending || isLocating ? (
                <Loader2 size={36} className="animate-spin" />
              ) : (
                <>
                  <Siren size={36} />
                  <span>TRIGGER SOS</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="sos-card-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <MapPin size={14} style={{ color: 'var(--color-primary)' }} />
            <span>Live Map link auto-attached upon trigger</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <PhoneCall size={14} style={{ color: 'var(--color-secondary)' }} />
            <span>{contacts.length} Emergency caregiver{contacts.length !== 1 ? 's' : ''} in automated relay network</span>
          </div>
        </div>
      </motion.div>

      {/* ── 2-Column Grid: Contacts & First Aid ── */}
      <div className="emergency-grid" style={{ marginTop: 'var(--space-8)' }}>
        <EmergencyContactsManager contacts={contacts} isLoading={contactsLoading} />
        <SeizureFirstAidGuide />
      </div>

      {/* ── Real-Time SOS Dispatch Log & Telemetry Matrix ── */}
      <div className="sos-history-card glass-panel" style={{ marginTop: 'var(--space-8)' }}>
        <div className="sos-history-header">
          <div className="sos-history-title-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <History size={20} style={{ color: 'var(--color-primary)' }} />
              <h3>Past SOS Dispatch & Incident Logs</h3>
            </div>
            <p className="sos-history-sub">
              Complete historical record of all patient-initiated and automated seizure SOS broadcasts.
            </p>
          </div>

          <div className="sos-history-controls">
            <div className="live-telemetry-badge" title="Auto-polling real-time updates every 15s">
              <span className="live-telemetry-dot" />
              <span>Real-Time Sync</span>
            </div>

            <button
              className="btn btn-outline btn-sm"
              onClick={() => refetchHistory()}
              disabled={historyFetching}
              title="Refresh Incident Logs"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
            >
              <RefreshCw size={12} className={historyFetching ? 'animate-spin' : ''} />
              <span>{historyFetching ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <span className="glass-badge" style={{ fontWeight: 700, fontSize: '11px' }}>
              {sosHistory?.total || 0} Total Events
            </span>
          </div>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="sos-filters-bar">
          <div className="sos-status-tabs">
            {['ALL', 'COMPLETED', 'PENDING', 'ACTIVE'].map((tab) => (
              <button
                key={tab}
                className={`sos-status-tab ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter(tab);
                  setPage(0);
                }}
              >
                {tab === 'ALL' ? 'All Incidents' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="sos-search-wrap">
            <Search size={14} className="sos-search-icon" />
            <input
              type="text"
              placeholder="Search by Event #ID or caregiver name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sos-search-input"
            />
            {searchTerm && (
              <button
                className="sos-search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Event Table / List ── */}
        {historyLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '54px', borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="sos-empty-state">
            <ShieldAlert size={36} style={{ color: 'var(--color-text-placeholder)', marginBottom: 'var(--space-2)' }} />
            <h4>No Emergency Incidents Found</h4>
            <p>
              {searchTerm
                ? `No events matching "${searchTerm}". Try resetting your filter.`
                : 'No SOS broadcasts have been triggered. Your safety logs are clear.'}
            </p>
          </div>
        ) : (
          <div className="sos-table-wrapper">
            <table className="sos-telemetry-table">
              <thead>
                <tr>
                  <th>Incident #</th>
                  <th>Timestamp</th>
                  <th>Incident Location</th>
                  <th>Status</th>
                  <th>Caregivers & Contacts Dispatched</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((ev) => {
                  const date = new Date(ev.triggered_at);
                  const relTime = getRelativeTimeString(ev.triggered_at);

                  // Extract recipient names
                  const hasDeliveries = ev.deliveries && ev.deliveries.length > 0;

                  return (
                    <tr key={ev.id} className="sos-table-row">
                      {/* Incident ID */}
                      <td>
                        <div className="incident-id-badge">
                          <Radio size={12} className="incident-beacon-icon" />
                          <span>#{ev.id}</span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td>
                        <div className="incident-time-cell">
                          <span className="incident-rel-time">{relTime}</span>
                          <span className="incident-full-time">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Clean Map Option (Zero Coordinates) */}
                      <td>
                        {ev.location_available && ev.latitude && ev.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${ev.latitude},${ev.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="incident-map-btn"
                            title="Open Incident Location in Google Maps"
                          >
                            <MapPin size={13} style={{ color: '#dc2626' }} />
                            <span>View on Map</span>
                            <ExternalLink size={11} style={{ opacity: 0.7 }} />
                          </a>
                        ) : (
                          <span className="location-offline-pill">
                            <MapPin size={12} />
                            <span>Location Unavailable</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`sos-status-badge ${ev.status.toLowerCase()}`}>
                          {ev.status === 'COMPLETED' ? (
                            <CheckCircle2 size={12} />
                          ) : ev.status === 'ACTIVE' ? (
                            <Siren size={12} className="animate-pulse" />
                          ) : (
                            <AlertTriangle size={12} />
                          )}
                          <span>{ev.status}</span>
                        </span>
                      </td>

                      {/* Caregivers / Contacts Dispatched */}
                      <td>
                        {hasDeliveries ? (
                          <div className="deliveries-stack">
                            <div className="deliveries-chips">
                              {ev.deliveries.map((del, idx) => (
                                <span
                                  key={idx}
                                  className={`delivery-chip ${
                                    del.delivery_status === 'SENT' || del.delivery_status === 'DELIVERED'
                                      ? 'success'
                                      : 'failed'
                                  }`}
                                  title={`${del.contact_name} (${del.phone_number}): ${del.delivery_status}`}
                                >
                                  <UserCheck size={11} />
                                  <span>{del.contact_name}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : contacts.length > 0 ? (
                          <div className="deliveries-stack">
                            <div className="deliveries-chips">
                              {contacts.map((c) => (
                                <span
                                  key={c.id}
                                  className="delivery-chip success"
                                  title={`Dispatched to ${c.name} (${c.relationship} - ${c.phone_number})`}
                                >
                                  <UserCheck size={11} />
                                  <span>{c.name} ({c.relationship})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="no-deliveries-label">
                            <UserCheck size={11} color="var(--color-success)" />
                            <span>Dispatched to Registered Caregiver</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm inspect-event-btn"
                          onClick={() => setSelectedEvent(ev)}
                          title="Inspect Telemetry Details"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Footer ── */}
        {sosHistory && sosHistory.total > 0 && (
          <div className="sos-pagination-footer">
            <div className="pagination-info">
              Showing <strong>{page * pageSize + 1}</strong> –{' '}
              <strong>{Math.min((page + 1) * pageSize, sosHistory.total)}</strong> of{' '}
              <strong>{sosHistory.total}</strong> Incidents
            </div>

            <div className="pagination-controls">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="pagination-pagesize-select"
                aria-label="Events per page"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
              </select>

              <div className="pagination-nav-btns">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || historyLoading}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                <span className="pagination-page-indicator">
                  Page {page + 1} of {Math.max(1, totalPages)}
                </span>

                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || historyLoading}
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Incident Telemetry Inspection Modal ── */}
      <AnimatePresence>
        {selectedEvent && (
          <div
            className="glass-backdrop incident-modal-overlay"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              className="glass-panel incident-modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="incident-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div className="incident-modal-beacon">
                    <Siren size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>
                      SOS Incident Telemetry #{selectedEvent.id}
                    </h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Triggered {new Date(selectedEvent.triggered_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="confirm-close-btn"
                  onClick={() => setSelectedEvent(null)}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="incident-modal-body">
                {/* Status & Location Overview */}
                <div className="incident-grid-2col">
                  <div className="incident-info-tile">
                    <span className="tile-label">Broadcast Status</span>
                    <div style={{ marginTop: '4px' }}>
                      <span className={`sos-status-badge ${selectedEvent.status.toLowerCase()}`}>
                        <CheckCircle2 size={12} />
                        <span>{selectedEvent.status}</span>
                      </span>
                    </div>
                  </div>

                  <div className="incident-info-tile">
                    <span className="tile-label">Incident GPS Location</span>
                    <div style={{ marginTop: '4px' }}>
                      {selectedEvent.location_available && selectedEvent.latitude && selectedEvent.longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${selectedEvent.latitude},${selectedEvent.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="incident-map-btn"
                          style={{ padding: '5px 12px', fontSize: '11px', display: 'inline-flex' }}
                        >
                          <MapPin size={13} style={{ color: '#dc2626' }} />
                          <span>View on Google Maps</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-placeholder)' }}>
                          Location Signal Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recipient Caregivers List */}
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                    Caregivers & Emergency Contacts Alerted
                  </h4>

                  {selectedEvent.deliveries && selectedEvent.deliveries.length > 0 ? (
                    <div className="incident-deliveries-list">
                      {selectedEvent.deliveries.map((del, idx) => (
                        <div key={idx} className="incident-delivery-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className={`delivery-status-icon ${del.delivery_status === 'SENT' || del.delivery_status === 'DELIVERED' ? 'success' : 'error'}`}>
                              {del.delivery_status === 'SENT' || del.delivery_status === 'DELIVERED' ? (
                                <CheckCircle2 size={14} />
                              ) : (
                                <XCircle size={14} />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>{del.contact_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{del.phone_number}</div>
                            </div>
                          </div>
                          <span className={`delivery-chip ${del.delivery_status === 'SENT' || del.delivery_status === 'DELIVERED' ? 'success' : 'failed'}`}>
                            {del.delivery_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : contacts.length > 0 ? (
                    <div className="incident-deliveries-list">
                      {contacts.map((c) => (
                        <div key={c.id} className="incident-delivery-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="delivery-status-icon success">
                              <CheckCircle2 size={14} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>{c.name} ({c.relationship})</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.phone_number}</div>
                            </div>
                          </div>
                          <span className="delivery-chip success">
                            DELIVERED
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Alert dispatched to registered emergency contacts.
                    </div>
                  )}
                </div>

                {/* Clinical Emergency Protocol Check */}
                <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(45, 90, 63, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(45, 90, 63, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                    <Clock size={13} />
                    <span>Post-Incident Safety Protocol</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    Ensure patient is placed in the safe recovery position (on their side), airways remain unobstructed, and time the recovery. If seizure duration exceeds 5 minutes or repeats, contact emergency medical services (911 / 1122) immediately.
                  </p>
                </div>
              </div>

              <div className="incident-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-md"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close Incident Log
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Active Emergency Protocol Overlay ── */}
      <AnimatePresence>
        {activeProtocol !== null && (
          <EmergencyProtocolOverlay
            contacts={contacts}
            eventId={activeProtocol.event_id}
            latitude={triggerCoords.lat}
            longitude={triggerCoords.lng}
            onDeactivate={() => setActiveProtocol(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
