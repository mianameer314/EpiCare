import { apiClient } from './client';
import type { LoginPayload, RegisterPayload, AuthResponse, User } from '../types/auth';

export const authApi = {
  login: (data: LoginPayload) => 
    apiClient.post<AuthResponse>('/auth/login', data),
    
  register: (data: RegisterPayload) => 
    apiClient.post<AuthResponse>('/auth/register', data),
    
  logout: () => 
    apiClient.post<void>('/auth/logout'),
    
  getMe: () => 
    apiClient.get<User>('/auth/me'),

  forgotPassword: (data: { email: string }) =>
    apiClient.post<{ message: string }>('/auth/forgot-password', data),

  verifyResetOtp: (data: { email: string; otp: string }) =>
    apiClient.post<{ message: string }>('/auth/verify-reset-otp', data),

  resetPassword: (data: { email: string; otp: string; new_password: string }) =>
    apiClient.post<{ message: string }>('/auth/reset-password', data),
};
