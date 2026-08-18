export interface User {
  id: number;
  email: string;
  phone_number: string | null;
  full_name: string;
  profile_photo_path?: string | null;
  profile_photo_mime_type?: string | null;
  role: 'PATIENT' | 'DOCTOR' | 'CARETAKER' | 'ADMIN';
  is_active: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  phone_number: string;
  full_name: string;
  role: 'PATIENT' | 'DOCTOR' | 'CARETAKER';
  pmdc_number?: string | null;
}
