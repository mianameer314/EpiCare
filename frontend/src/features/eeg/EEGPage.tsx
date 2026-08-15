import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit,
  Upload,
  History,
  Filter,
  Search,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { eegApi } from '../../api/eeg';
import { EEGUploadZone } from './components/EEGUploadZone';
import { EEGSessionCard } from './components/EEGSessionCard';
import { EEGAnalysisDetail } from './components/EEGAnalysisDetail';
import './EEGPage.css';

/* ────────────────────────────────────────────────────
   EEG Diagnostics Page — Upload & Historical Analysis
   ──────────────────────────────────────────────────── */

export function EEGPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const { data: sessionData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['eeg', 'sessions', statusFilter],
    queryFn: () => eegApi.listSessions({ status: statusFilter || undefined, limit: 50 }),
  });

  const { data: modelStatus } = useQuery({
    queryKey: ['eeg', 'model-status'],
    queryFn: eegApi.getModelStatus,
    refetchInterval: 15000,
  });

  const sessions = sessionData?.items || [];
  const filteredSessions = sessions.filter((s) =>
    searchQuery ? s.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['eeg', 'sessions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setActiveTab('history');
  };

  const handleAnalysisComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['eeg', 'sessions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleSessionDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['eeg', 'sessions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return (
    <div className="eeg-page">
      {/* ── Page Header ── */}
      <div className="eeg-header">
        <div className="eeg-header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-primary-50)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BrainCircuit size={24} />
            </div>
            <div>
              <h1>EEG Diagnostics</h1>
              <p>Upload EDF/CSV brainwave recordings and inspect AI seizure classifications.</p>
            </div>
          </div>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="eeg-tab-switcher glass-panel">
          <button
            className={`eeg-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={16} />
            <span>Upload New</span>
          </button>
          <button
            className={`eeg-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>History ({sessions.length})</span>
          </button>
        </div>
      </div>

      {/* ── AI Model Training Notice (Automatically removed once model weights are deployed) ── */}
      <AnimatePresence>
        {!modelStatus?.ready && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
            className="eeg-model-status-card glass-panel"
            style={{
              marginBottom: 'var(--space-6)',
              padding: 'var(--space-4) var(--space-5)',
              borderRadius: 'var(--radius-xl)',
              border: '1.5px solid rgba(45, 90, 63, 0.2)',
              background: 'linear-gradient(135deg, rgba(45, 90, 63, 0.04) 0%, rgba(255, 255, 255, 0.95) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-primary-50)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BrainCircuit size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    AI Diagnostic Engine · Model Training in Progress
                  </span>
                  <span
                    className="glass-badge"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      background: 'var(--color-primary-50)',
                    }}
                  >
                    ⏳ Auto-Detecting Weights (.onnx / .pt)
                  </span>
                </div>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    maxWidth: '740px',
                    lineHeight: 1.5,
                  }}
                >
                  Raw EEG files are validated, preprocessed, and safely stored in the clinical repository. When trained model weights (.onnx / .pt) are placed in the models directory, the system will automatically pick them up.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Upload View ── */}
      {activeTab === 'upload' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <EEGUploadZone onUploadSuccess={handleUploadSuccess} />

          {/* Quick recents below upload */}
          {sessions.length > 0 && (
            <div style={{ marginTop: 'var(--space-8)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>Recent Recordings</h3>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-secondary)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  View all ({sessions.length}) →
                </button>
              </div>

              <div className="eeg-sessions-grid">
                {sessions.slice(0, 3).map((session) => (
                  <EEGSessionCard
                    key={session.id}
                    session={session}
                    onViewResults={setSelectedSessionId}
                    onAnalysisComplete={handleAnalysisComplete}
                    onDeleted={handleSessionDeleted}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── History View ── */}
      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {/* ── Filter Bar ── */}
          <div
            className="eeg-filter-bar glass-card"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-6)',
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                flex: 1,
                minWidth: '200px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-3)',
              }}
            >
              <Search size={16} style={{ color: 'var(--color-text-placeholder)' }} />
              <input
                type="text"
                placeholder="Search recording filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 'var(--space-2) 0',
                  outline: 'none',
                  fontSize: 'var(--text-sm)',
                  width: '100%',
                  color: 'var(--color-text-main)',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Filter size={16} style={{ color: 'var(--color-text-muted)' }} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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
                <option value="">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="UPLOADED">Uploaded</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
              </select>

              <button
                onClick={() => refetch()}
                className="btn btn-outline btn-sm"
                title="Refresh sessions"
                style={{ padding: 'var(--space-2)' }}
              >
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => setActiveTab('upload')}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <PlusCircle size={14} />
                Upload
              </button>
            </div>
          </div>

          {/* ── Sessions List / Grid ── */}
          {isLoading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="glass-card"
                  style={{
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '40%', height: '0.8em' }} />
                  <div
                    className="skeleton"
                    style={{ height: '32px', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)' }}
                  />
                </div>
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <BrainCircuit
                size={48}
                style={{ color: 'var(--color-text-placeholder)', margin: '0 auto var(--space-4)', opacity: 0.4 }}
              />
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>No EEG Recordings Found</h3>
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: 'var(--space-6)',
                }}
              >
                {searchQuery || statusFilter
                  ? 'No recordings match your search filter.'
                  : 'You have not uploaded any EEG recordings yet.'}
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="btn btn-primary btn-md"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
              >
                <Upload size={16} />
                Upload Your First EEG
              </button>
            </div>
          ) : (
            <div className="eeg-sessions-grid">
              {filteredSessions.map((session) => (
                <EEGSessionCard
                  key={session.id}
                  session={session}
                  onViewResults={setSelectedSessionId}
                  onAnalysisComplete={handleAnalysisComplete}
                  onDeleted={handleSessionDeleted}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Analysis Modal ── */}
      <AnimatePresence>
        {selectedSessionId !== null && (
          <EEGAnalysisDetail sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
