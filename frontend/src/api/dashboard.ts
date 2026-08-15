import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Dashboard API — Patient Analytics & EEG Sessions
   Matches FastAPI backend schema from app/api/v1/dashboard.py
   ──────────────────────────────────────────────────── */

export interface DashboardStats {
  total_seizures_past_30_days: number;
  total_seizures_all_time: number;
  days_since_last_seizure: number | null;
  most_common_seizure_types: string[];
  recent_auras: string[];
  medication_adherence_percent: number;
  medications_taken: number;
  medications_missed: number;
  medication_streak: number;
  avg_sleep_hours: number;
  avg_stress_level: number | null;
  most_frequent_triggers: string[];
  recommendations: string[];
}

export interface EegSession {
  id: number;
  original_filename: string;
  status: string;
  file_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedSessions {
  items: EegSession[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export const dashboardApi = {
  getStats: (params?: { patient_user_id?: number }) => {
    const sp = new URLSearchParams();
    if (params?.patient_user_id) sp.set('patient_user_id', String(params.patient_user_id));
    const qs = sp.toString();
    return apiClient.get<DashboardStats>(`/dashboard${qs ? `?${qs}` : ''}`);
  },

  getRecentSessions: async (page = 1, perPage = 5): Promise<PaginatedSessions> => {
    try {
      const res = await apiClient.get<any>(`/eeg/sessions?page=${page}&per_page=${perPage}`);
      if (Array.isArray(res)) {
        return { items: res, total: res.length, page: 1, per_page: perPage, total_pages: 1 };
      }
      return {
        items: res?.items || [],
        total: res?.total || 0,
        page: res?.page || 1,
        per_page: res?.per_page || perPage,
        total_pages: res?.total_pages || 1,
      };
    } catch {
      return { items: [], total: 0, page: 1, per_page: perPage, total_pages: 0 };
    }
  },
};
