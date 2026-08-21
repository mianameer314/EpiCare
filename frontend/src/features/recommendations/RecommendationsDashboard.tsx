import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const toast = useToast();

  const { data: activeRecs, isLoading: activeLoading, refetch: refetchActive } = useQuery({
    queryKey: ['recommendations', 'active'],
    queryFn: () => recommendationsApi.getActive(),
  });

  const { data: historyRecs, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['recommendations', 'history', historyPage],
    queryFn: () => recommendationsApi.getHistory((historyPage - 1) * 5, 5),
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['recommendations', 'stats'],
    queryFn: () => recommendationsApi.getAnalytics(),
  });

  const handleCardDismiss = () => {
    refetchActive();
    refetchHistory();
    refetchStats();
  };

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      await recommendationsApi.regenerate();
      refetchActive();
      refetchHistory();
      refetchStats();
      toast.success('Clinical recommendations updated with latest health data.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to analyze recent health data.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${datePart} • ${timePart}`;
    } catch {
      return dateStr;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = category.toUpperCase();
    if (cat.includes('SLEEP')) return <Moon size={13} />;
    if (cat.includes('EMERGENCY')) return <ShieldAlert size={13} />;
    if (cat.includes('TRIGGER')) return <Activity size={13} />;
    if (cat.includes('MED')) return <Pill size={13} />;
    return <Lightbulb size={13} />;
  };

  const getCategoryClass = (category: string) => {
    const cat = category.toUpperCase();
    if (cat.includes('SLEEP')) return 'category-sleep';
    if (cat.includes('EMERGENCY')) return 'category-emergency';
    if (cat.includes('TRIGGER')) return 'category-trigger';
    if (cat.includes('MED')) return 'category-med';
    return 'category-default';
  };

  return (
    <div className="insights-dashboard">
      <header className="insights-header">
        <div>
          <h1 className="insights-title">Personalized Care Insights</h1>
          <p className="insights-subtitle">
            Continuous health intelligence & clinical safety protocols tailored to your epilepsy care journey.
          </p>
        </div>
        <button onClick={handleRegenerate} className="refresh-btn" disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 size={18} className="spin-icon" /> Analyzing Data...
            </>
          ) : (
            'Analyze Recent Data'
          )}
        </button>
      </header>

      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Active Insights</span>
            <span className="stat-value">{activeRecs?.length || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Insights</span>
            <span className="stat-value">{stats.total_generated}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Helpful Feedback</span>
            <span className="stat-value">{stats.total_helpful}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Not Helpful</span>
            <span className="stat-value">{stats.total_not_helpful}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Insights Dismissed</span>
            <span className="stat-value">{stats.total_dismissed}</span>
          </div>
        </div>
      )}

      <section className="insights-section">
        <h2 className="section-title">
          <AlertTriangle size={20} /> Actionable Insights (Active)
        </h2>
        {activeLoading ? (
          <div className="loading-state">
            <Loader2 size={24} className="spin-icon" /> Loading active clinical insights...
          </div>
        ) : activeRecs && activeRecs.length > 0 ? (
          <div className="insights-grid">
            {activeRecs.map((rec: RecommendationOut) => (
              <RecommendationCard 
                key={rec.id} 
                recommendation={rec} 
                onDismiss={handleCardDismiss}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Lightbulb size={48} className="empty-icon" />
            <h3>You are completely up to date!</h3>
            <p>No urgent recommendations or pending health actions required right now. Keep logging your daily logs and check back soon.</p>
          </div>
        )}
      </section>

      <section className="insights-section">
        <div className="section-header-flex">
          <h2 className="section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <History size={20} /> Insight History & Audit Trail
          </h2>
          <span className="history-count-badge">
            Page {historyPage}
          </span>
        </div>

        {historyLoading ? (
          <div className="loading-state">
            <Loader2 size={24} className="spin-icon" /> Loading historical insight log...
          </div>
        ) : historyRecs && historyRecs.length > 0 ? (
          <>
            <div className="insights-history-list">
              {historyRecs.map((rec: RecommendationOut) => {
                const isResolved = rec.priority === 'VICTORY' || rec.title.toLowerCase().includes('resolved');
                const isExpanded = expandedHistoryId === rec.id;

                return (
                  <div 
                    key={rec.id} 
                    className={`history-card ${isResolved ? 'history-resolved' : rec.is_active ? 'history-active' : rec.is_dismissed ? 'history-dismissed' : ''}`}
                  >
                    <div className="history-card-header">
                      <div className="history-badges-row">
                        <span className={`history-category-pill ${getCategoryClass(rec.category)}`}>
                          {getCategoryIcon(rec.category)}
                          {rec.category.replace('_', ' ')}
                        </span>

                        <div className="history-status-group">
                          {isResolved ? (
                            <span className="history-status-badge status-resolved">
                              <CheckCircle2 size={13} /> Action Completed & Resolved
                            </span>
                          ) : rec.is_active ? (
                            <span className="history-status-badge status-active">
                              <CircleDot size={13} /> Active In Dashboard
                            </span>
                          ) : rec.is_dismissed ? (
                            <span className="history-status-badge status-dismissed">
                              <XCircle size={13} /> Dismissed by Patient
                            </span>
                          ) : (
                            <span className="history-status-badge status-archived">
                              <Clock size={13} /> Archived
                            </span>
                          )}

                          {rec.user_feedback === 'HELPFUL' && (
                            <span className="history-feedback-pill feedback-helpful">
                              <ThumbsUp size={12} /> Marked Helpful
                            </span>
                          )}
                          {rec.user_feedback === 'NOT_HELPFUL' && (
                            <span className="history-feedback-pill feedback-unhelpful">
                              <ThumbsDown size={12} /> Marked Not Helpful
                            </span>
                          )}
                          {rec.user_feedback === 'CLICKED_ACTION' && (
                            <span className="history-feedback-pill feedback-action">
                              <ArrowRight size={12} /> Action Opened
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="history-date-stamp">
                        <Calendar size={13} />
                        <span>{formatDateTime(rec.created_at)}</span>
                      </div>
                    </div>

                    <div className="history-card-main">
                      <h4 className="history-card-title">{rec.title}</h4>
                      <p className="history-card-body">{rec.body}</p>
                    </div>

                    {rec.evidence_tags && rec.evidence_tags.length > 0 && (
                      <div className="history-card-evidence">
                        <button 
                          className="history-evidence-toggle"
                          onClick={() => setExpandedHistoryId(isExpanded ? null : rec.id)}
                        >
                          <BookOpen size={13} />
                          {isExpanded ? 'Hide Clinical Context' : `View Clinical Context (${rec.evidence_tags.length} sources)`}
                        </button>

                        {isExpanded && (
                          <div className="history-evidence-details">
                            {rec.evidence_tags.map((tag, i) => (
                              <div key={i} className="evidence-tag-item">
                                <strong>{tag.title}</strong>
                                {tag.content && <p>{tag.content}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Pagination
                currentPage={historyPage}
                totalPages={historyPage + (historyRecs.length < 5 ? 0 : 1)}
                pageSize={5}
                itemName="insights"
                onPageChange={setHistoryPage}
              />
            </div>
          </>
        ) : (
          <div className="empty-state">
            <History size={40} className="empty-icon" />
            <h3>No Previous Insights Recorded</h3>
            <p>Historical recommendations, resolved clinical actions, and feedback logs will appear here.</p>
            {historyPage > 1 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <button className="btn btn-secondary" onClick={() => setHistoryPage(1)}>Return to First Page</button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
