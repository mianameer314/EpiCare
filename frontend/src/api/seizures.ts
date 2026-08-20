import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Seizures API Module — Manual Logs
   Matches FastAPI endpoints in app/api/v1/seizures.py
   ──────────────────────────────────────────────────── */

export interface ManualSeizureLog {
  id: number;
  user_id: number;
  occurred_at: string;
  duration_seconds: number;
  seizure_type: string;
  auras_felt: string[] | null;
  post_ictal_symptoms: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualSeizureLogCreate {
  occurred_at: string;
  duration_seconds: number;
  seizure_type: string;
  auras_felt?: string | string[];
  post_ictal_symptoms?: string | string[];
  notes?: string;
}

export interface PaginatedSeizureLogs {
  items: ManualSeizureLog[];
  total: number;
  skip: number;
  limit: number;
}

export const seizuresApi = {
  getManualLogs: async (params?: { skip?: number; limit?: number }): Promise<ManualSeizureLog[]> => {
    try {
      const sp = new URLSearchParams();
      if (params?.skip !== undefined) sp.set('skip', String(params.skip));
      if (params?.limit !== undefined) sp.set('limit', String(params.limit));
      const qs = sp.toString();
      const res = await apiClient.get<any>(`/seizures/manual${qs ? `?${qs}` : ''}`);
      if (Array.isArray(res)) return res;
      return res?.items || [];
    } catch {
      return [];
    }
  },

  logManualSeizure: (data: ManualSeizureLogCreate, params?: { patient_user_id?: number }) => {
    const sp = new URLSearchParams();
    if (params?.patient_user_id) sp.set('patient_user_id', String(params.patient_user_id));
    const qs = sp.toString();
    
    // Convert arrays to comma-separated strings for the backend
    const payload = {
      ...data,
      auras_felt: Array.isArray(data.auras_felt) ? data.auras_felt.join(', ') : data.auras_felt,
      post_ictal_symptoms: Array.isArray(data.post_ictal_symptoms) ? data.post_ictal_symptoms.join(', ') : data.post_ictal_symptoms
    };
    
    return apiClient.post<ManualSeizureLog>(`/seizures/manual${qs ? `?${qs}` : ''}`, payload);
  },

  deleteManualSeizure: (id: number) =>
    apiClient.delete<void>(`/seizures/manual/${id}`),
};
