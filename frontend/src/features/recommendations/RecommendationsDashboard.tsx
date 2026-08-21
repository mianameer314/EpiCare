import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecommendationOut } from './api';
import { recommendationsApi } from './api';
import { RecommendationCard } from './components/RecommendationCard';
import { Pagination } from '../../components/ui/Pagination';
import { 
  Lightbulb, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  CircleDot, 
  ThumbsUp, 
  ThumbsDown, 
  ArrowRight, 
  Calendar, 
  History, 
  Moon, 
  ShieldAlert, 
  Activity, 
  Pill, 
  BookOpen
} from 'lucide-react';
import { useToast } from '../../providers/ToastProvider';
import './RecommendationsDashboard.css';

export function RecommendationsDashboard() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const toast = useToast();

  const { data: activeRecs, isLoading: activeLoading, refetch: refetchActive } = useQuery({
    queryKey: ['recommendations', 'active'],
    queryFn: () => recommendationsApi.getActive(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: historyRecs, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['recommendations', 'history', historyPage],
    queryFn: () => recommendationsApi.getHistory((historyPage - 1) * 5, 5),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['recommendations', 'stats'],
    queryFn: () => recommendationsApi.getAnalytics(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const handleCardDismiss = () => {
    queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    refetchActive();
    refetchHistory();
    refetchStats();
  };

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      await recommendationsApi.regenerate();
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      refetchActive();
      refetchHistory();
      refetchStats();
      toast.success('Insights refreshed based on your latest lifestyle logs.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate recommendations.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedHistoryId(prev => (prev === id ? null : id));
  };

  const getCategoryClass = (category: string) => {
    const cat = category.toUpperCase();
    if (cat.includes('SLEEP')) return 'category-sleep';
    if (cat.includes('EMERGENCY')) return 'category-emergency';
    if (cat.includes('TRIGGER')) return 'category-trigger';
    if (cat.includes('MED')) return 'category-med';
    return 'category-default';
  };

  const getCategoryIcon = (category: string) => {
    const cat = category.toUpperCase();
    if (cat.includes('SLEEP')) return <Moon size={13} />;
    if (cat.includes('EMERGENCY')) return <ShieldAlert size={13} />;
    if (cat.includes('TRIGGER')) return <Activity size={13} />;
    if (cat.includes('MED')) return <Pill size={13} />;
    return <BookOpen size={13} />;
  };

  const getStatusBadge = (rec: RecommendationOut) => {
    if (rec.priority === 'VICTORY') {
      return (
        <span className="history-status-badge status-resolved">
          <CheckCircle2 size={12} /> Action Completed & Resolved
        </span>
      );
    }
    if (rec.is_active) {
      return (
        <span className="history-status-badge status-active">
          <CircleDot size={12} /> Active In Dashboard
        </span>
      );
    }
    if (rec.is_dismissed) {
      return (
        <span className="history-status-badge status-dismissed">
          <XCircle size={12} /> Dismissed by Patient
        </span>
      );
    }
    return (
      <span className="history-status-badge status-archived">
        <Clock size={12} /> Archived
      </span>
    );
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="insights-dashboard">
      {/* Top Banner Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Active Insights</span>
          <span className="stat-value">{activeRecs ? activeRecs.length : 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Insights</span>
          <span className="stat-value">{stats?.total_generated ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Helpful Feedback</span>
          <span className="stat-value" style={{ color: '#166534' }}>{stats?.total_helpful ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Not Helpful</span>
          <span className="stat-value">{stats?.total_not_helpful ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Insights Dismissed</span>
          <span className="stat-value">{stats?.total_dismissed ?? 0}</span>
        </div>
      </div>

      {/* Active Recommendations Section */}
      <div className="insights-section">
        <div className="section-header-flex">
          <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            <AlertTriangle size={18} />
            Actionable Insights (Active)
          </h3>
          <button 
            className="refresh-btn" 
            onClick={handleRegenerate}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="spin-icon" size={16} /> : null}
            {isGenerating ? 'Analyzing...' : 'Refresh Insights'}
          </button>
        </div>

        {activeLoading ? (
          <div className="loading-state">
            <Loader2 className="spin-icon" size={24} />
            <span>Analyzing recent health logs...</span>
          </div>
        ) : activeRecs && activeRecs.length > 0 ? (
          <div className="insights-grid">
            {activeRecs.map((rec) => (
              <RecommendationCard 
                key={rec.id} 
                recommendation={rec} 
                onDismiss={handleCardDismiss}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Lightbulb size={36} className="empty-icon" />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, color: '#1e3d2b' }}>You're all caught up!</h4>
            <p style={{ margin: 0, maxWidth: '440px', lineHeight: 1.5 }}>No active lifestyle alerts or routine reminders at this time. Keep logging your daily metrics!</p>
          </div>
        )}
      </div>

      {/* Upgraded Industrial-Grade History & Audit Trail */}
      <div className="insights-section">
        <div className="section-header-flex">
          <h3 className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            <History size={18} />
            Insight History & Audit Trail
          </h3>
        </div>

        {historyLoading ? (
          <div className="loading-state">
            <Loader2 className="spin-icon" size={20} />
            <span>Loading history log...</span>
          </div>
        ) : historyRecs && historyRecs.length > 0 ? (
          <div className="insights-history-list">
            {historyRecs.map((rec) => {
              const isExpanded = expandedHistoryId === rec.id;
              const hasEvidence = rec.evidence_tags && rec.evidence_tags.length > 0;
              const cardStatusClass = rec.priority === 'VICTORY' 
                ? 'history-resolved' 
                : rec.is_active 
                ? 'history-active' 
                : rec.is_dismissed 
                ? 'history-dismissed' 
                : '';

              return (
                <div key={rec.id} className={`history-card ${cardStatusClass}`}>
                  <div className="history-card-header">
                    <div className="history-badges-row">
                      <span className={`history-category-pill ${getCategoryClass(rec.category)}`}>
                        {getCategoryIcon(rec.category)}
                        {rec.category.replace('_', ' ')}
                      </span>
                      {getStatusBadge(rec)}
                    </div>
                    <div className="history-date-stamp">
                      <Calendar size={12} />
                      <span>{formatTimestamp(rec.created_at)}</span>
                    </div>
                  </div>

                  <div className="history-card-main">
                    <h4 className="history-card-title">{rec.title}</h4>
                    <p className="history-card-body">{rec.body}</p>
                  </div>

                  <div className="history-card-header" style={{ marginTop: '4px' }}>
                    <div className="history-status-group">
                      {rec.user_feedback === 'HELPFUL' && (
                        <span className="history-feedback-pill feedback-helpful">
                          <ThumbsUp size={11} /> Marked Helpful
                        </span>
                      )}
                      {rec.user_feedback === 'NOT_HELPFUL' && (
                        <span className="history-feedback-pill feedback-unhelpful">
                          <ThumbsDown size={11} /> Marked Not Helpful
                        </span>
                      )}
                      {rec.user_feedback === 'CLICKED_ACTION' && (
                        <span className="history-feedback-pill feedback-action">
                          <ArrowRight size={11} /> Action Opened
                        </span>
                      )}
                      {rec.action_url && (
                        <span style={{ fontSize: '0.72rem', color: '#6b7c72' }}>
                          Target: <code style={{ background: '#eef2ef', padding: '2px 6px', borderRadius: '4px' }}>{rec.action_url}</code>
                        </span>
                      )}
                    </div>

                    {hasEvidence && (
                      <button 
                        className="history-evidence-toggle"
                        onClick={() => toggleExpand(rec.id)}
                      >
                        {isExpanded ? 'Hide Clinical Sources' : 'View Clinical Evidence'}
                      </button>
                    )}
                  </div>

                  {isExpanded && hasEvidence && (
                    <div className="history-evidence-details">
                      <strong style={{ fontSize: '0.75rem', color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Clinical Sources & Guidance:
                      </strong>
                      {rec.evidence_tags?.map((tag: any, idx: number) => (
                        <div key={idx} className="evidence-tag-item">
                          <strong>• {tag.title || 'Guideline Reference'}</strong>
                          {tag.summary && <p>{tag.summary}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="history-pagination-wrapper" style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
              <Pagination
                currentPage={historyPage}
                totalPages={Math.ceil((stats?.total_generated || 1) / 5) || 1}
                onPageChange={(p) => setHistoryPage(p)}
                itemName="insights"
              />
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <History size={28} className="empty-icon" />
            <p style={{ margin: 0 }}>No historical recommendations recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}