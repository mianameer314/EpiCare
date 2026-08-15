import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Connections API Module — Doctor & Caretaker Networks
   Matches FastAPI endpoints in app/api/v1/connections.py
   ──────────────────────────────────────────────────── */

export interface EnrichedUserBase {
  id: number;
  full_name: string;
  email: string;
  phone_number?: string | null;
}

export interface DoctorSearchItem {
  doctor_id: number;
  full_name: string;
  pmdc_number: string;
  specialty: string;
  hospital_affiliation?: string | null;
}

export interface PatientDoctorConnection {
  connection_id: number;
  relationship_status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED';
  doctor_id: number;
  doctor: EnrichedUserBase;
  pmdc_number: string;
  specialty: string;
  hospital_affiliation?: string | null;
}

export interface PatientCaretakerConnection {
  connection_id: number;
  relationship_status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED';
  caretaker_id: number;
  caretaker: EnrichedUserBase;
  can_proxy: boolean;
}

export interface ConnectedPatient {
  connection_id: number;
  relationship_status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED';
  patient_id: number;
  patient: EnrichedUserBase;
  date_of_birth?: string | null;
  gender?: string | null;
  can_proxy?: boolean | null;
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export const connectionsApi = {
  // ── Patient Endpoints ──
  searchDoctors: async (params?: { name?: string; specialty?: string; pmdc?: string }) => {
    const sp = new URLSearchParams();
    if (params?.name) sp.set('name', params.name);
    if (params?.specialty) sp.set('specialty', params.specialty);
    if (params?.pmdc) sp.set('pmdc_number', params.pmdc);
    const qs = sp.toString();
    const res = await apiClient.get<PaginatedList<DoctorSearchItem>>(`/connections/doctors/search${qs ? `?${qs}` : ''}`);
    return res?.items || (Array.isArray(res) ? res : []);
  },

  requestDoctorConnection: (doctorId: number) =>
    apiClient.post('/connections/doctors/request', { doctor_id: doctorId }),

  getPatientDoctors: async () => {
    try {
      const res = await apiClient.get<PaginatedList<PatientDoctorConnection>>('/connections/patient/doctors');
      return res?.items || (Array.isArray(res) ? res : []);
    } catch {
      return [];
    }
  },

  disconnectDoctor: (connectionId: number) =>
    apiClient.delete(`/connections/doctors/${connectionId}`),

  inviteCaretaker: (email: string) =>
    apiClient.post('/connections/caretakers/request', { caretaker_email: email }),

  getPatientCaretakers: async () => {
    try {
      const res = await apiClient.get<PaginatedList<PatientCaretakerConnection>>('/connections/patient/caretakers');
      return res?.items || (Array.isArray(res) ? res : []);
    } catch {
      return [];
    }
  },

  updateCaretakerProxy: (connectionId: number, canProxy: boolean) =>
    apiClient.put(`/connections/caretakers/${connectionId}/proxy`, { can_proxy: canProxy }),

  disconnectCaretaker: (connectionId: number) =>
    apiClient.delete(`/connections/caretakers/${connectionId}`),

  // ── Doctor Endpoints ──
  getDoctorPendingRequests: async () => {
    try {
      const res = await apiClient.get<PaginatedList<ConnectedPatient>>('/connections/doctors/pending');
      return res?.items || (Array.isArray(res) ? res : []);
    } catch {
      return [];
    }
  },

  getDoctorPatients: async () => {
    try {
      const res = await apiClient.get<PaginatedList<ConnectedPatient>>('/connections/doctor/patients');
      return res?.items || (Array.isArray(res) ? res : []);
    } catch {
      return [];
    }
  },

  approveDoctorRequest: (connectionId: number) =>
    apiClient.post(`/connections/doctors/approve/${connectionId}`),

  // ── Caretaker Endpoints ──
  getCaretakerPendingInvites: async () => {
    try {
      const res = await apiClient.get<PaginatedList<ConnectedPatient>>('/connections/caretakers/pending');
      return res?.items || (Array.isArray(res) ? res : []);
    } catch {
      return [];
    }
  },

  getCaretakerPatients: async () => {
    try {
      const res = await apiClient.get<PaginatedList<ConnectedPatient>>('/connections/caretaker/patients');
      return res?.items || (Array.isArray(res) ? res : []);
    } catch {
      return [];
    }
  },

  approveCaretakerInvite: (connectionId: number) =>
    apiClient.post(`/connections/caretakers/approve/${connectionId}`),
};
