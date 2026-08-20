import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RecommendationOut } from './api';
import { recommendationsApi } from './api';
import { RecommendationCard } from './components/RecommendationCard';
import { Pagination } from '../../components/ui/Pagination';
import { Lightbulb, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '../../providers/ToastProvider';
import './RecommendationsDashboard.css';

export function RecommendationsDashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const toast = useToast();

  const { data: activeRecs, isLoading: activeLoading, refetch } = useQuery({
    queryKey: ['recommendations', 'active'],
    queryFn: () => recommendationsApi.getActive(),
  });

  const { data: historyRecs, isLoading: historyLoading } = useQuery({
    queryKey: ['recommendations', 'history', historyPage],
    queryFn: () => recommendationsApi.getHistory((historyPage - 1) * 5, 5),
  });

  const { data: stats } = useQuery({
    queryKey: ['recommendations', 'stats'],
    queryFn: () => recommendationsApi.getAnalytics(),
  });

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      await recommendationsApi.regenerate();
      refetch();
      toast.success('Clinical recommendations updated with latest health data.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to analyze recent health data.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="insights-dashboard">
      <header className="insights-header">
        <div>
          <h1 className="insights-title">Personalized Care Insights</h1>
          <p className="insights-subtitle">
            Personalized guidance based on your continuous health tracking and clinical protocols.
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
          <div>Loading your insights...</div>
        ) : activeRecs && activeRecs.length > 0 ? (
          <div className="insights-grid">
            {activeRecs.map((rec: RecommendationOut) => (
              <RecommendationCard 
                key={rec.id} 
                recommendation={rec} 
                onDismiss={() => refetch()}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Lightbulb size={48} className="empty-icon" />
            <h3>You are up to date!</h3>
            <p>We don't have any new active recommendations for you right now. Keep logging your daily activities!</p>
          </div>
        )}
      </section>

      <section className="insights-section">
        <h2 className="section-title">
          <Info size={20} /> Previous Insights (History)
        </h2>
        {historyLoading ? (
          <div>Loading history...</div>
        ) : historyRecs && historyRecs.length > 0 ? (
          <>
            <div className="insights-history-list">
              {historyRecs.map((rec: RecommendationOut) => (
                <div key={rec.id} className="history-item">
                  <div className="history-date">{new Date(rec.created_at).toLocaleDateString()}</div>
                  <div className="history-content">
                    <strong>{rec.title}</strong>
                    <span>{rec.category.replace('_', ' ')}</span>
                  </div>
                  <div className="history-status">
                    {rec.is_active ? 'Active' : rec.is_dismissed ? 'Dismissed' : 'Expired'}
                  </div>
                </div>
              ))}
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
          <div className="empty-state">No history found on this page.
             {historyPage > 1 && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <button className="btn btn-secondary" onClick={() => setHistoryPage(1)}>Go back to start</button>
                </div>
             )}
          </div>
        )}
      </section>
    </div>
  );
}
