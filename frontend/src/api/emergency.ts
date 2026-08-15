import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Emergency API Module — Contacts, SOS Trigger & Event Logs
   Matches FastAPI endpoints in app/api/v1/emergency.py
   ──────────────────────────────────────────────────── */

export interface EmergencyContact {
  id: number;
  user_id: number;
  name: string;
  relationship: string;
  phone_number: string;
  is_primary: boolean;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContactCreate {
  name: string;
  relationship: string;
  phone_number: string;
  is_primary?: boolean;
}

export interface EmergencyContactUpdate {
  name?: string;
  relationship?: string;
  phone_number?: string;
  is_primary?: boolean;
}

export interface SosTriggerRequest {
  latitude?: number | null;
  longitude?: number | null;
  location_available?: boolean;
  patient_user_id?: number;
  idempotency_key?: string;
}

export interface SosEventCreateResponse {
  event_id: number;
  status: string;
  message: string;
}

export interface SosDelivery {
  contact_name: string;
  phone_number: string;
  delivery_status: string;
  error_message?: string;
}

export interface SosEvent {
  id: number;
  triggered_at: string;
  latitude?: number | null;
  longitude?: number | null;
  location_available: boolean;
  status: string;
  deliveries: SosDelivery[];
}

export interface PaginatedSosEvents {
  items: SosEvent[];
  total: number;
  skip: number;
  limit: number;
}

export const emergencyApi = {
  getContacts: () =>
    apiClient.get<EmergencyContact[]>('/emergency/contacts'),

  createContact: (data: EmergencyContactCreate) =>
    apiClient.post<EmergencyContact>('/emergency/contacts', data),

  updateContact: (id: number, data: EmergencyContactUpdate) =>
    apiClient.put<EmergencyContact>(`/emergency/contacts/${id}`, data),

  deleteContact: (id: number) =>
    apiClient.delete<void>(`/emergency/contacts/${id}`),

  triggerSOS: (data?: SosTriggerRequest) => {
    const payload = data || { location_available: false };
    const idemKey = payload.idempotency_key || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    return apiClient.post<SosEventCreateResponse>('/emergency/sos/trigger', {
      ...payload,
      idempotency_key: idemKey,
    }, {
      headers: idemKey ? { 'X-Idempotency-Key': idemKey } : undefined,
    });
  },

  getSOSEvents: (params?: { skip?: number; limit?: number; status?: string; patient_user_id?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.patient_user_id) searchParams.set('patient_user_id', String(params.patient_user_id));

    const qs = searchParams.toString();
    return apiClient.get<PaginatedSosEvents>(`/emergency/sos${qs ? `?${qs}` : ''}`);
  },
};
