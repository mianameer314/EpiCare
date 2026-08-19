import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   EEG API Module — Upload, Session Management & ML Pipeline
   Matches FastAPI endpoints in app/api/v1/eeg.py
   ──────────────────────────────────────────────────── */

export type EegSessionStatus = 
  | 'UPLOADED'
  | 'VALIDATING'
  | 'INVALID'
  | 'PREPROCESSING'
  | 'INFERENCE_RUNNING'
  | 'REPORT_GENERATING'
  | 'COMPLETED'
  | 'FAILED';

export interface EegValidationResult {
  valid: boolean;
  sampling_rate: number | null;
  duration_seconds: number | null;
  channels_found: number | null;
  channels_used: number | null;
  warnings: string[];
}

export interface EegSession {
  id: number;
  user_id: number;
  original_filename: string;
  file_size_bytes: number;
  status: EegSessionStatus;
  validation_result: EegValidationResult | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prediction {
  id: number;
  session_id: number;
  user_id: number;
  model_version: string | null;
  predicted_class: string;
  confidence: number;
  threshold: number;
  positive_windows: number;
  total_windows: number;
  max_probability: number;
  mean_probability: number;
  window_probabilities: number[] | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface PaginatedSessions {
  items: EegSession[];
  total: number;
  skip: number;
  limit: number;
}

export interface PaginatedPredictions {
  items: Prediction[];
  total: number;
  skip: number;
  limit: number;
}

export const eegApi = {
  uploadEEG: (file: File, metadata?: string, params?: { patient_user_id?: number }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', metadata);
    }
    const sp = new URLSearchParams();
    if (params?.patient_user_id) sp.set('patient_user_id', String(params.patient_user_id));
    const qs = sp.toString();
    return apiClient.post<EegSession>(`/eeg/upload${qs ? `?${qs}` : ''}`, formData);
  },

  listSessions: (params?: { skip?: number; limit?: number; status?: string; start_date?: string; end_date?: string; patient_user_id?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.patient_user_id) searchParams.set('patient_user_id', String(params.patient_user_id));

    const qs = searchParams.toString();
    return apiClient.get<PaginatedSessions>(`/eeg/sessions${qs ? `?${qs}` : ''}`);
  },

  getSession: (sessionId: number) =>
    apiClient.get<EegSession>(`/eeg/sessions/${sessionId}`),

  analyzeSession: (sessionId: number) =>
    apiClient.post<Prediction>(`/eeg/sessions/${sessionId}/analyze`),

  getSessionPredictions: (sessionId: number) =>
    apiClient.get<PaginatedPredictions>(`/eeg/sessions/${sessionId}/predictions`),

  getSpectrogramUrl: (sessionId: number) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    return `${base}/eeg/sessions/${sessionId}/spectrogram`;
  },

  getSpectrogramBlob: async (sessionId: number): Promise<string> => {
    const blob = await apiClient.getBlob(`/eeg/sessions/${sessionId}/spectrogram`);
    return URL.createObjectURL(blob);
  },

  deleteSession: (sessionId: number) =>
    apiClient.delete<void>(`/eeg/sessions/${sessionId}`),

  getModelStatus: () =>
    apiClient.get<{ ready: boolean; status: 'LOADED' | 'TRAINING_PENDING'; version: string; message: string }>('/eeg/model-status'),
};
