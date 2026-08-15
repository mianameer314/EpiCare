import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* ────────────────────────────────────────────────────
   TanStack Query Provider
   Medical app defaults: conservative stale times,
   no refetch on window focus (prevent accidental
   state changes during clinical workflows).
   ──────────────────────────────────────────────────── */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 minutes
      gcTime: 1000 * 60 * 10,         // 10 minutes garbage collection
      retry: 1,
      refetchOnWindowFocus: false,     // Medical safety: don't auto-refetch
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
