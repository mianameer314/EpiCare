import { useState } from 'react';
import { 
  Lightbulb, 
  AlertCircle, 
  CheckCircle2, 
  ThumbsUp, 
  ThumbsDown, 
  X, 
  ArrowRight,
  Moon,
  Activity,
  ShieldAlert,
  Pill
} from 'lucide-react';
import type { RecommendationOut } from '../api';
import { recommendationsApi } from '../api';
import { useToast } from '../../../providers/ToastProvider';
import './RecommendationCard.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface RecommendationCardProps {
  recommendation: RecommendationOut;
  onDismiss?: (id: number) => void;
}

export function RecommendationCard({ recommendation, onDismiss }: RecommendationCardProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<'HELPFUL' | 'NOT_HELPFUL' | 'CLICKED_ACTION' | null>(
    (recommendation as any).user_feedback || null
  );
  const [showWhy, setShowWhy] = useState(false);
  const toast = useToast();
  const isImportant = recommendation.priority === 'IMPORTANT';
  const isVictoryLap = recommendation.priority === 'VICTORY';
  const hasAction = !isVictoryLap && Boolean(recommendation.action_url);

  const { data: whyData } = useQuery({
    queryKey: ['recommendationWhy', recommendation.id],
    queryFn: () => recommendationsApi.getWhyShown(recommendation.id).then((res: any) => res.data),
    enabled: showWhy,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (type: 'HELPFUL' | 'NOT_HELPFUL') => {
    if (isSubmitting) return;
    
    const isRemoving = feedback === type;
    const finalType = isRemoving ? 'REMOVE' : type;

    setIsSubmitting(true);
    try {
      await recommendationsApi.submitFeedback(recommendation.id, finalType);
      setFeedback(isRemoving ? null : type);
      
      if (isRemoving) {
        toast.success('Feedback removed.');
      } else {
        toast.success('Thanks for your feedback!');
        if ((type === 'NOT_HELPFUL' || isVictoryLap) && onDismiss) {
          onDismiss(recommendation.id);
        }
      }
      
      // Auto-invalidate all recommendations queries instantly
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await recommendationsApi.dismiss(recommendation.id);
      if (onDismiss) onDismiss(recommendation.id);
      toast.info('Insight dismissed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss.');
    }
  };

  const handleActionClick = () => {
    recommendationsApi.submitFeedback(recommendation.id, 'CLICKED_ACTION').catch(console.error);
  };

  const renderMetricPill = () => {
    if (isVictoryLap) {
      return (
        <div className="card-metric-container victory-metric-container">
          <div className="metric-header-row">
            <span className="metric-label"><CheckCircle2 size={13} /> Resolution Status</span>
            <span className="metric-chip victory-chip">Target Achieved ✓</span>
          </div>
        </div>
      );
    }

    const cat = recommendation.category.toUpperCase();

    if (cat.includes('SLEEP')) {
      const avgMatch = recommendation.title.match(/(\d+\.?\d*)h/) || recommendation.body.match(/average was (\d+\.?\d*) hours/);
      const lastNightMatch = recommendation.body.match(/last night: (\d+\.?\d*)h/);
      const currentHours = avgMatch ? parseFloat(avgMatch[1]) : null;
      const lastNight = lastNightMatch ? parseFloat(lastNightMatch[1]) : null;
      const percent = currentHours ? Math.min(100, Math.round((currentHours / 7.0) * 100)) : null;

      return (
        <div className="card-metric-container sleep-metric-container">
          <div className="metric-header-row">
            <span className="metric-label"><Moon size={13} /> 7-Day Sleep Trend</span>
            {currentHours !== null ? (
              <span className="metric-value-highlight">
                {currentHours}h <span className="metric-target">/ 7.0h target</span>
              </span>
            ) : (
              <span className="metric-chip sleep-chip">Below 7.0h</span>
            )}
          </div>
          {percent !== null && (
            <div className="metric-progress-bar-track" title={`${percent}% of 7.0h target`}>
              <div 
                className="metric-progress-bar-fill sleep-fill" 
                style={{ width: `${percent}%` }} 
              />
            </div>
          )}
          {lastNight !== null && (
            <div className="metric-sub-detail">
              <span>Last Logged Night: <strong>{lastNight}h</strong></span>
              <span className={lastNight >= 7.0 ? 'metric-status-good' : 'metric-status-warn'}>
                {lastNight >= 7.0 ? '✓ Reached Target' : '⚠ Below Target'}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (cat.includes('TRIGGER')) {
      const triggerMatch = recommendation.title.match(/Frequent Trigger: '([^']+)'/) || recommendation.body.match(/recorded '([^']+)'/);
      const triggerName = triggerMatch ? triggerMatch[1] : null;

      return (
        <div className="card-metric-container trigger-metric-container">
          <div className="metric-header-row">
            <span className="metric-label"><Activity size={13} /> Pattern Frequency</span>
            <span className="metric-chip trigger-chip">High Frequency</span>
          </div>
          {triggerName && (
            <div className="metric-sub-detail">
              <span>Primary Trigger: <strong>{triggerName}</strong></span>
              <span className="metric-status-warn">≥ 3 logs this week</span>
            </div>
          )}
        </div>
      );
    }

    if (cat.includes('MED')) {
      const medMatch = recommendation.title.match(/(\d+)%/);
      const percent = medMatch ? parseInt(medMatch[1], 10) : null;

      return (
        <div className="card-metric-container med-metric-container">
          <div className="metric-header-row">
            <span className="metric-label"><Pill size={13} /> 7-Day Adherence</span>
            {percent !== null && (
              <span className="metric-value-highlight">
                {percent}% <span className="metric-target">/ 80% min</span>
              </span>
            )}
          </div>
          {percent !== null && (
            <div className="metric-progress-bar-track">
              <div 
                className="metric-progress-bar-fill med-fill" 
                style={{ width: `${Math.min(100, percent)}%` }} 
              />
            </div>
          )}
        </div>
      );
    }

    if (cat.includes('EMERGENCY')) {
      return (
        <div className="card-metric-container emergency-metric-container">
          <div className="metric-header-row">
            <span className="metric-label"><ShieldAlert size={13} /> Emergency Safety Plan</span>
            <span className="metric-chip emergency-chip">0 Contacts</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`recommendation-card ${isVictoryLap ? 'victory-lap' : ''}`}>
      <div className={`recommendation-priority-indicator ${isImportant ? 'priority-important' : ''} ${isVictoryLap ? 'priority-victory' : ''}`} />
      
      <div className="recommendation-header">
        <div className="recommendation-title-area">
          <div className={`recommendation-icon ${isImportant ? 'icon-important' : ''} ${isVictoryLap ? 'icon-victory' : ''}`}>
            {isVictoryLap ? <CheckCircle2 size={20} /> : isImportant ? <AlertCircle size={20} /> : <Lightbulb size={20} />}
          </div>
          <div>
            <div className="recommendation-category">{recommendation.category.replace('_', ' ')}</div>
            <h4 className="recommendation-title">{recommendation.title}</h4>
          </div>
        </div>
        {!isVictoryLap && (
          <button className="recommendation-dismiss" onClick={handleDismiss} aria-label="Dismiss">
            <X size={18} />
          </button>
        )}
      </div>

      <p className="recommendation-body">{recommendation.body}</p>

      {renderMetricPill()}
      
      {recommendation.evidence_tags && recommendation.evidence_tags.length > 0 && (
        <div className="recommendation-why">
          <strong>Related Clinical Context:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {recommendation.evidence_tags.map((tag, i) => (
              <li key={i}>{tag.title}</li>
            ))}
          </ul>
        </div>
      )}

      {showWhy && (
        <div className="recommendation-why">
          {whyData ? (
            <>
              <strong>Why you are seeing this:</strong> {whyData.condition_description}
            </>
          ) : (
            'Loading details...'
          )}
        </div>
      )}

      {!showWhy && (
        <button className="why-toggle" onClick={() => setShowWhy(true)}>
          Why am I seeing this?
        </button>
      )}

      <div className={`recommendation-footer ${hasAction ? 'footer-action-only' : ''}`}>
        {!hasAction && (
          <div className="recommendation-feedback">
            <span>{isVictoryLap ? 'Was this reminder helpful?' : 'Was this helpful?'}</span>
            <button 
              className={`feedback-btn ${feedback === 'HELPFUL' ? 'active-helpful' : ''}`}
              onClick={() => handleFeedback('HELPFUL')}
              title="Yes"
            >
              <ThumbsUp size={14} />
            </button>
            <button 
              className={`feedback-btn ${feedback === 'NOT_HELPFUL' ? 'active-unhelpful' : ''}`}
              onClick={() => handleFeedback('NOT_HELPFUL')}
              title="No"
            >
              <ThumbsDown size={14} />
            </button>
          </div>
        )}
        
        {hasAction && (
          <a 
            href={recommendation.action_url} 
            className="action-link"
            onClick={handleActionClick}
          >
            Take Action <ArrowRight size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
