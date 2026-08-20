import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Users & Profiles API Module
   Matches FastAPI endpoints in app/api/v1/users.py
   ──────────────────────────────────────────────────── */

export interface PatientProfileData {
  id?: number;
  user_id?: number;
  date_of_birth?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say' | null;
  blood_type?: string | null;
  city?: string | null;
  primary_diagnosis?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_relation?: string | null;
  emergency_contact_phone?: string | null;
  known_triggers?: string[] | null;
  notes?: string | null;
  timezone?: string | null;
}

export interface DoctorProfileData {
  id?: number;
  user_id?: number;
  pmdc_number?: string | null;
  specialty?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say' | null;
  hospital_affiliation?: string | null;
  license_image_url?: string | null;
  pmdc_certificate_path?: string | null;
  pmdc_certificate_name?: string | null;
  pmdc_certificate_mime_type?: string | null;
  pmdc_certificate_size?: number | null;
  profile_photo_path?: string | null;
  profile_photo_mime_type?: string | null;
  years_of_experience?: number | null;
  consultation_fee?: string | number | null;
  available_days?: string[] | null;
  available_day_start?: string | null;
  available_day_end?: string | null;
  available_times?: string[] | null;
  available_time_start?: string | null;
  available_time_end?: string | null;
  languages_spoken?: string[] | null;
  bio?: string | null;
  consultation_types?: string[] | null;
  is_pmdc_verified?: boolean;
}

export interface CaretakerProfileData {
  id?: number;
  user_id?: number;
  relationship_to_patient?: string | null;
  crisis_phone_number?: string | null;
}

export const usersApi = {
  // Patient Profile
  getPatientProfile: () =>
    apiClient.get<PatientProfileData>('/users/me/patient-profile'),

  updatePatientProfile: (data: PatientProfileData) =>
    apiClient.put<PatientProfileData>('/users/me/patient-profile', data),

  // Doctor Profile
  getDoctorProfile: () =>
    apiClient.get<DoctorProfileData>('/users/me/doctor-profile'),

  updateDoctorProfile: (data: Partial<DoctorProfileData>) =>
    apiClient.put<DoctorProfileData>('/users/me/doctor-profile', data),

  uploadDoctorCertificate: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<DoctorProfileData>('/users/me/doctor-profile/pmdc-certificate', form);
  },

  uploadDoctorPhoto: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<DoctorProfileData>('/users/me/doctor-profile/photo', form);
  },

  removeDoctorCertificate: () =>
    apiClient.delete<void>('/users/me/doctor-profile/pmdc-certificate'),

  removeDoctorPhoto: () =>
    apiClient.delete<void>('/users/me/doctor-profile/photo'),

  // Caretaker Profile
  getCaretakerProfile: () =>
    apiClient.get<CaretakerProfileData>('/users/me/caretaker-profile'),

  updateCaretakerProfile: (data: CaretakerProfileData) =>
    apiClient.put<CaretakerProfileData>('/users/me/caretaker-profile', data),
};
