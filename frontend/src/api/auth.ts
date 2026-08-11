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
};
