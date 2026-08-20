import { useState } from 'react';
import { 
  Lightbulb, AlertCircle, ThumbsUp, ThumbsDown, X, ArrowRight
} from 'lucide-react';
import type { RecommendationOut } from '../api';
import { recommendationsApi } from '../api';
import { useToast } from '../../../providers/ToastProvider';
import './RecommendationCard.css';
import { useQuery } from '@tanstack/react-query';

interface RecommendationCardProps {
  recommendation: RecommendationOut;
  onDismiss?: (id: number) => void;
}

export function RecommendationCard({ recommendation, onDismiss }: RecommendationCardProps) {
  const [feedback, setFeedback] = useState<'HELPFUL' | 'NOT_HELPFUL' | null>(
    (recommendation as any).user_feedback || null
  );
  const [showWhy, setShowWhy] = useState(false);
  const toast = useToast();
  const isImportant = recommendation.priority === 'IMPORTANT';

  const { data: whyData } = useQuery({
    queryKey: ['recommendationWhy', recommendation.id],
    queryFn: () => recommendationsApi.getWhyShown(recommendation.id).then((res: any) => res.data),
    enabled: showWhy,
  });

  const handleFeedback = async (type: 'HELPFUL' | 'NOT_HELPFUL') => {
    try {
      await recommendationsApi.submitFeedback(recommendation.id, type);
      setFeedback(type);
      toast.success(type === 'HELPFUL' ? 'Marked as helpful. Thank you!' : 'Feedback recorded.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback.');
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

  return (
    <div className="recommendation-card">
      <div className={`recommendation-priority-indicator ${isImportant ? 'priority-important' : ''}`} />
      
      <div className="recommendation-header">
        <div className="recommendation-title-area">
          <div className={`recommendation-icon ${isImportant ? 'icon-important' : ''}`}>
            {isImportant ? <AlertCircle size={20} /> : <Lightbulb size={20} />}
          </div>
          <div>
            <div className="recommendation-category">{recommendation.category.replace('_', ' ')}</div>
            <h4 className="recommendation-title">{recommendation.title}</h4>
          </div>
        </div>
        <button className="recommendation-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          <X size={18} />
        </button>
      </div>

      <p className="recommendation-body">{recommendation.body}</p>
      
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

      <div className="recommendation-footer">
        <div className="recommendation-feedback">
          <span>Was this helpful?</span>
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
        
        {recommendation.action_url && (
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
