import { apiClient } from './client';

/* ────────────────────────────────────────────────────
   Chat API Module — AI Medical & RAG Assistant
   Matches FastAPI endpoints in app/api/v1/chat.py
   ──────────────────────────────────────────────────── */

export interface ChatMessageOut {
  id: number;
  session_id: number;
  user_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const chatApi = {
  getHistory: (limit = 30) =>
    apiClient.get<ChatMessageOut[]>(`/chat/history?limit=${limit}`),

  sendMessage: (content: string) =>
    apiClient.post<ChatMessageOut>('/chat/message', { content }),
};
