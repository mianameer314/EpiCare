import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, PhoneCall, MapPin, Loader2, AlertCircle, History, CheckCircle2, XCircle } from 'lucide-react';
import { emergencyApi, type SosEventCreateResponse } from '../../api/emergency';
import { EmergencyContactsManager } from './components/EmergencyContactsManager';
import { SeizureFirstAidGuide } from './components/SeizureFirstAidGuide';
import { EmergencyProtocolOverlay } from './components/EmergencyProtocolOverlay';
import './EmergencyPage.css';

/* ────────────────────────────────────────────────────
   Emergency Hub Page — SOS Trigger, Contacts & First Aid
   ──────────────────────────────────────────────────── */

export function EmergencyPage() {
  const queryClient = useQueryClient();
  const [activeProtocol, setActiveProtocol] = useState<SosEventCreateResponse | null>(null);
  const [triggerCoords, setTriggerCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [triggerError, setTriggerError] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['emergency', 'contacts'],
    queryFn: emergencyApi.getContacts,
  });

  const { data: sosHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['emergency', 'sos-history'],
    queryFn: () => emergencyApi.getSOSEvents({ limit: 10 }),
  });

  const sosMutation = useMutation({
    mutationFn: async () => {
      let lat: number | null = null;
      let lng: number | null = null;
      let locationAvailable = false;

      // Try browser geolocation
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 6000,
              enableHighAccuracy: true,
              maximumAge: 10000,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          locationAvailable = true;
          setTriggerCoords({ lat, lng });
        } catch {
          // Geolocation timed out or denied — proceed without GPS
          setTriggerCoords({ lat: null, lng: null });
        }
      }

      return emergencyApi.triggerSOS({
        latitude: lat,
        longitude: lng,
        location_available: locationAvailable,
      });
    },
    onSuccess: (res) => {
      setActiveProtocol(res);
      queryClient.invalidateQueries({ queryKey: ['emergency', 'sos-history'] });
    },
    onError: (err: any) => {
      setTriggerError(err.message || 'Failed to trigger SOS dispatch.');
    },
  });

  const handleTriggerSOS = () => {
    setTriggerError('');
    setIsLocating(true);
    sosMutation.mutate(undefined, {
      onSettled: () => setIsLocating(false),
    });
  };

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
        transition={{ duration: 0.4 }}
      >
        <div className="sos-hero-content">
          <div className="sos-text-block">
            <span className="glass-badge" style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)' }}>
              ⚡ Immediate Threat Response
            </span>
            <h2 className="sos-title">Trigger Emergency SOS</h2>
            <p className="sos-desc">
              Broadcasting SOS instantly alerts all {contacts.length} registered emergency contacts with your live GPS location and launches the emergency first-aid overlay.
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
            <span>GPS location auto-attached upon trigger</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <PhoneCall size={14} style={{ color: 'var(--color-secondary)' }} />
            <span>{contacts.length} Emergency contact{contacts.length !== 1 ? 's' : ''} on standby</span>
          </div>
        </div>
      </motion.div>

      {/* ── 2-Column Grid: Contacts & First Aid ── */}
      <div className="emergency-grid" style={{ marginTop: 'var(--space-8)' }}>
        <EmergencyContactsManager contacts={contacts} isLoading={contactsLoading} />
        <SeizureFirstAidGuide />
      </div>

      {/* ── SOS Dispatch History Log ── */}
      <div className="glass-card" style={{ marginTop: 'var(--space-8)', padding: 'var(--space-6)' }}>
        <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <History size={18} style={{ color: 'var(--color-primary)' }} />
            <h3>Past SOS Dispatch Log</h3>
          </div>
          <span className="glass-badge">{sosHistory?.total || 0} Total Events</span>
        </div>

        {historyLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : !sosHistory || sosHistory.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No past SOS events recorded. Your alert history is clean.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: 'var(--space-2)' }}>Event ID</th>
                  <th style={{ padding: 'var(--space-2)' }}>Timestamp</th>
                  <th style={{ padding: 'var(--space-2)' }}>Location</th>
                  <th style={{ padding: 'var(--space-2)' }}>Status</th>
                  <th style={{ padding: 'var(--space-2)' }}>Deliveries</th>
                </tr>
              </thead>
              <tbody>
                {sosHistory.items.map((ev) => {
                  const date = new Date(ev.triggered_at);
                  return (
                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-2)', fontWeight: 600 }}>#{ev.id}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)' }}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                        {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                        {ev.location_available && ev.latitude && ev.longitude ? (
                          <span className="glass-badge" style={{ fontSize: '11px' }}>
                            📍 {ev.latitude.toFixed(3)}, {ev.longitude.toFixed(3)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-placeholder)', fontSize: '12px' }}>Unavailable</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                        <span className="glass-badge" style={{
                          fontSize: '11px',
                          color: ev.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--color-warning)',
                        }}>
                          {ev.status}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                        {ev.deliveries && ev.deliveries.length > 0 ? (
                          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                            {ev.deliveries.map((del, idx) => (
                              <span key={idx} style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                {del.delivery_status === 'SENT' || del.delivery_status === 'DELIVERED' ? (
                                  <CheckCircle2 size={12} color="var(--color-success)" />
                                ) : (
                                  <XCircle size={12} color="var(--color-error)" />
                                )}
                                {del.contact_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Dispatched</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
