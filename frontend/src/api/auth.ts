import { apiClient } from './client';
import type { LoginPayload, RegisterPayload, User } from '../types/auth';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const authApi = {
  login: (data: LoginPayload) => 
    apiClient.post<TokenResponse>('/auth/login', data),
    
  register: (data: RegisterPayload) => 
    apiClient.post<User>('/auth/register', data),
    
  verifyEmail: (data: { email: string; otp: string }) =>
    apiClient.post<{ message: string }>('/auth/verify-email', data),

  resendOtp: (data: { email: string }) =>
    apiClient.post<{ message: string }>('/auth/resend-otp', data),

  logout: () => 
    apiClient.post<void>('/auth/logout'),
    
  getMe: () => 
    apiClient.get<User>('/auth/me'),

  updateProfile: (data: { full_name?: string; phone_number?: string | null }) =>
    apiClient.patch<User>('/auth/me', data),

  uploadProfilePhoto: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<User>('/users/me/profile-photo', form);
  },

  removeProfilePhoto: () =>
    apiClient.delete<void>('/users/me/profile-photo'),

  forgotPassword: (data: { email: string }) =>
    apiClient.post<{ message: string }>('/auth/forgot-password', data),

  verifyResetOtp: (data: { email: string; otp: string }) =>
    apiClient.post<{ message: string }>('/auth/verify-reset-otp', data),

  resetPassword: (data: { email: string; otp: string; new_password: string }) =>
    apiClient.post<{ message: string }>('/auth/reset-password', data),
};
