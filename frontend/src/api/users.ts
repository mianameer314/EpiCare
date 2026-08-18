import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Users & Profiles API Module
   Matches FastAPI endpoints in app/api/v1/users.py
   ──────────────────────────────────────────────────── */

export interface PatientProfileData {
  id?: number;
  user_id?: number;
  date_of_birth?: string;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  blood_type?: string;
  city?: string;
  primary_diagnosis?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  known_triggers?: string[];
  notes?: string;
  timezone?: string;
}

export interface DoctorProfileData {
  id?: number;
  user_id?: number;
  pmdc_number?: string;
  specialty?: string;
  hospital_affiliation?: string;
  license_image_url?: string;
  pmdc_certificate_path?: string;
  pmdc_certificate_name?: string;
  pmdc_certificate_mime_type?: string;
  pmdc_certificate_size?: number;
  profile_photo_path?: string;
  profile_photo_mime_type?: string;
  years_of_experience?: number;
  consultation_fee?: string | number;
  available_days?: string[];
  available_day_start?: string;
  available_day_end?: string;
  available_times?: string[];
  available_time_start?: string;
  available_time_end?: string;
  languages_spoken?: string[];
  bio?: string;
  consultation_types?: string[];
  is_pmdc_verified?: boolean;
}

export interface CaretakerProfileData {
  id?: number;
  user_id?: number;
  relationship_to_patient?: string;
  crisis_phone_number?: string;
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
