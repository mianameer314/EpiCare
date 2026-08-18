import { apiClient } from './client';
import type { User } from '../types/auth';

/* ────────────────────────────────────────────────────
   Admin API Module — Metrics, User Management & Doctor PMDC Verification
   Matches FastAPI endpoints in app/api/v1/admin.py
   ──────────────────────────────────────────────────── */

export interface AdminMetrics {
  total_users: number;
  total_patients: number;
  total_doctors: number;
  total_caretakers: number;
  total_admins: number;
  pending_doctors: number;
  total_seizures_logged: number;
  total_medications_logged: number;
  total_lifestyle_logs: number;
  total_eegs_processed: number;
}

export interface DoctorProfile {
  id: number;
  user_id: number;
  pmdc_number: string;
  specialty: string;
  hospital_affiliation: string | null;
  pmdc_certificate_path?: string | null;
  pmdc_certificate_name?: string | null;
  is_pmdc_verified: boolean;
  user?: User;
}

export interface PaginatedUsers {
  items: User[];
  total: number;
  skip: number;
  limit: number;
}

export interface PaginatedDoctors {
  items: DoctorProfile[];
  total: number;
  skip: number;
  limit: number;
}

export const adminApi = {
  getMetrics: () =>
    apiClient.get<AdminMetrics>('/admin/dashboard/metrics'),

  listUsers: (params?: { skip?: number; limit?: number; role?: string }) => {
    const sp = new URLSearchParams();
    if (params?.skip !== undefined) sp.set('skip', String(params.skip));
    if (params?.limit !== undefined) sp.set('limit', String(params.limit));
    if (params?.role) sp.set('role', params.role);
    const qs = sp.toString();
    return apiClient.get<PaginatedUsers>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  updateUserStatus: (userId: number, isActive: boolean) =>
    apiClient.patch<User>(`/admin/users/${userId}/status`, { is_active: isActive }),

  getPendingDoctors: (params?: { skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.skip !== undefined) sp.set('skip', String(params.skip));
    if (params?.limit !== undefined) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return apiClient.get<PaginatedDoctors>(`/admin/doctors/pending${qs ? `?${qs}` : ''}`);
  },

  verifyDoctor: (userId: number, isVerified: boolean) =>
    apiClient.patch<DoctorProfile>(`/admin/doctors/${userId}/verify`, { is_verified: isVerified }),

  viewDoctorCertificate: (userId: number) =>
    apiClient.getBlob(`/admin/doctors/${userId}/pmdc-certificate`),
};
