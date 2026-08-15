import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Medications API Module — Prescriptions, Schedules & Compliance
   Matches FastAPI endpoints in app/api/v1/medications.py
   ──────────────────────────────────────────────────── */

export interface Medication {
  id: number;
  user_id: number;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  dosage: string;
  frequency: string;
  intake_timing: string | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  prescribed_by_doctor_id: number | null;
  prescribed_by_name: string | null;
  prescribed_by_pmdc: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationCreate {
  name: string;
  generic_name?: string | null;
  brand_name?: string | null;
  dosage: string;
  frequency: string;
  intake_timing?: string | null;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
  prescribed_by_doctor_id?: number | null;
  is_active?: boolean;
}

export interface MedicationSchedule {
  id: number;
  medication_id: number;
  scheduled_time: string; // "08:00:00"
  days_of_week: number[] | null;
  reminder_enabled: boolean;
}

export interface MedicationScheduleCreate {
  scheduled_time: string;
  days_of_week?: number[] | null;
  reminder_enabled?: boolean;
}

export interface MedicationLog {
  id: number;
  medication_id: number;
  medication_name?: string | null;
  taken_at: string;
  status: 'TAKEN' | 'MISSED' | 'SKIPPED' | 'DELAYED';
  dose_taken?: string | null;
  notes: string | null;
}

export interface TodayScheduleSlot {
  slot_id: string;
  medication_id: number;
  medication_name: string;
  generic_name: string | null;
  dosage: string;
  frequency: string;
  intake_timing: string | null;
  time_window: string; // "Morning" | "Afternoon" | "Night"
  scheduled_time_display: string; // "08:00 AM"
  status: 'TAKEN' | 'PENDING' | 'MISSED';
  logged_at: string | null;
  prescribed_by_name: string | null;
}

export interface AdherenceStats {
  adherence_7d_percent: float;
  adherence_30d_percent: float;
  taken_7d: number;
  missed_7d: number;
  total_7d: number;
  active_prescriptions_count: number;
  status_level: 'OPTIMAL' | 'GOOD' | 'AT_RISK';
  next_reminder_time: string | null;
}

type float = number;

export interface PaginatedMedications {
  items: Medication[];
  total: number;
  skip: number;
  limit: number;
}

export interface PaginatedMedicationLogs {
  items: MedicationLog[];
  total: number;
  skip: number;
  limit: number;
}

export const medicationsApi = {
  getMedications: (params?: { is_active?: boolean; search?: string; skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.is_active !== undefined) sp.set('is_active', String(params.is_active));
    if (params?.search) sp.set('search', params.search);
    if (params?.skip !== undefined) sp.set('skip', String(params.skip));
    if (params?.limit !== undefined) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return apiClient.get<PaginatedMedications>(`/medications${qs ? `?${qs}` : ''}`);
  },

  getDailySchedule: () =>
    apiClient.get<TodayScheduleSlot[]>('/medications/daily-schedule'),

  getAdherenceStats: () =>
    apiClient.get<AdherenceStats>('/medications/adherence-stats'),

  createMedication: (data: MedicationCreate, params?: { patient_user_id?: number }) => {
    const sp = new URLSearchParams();
    if (params?.patient_user_id) sp.set('patient_user_id', String(params.patient_user_id));
    const qs = sp.toString();
    return apiClient.post<Medication>(`/medications${qs ? `?${qs}` : ''}`, data);
  },

  updateMedication: (id: number, data: Partial<MedicationCreate>) =>
    apiClient.put<Medication>(`/medications/${id}`, data),

  deleteMedication: (id: number) =>
    apiClient.delete<void>(`/medications/${id}`),

  getSchedules: (medId: number) =>
    apiClient.get<PaginatedMedications>(`/medications/${medId}/schedules`),

  createSchedule: (medId: number, data: MedicationScheduleCreate) =>
    apiClient.post<MedicationSchedule>(`/medications/${medId}/schedules`, data),

  logMedicationDose: (medId: number, data: { status: 'TAKEN' | 'MISSED' | 'SKIPPED'; dose_taken?: string; notes?: string }) =>
    apiClient.post<MedicationLog>(`/medications/${medId}/log`, data),

  getLogs: (params?: { skip?: number; limit?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.skip !== undefined) sp.set('skip', String(params.skip));
    if (params?.limit !== undefined) sp.set('limit', String(params.limit));
    if (params?.status) sp.set('status', params.status);
    const qs = sp.toString();
    return apiClient.get<PaginatedMedicationLogs>(`/medications/logs${qs ? `?${qs}` : ''}`);
  },
};
