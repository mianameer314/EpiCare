import { apiClient } from '../../api/client';

export interface RecommendationOut {
  id: number;
  category: string;
  title: string;
  body: string;
  rationale?: string;
  action_url?: string;
  priority: 'IMPORTANT' | 'INFORMATIONAL' | 'VICTORY';
  source: string;
  is_active: boolean;
  is_dismissed: boolean;
  evidence_tags?: any[];
  created_at: string;
  user_feedback?: 'HELPFUL' | 'NOT_HELPFUL' | 'CLICKED_ACTION' | null;
}

export interface RecommendationWhyOut {
  rule_id: string;
  rule_version: string;
  condition_description: string;
  feature_values_used: Record<string, any>;
  generated_at: string;
}

export interface RecommendationStatsOut {
  total_generated: number;
  total_read: number;
  total_dismissed: number;
  total_helpful: number;
  total_not_helpful: number;
  categories: Record<string, number>;
}

export const recommendationsApi = {
  getActive: () => apiClient.get<RecommendationOut[]>('/recommendations/'),
  
  getHistory: (skip = 0, limit = 20) => 
    apiClient.get<RecommendationOut[]>(`/recommendations/history?skip=${skip}&limit=${limit}`),
    
  regenerate: () => apiClient.post<RecommendationOut[]>('/recommendations/regenerate', undefined),
  
  markAsRead: (id: number) => apiClient.patch(`/recommendations/${id}/read`, undefined),
  
  dismiss: (id: number) => apiClient.patch(`/recommendations/${id}/dismiss`, undefined),
  
  submitFeedback: (id: number, event_type: string, feedback_text?: string) => 
    apiClient.post(`/recommendations/${id}/feedback`, { event_type, feedback_text }),
    
  getWhyShown: (id: number) => apiClient.get<RecommendationWhyOut>(`/recommendations/${id}/why-this-was-shown`),
  
  getAnalytics: () => apiClient.get<RecommendationStatsOut>('/recommendations/stats/analytics'),
};
