import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Chat API Module — AI Medical & RAG Assistant
   Matches FastAPI endpoints in app/api/v1/chat.py
   ──────────────────────────────────────────────────── */

export interface ChatSessionOut {
  id: number;
  user_id: number;
  title: string;
  message_count: number;
  last_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageOut {
  id: number;
  session_id: number;
  user_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const chatApi = {
  // Session Management
  getSessions: () =>
    apiClient.get<ChatSessionOut[]>('/chat/sessions'),

  createSession: (title = 'New Clinical Discussion') =>
    apiClient.post<ChatSessionOut>('/chat/sessions', { title }),

  getSessionMessages: (sessionId: number) =>
    apiClient.get<ChatMessageOut[]>(`/chat/sessions/${sessionId}/messages`),

  deleteSession: (sessionId: number) =>
    apiClient.delete<void>(`/chat/sessions/${sessionId}`),

  // Messaging
  getHistory: (limit = 30) =>
    apiClient.get<ChatMessageOut[]>(`/chat/history?limit=${limit}`),

  sendMessage: (content: string, sessionId?: number) =>
    apiClient.post<ChatMessageOut>('/chat/message', {
      content,
      session_id: sessionId,
    }),
};
