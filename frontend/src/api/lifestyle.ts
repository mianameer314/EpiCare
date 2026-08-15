import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Lifestyle API Module — Sleep, Triggers, Stress, Diet, Screen Time
   Matches FastAPI endpoints in app/api/v1/lifestyle.py
   ──────────────────────────────────────────────────── */

export interface SleepLog {
  id: number;
  user_id: number;
  slept_at: string;
  woke_at: string;
  duration_minutes: number;
  quality: number | null; // 1-5
  notes: string | null;
  created_at: string;
}

export interface SleepLogCreate {
  slept_at: string;
  woke_at: string;
  quality?: number | null;
  notes?: string | null;
}

export interface TriggerLog {
  id: number;
  user_id: number;
  trigger_name: string;
  severity: number | null; // 1-5
  occurred_at: string;
  notes: string | null;
  created_at: string;
}

export interface TriggerLogCreate {
  trigger_name: string;
  severity?: number | null;
  occurred_at: string;
  notes?: string | null;
}

export interface LifestyleLog {
  id: number;
  user_id: number;
  log_type: string;
  occurred_at: string;
  notes: string | null;
  metadata_dict: Record<string, any> | null;
  created_at: string;
}

export interface PaginatedSleepLogs {
  items: SleepLog[];
  total: number;
  skip: number;
  limit: number;
}

export interface PaginatedTriggerLogs {
  items: TriggerLog[];
  total: number;
  skip: number;
  limit: number;
}

export interface PaginatedLifestyleLogs {
  items: LifestyleLog[];
  total: number;
  skip: number;
  limit: number;
}

export const lifestyleApi = {
  // Sleep
  logSleep: (data: SleepLogCreate, params?: { patient_user_id?: number }) => {
    const sp = new URLSearchParams();
    if (params?.patient_user_id) sp.set('patient_user_id', String(params.patient_user_id));
    const qs = sp.toString();
    return apiClient.post<SleepLog>(`/lifestyle/sleep${qs ? `?${qs}` : ''}`, data);
  },

  getSleepLogs: (params?: { skip?: number; limit?: number; start_date?: string; end_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.skip !== undefined) sp.set('skip', String(params.skip));
    if (params?.limit !== undefined) sp.set('limit', String(params.limit));
    if (params?.start_date) sp.set('start_date', params.start_date);
    if (params?.end_date) sp.set('end_date', params.end_date);
    const qs = sp.toString();
    return apiClient.get<PaginatedSleepLogs>(`/lifestyle/sleep${qs ? `?${qs}` : ''}`);
  },

  deleteSleepLog: (id: number) =>
    apiClient.delete<void>(`/lifestyle/sleep/${id}`),

  // Triggers
  logTrigger: (data: TriggerLogCreate) =>
    apiClient.post<TriggerLog>('/lifestyle/triggers', data),

  getTriggerLogs: (params?: { skip?: number; limit?: number; trigger_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.skip !== undefined) sp.set('skip', String(params.skip));
    if (params?.limit !== undefined) sp.set('limit', String(params.limit));
    if (params?.trigger_type) sp.set('trigger_type', params.trigger_type);
    const qs = sp.toString();
    return apiClient.get<PaginatedTriggerLogs>(`/lifestyle/triggers${qs ? `?${qs}` : ''}`);
  },

  deleteTriggerLog: (id: number) =>
    apiClient.delete<void>(`/lifestyle/triggers/${id}`),

  // Stress
  logStress: (data: { severity: number; occurred_at: string; notes?: string }) =>
    apiClient.post<LifestyleLog>('/lifestyle/stress', data),

  // Diet
  logDiet: (data: { keto_compliant: boolean; alcohol_consumed: boolean; alcohol_units?: number; occurred_at: string; notes?: string }) =>
    apiClient.post<LifestyleLog>('/lifestyle/diet', data),

  // Screen Time
  logScreenTime: (data: { duration_hours: number; night_exposure: boolean; occurred_at: string; notes?: string }) =>
    apiClient.post<LifestyleLog>('/lifestyle/screen-time', data),

  // Menstruation
  logMenstruation: (data: { flow_intensity: string; occurred_at: string; notes?: string }) =>
    apiClient.post<LifestyleLog>('/lifestyle/menstruation', data),

  // Illness
  logIllness: (data: { illness_name: string; had_fever: boolean; peak_temperature?: number; occurred_at: string; notes?: string }) =>
    apiClient.post<LifestyleLog>('/lifestyle/illness', data),

  // Generic lifestyle list
  getGenericLogs: (params?: { skip?: number; limit?: number; log_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.skip !== undefined) sp.set('skip', String(params.skip));
    if (params?.limit !== undefined) sp.set('limit', String(params.limit));
    if (params?.log_type) sp.set('log_type', params.log_type);
    const qs = sp.toString();
    return apiClient.get<PaginatedLifestyleLogs>(`/lifestyle/generic${qs ? `?${qs}` : ''}`);
  },
};
