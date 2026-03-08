'use client';

/**
 * Root Layout for Document Scan Demo
 *
 * Wraps the application with:
 * - QueryClientProvider for React Query
 * - ToastProvider for notifications
 * - Consistent Tailwind styling
 *
 * NOTE: AuthWrapper temporarily removed for testing
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/document-scan-demo/ToastContainer';

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

interface LayoutProps {
  children: React.ReactNode;
}

export default function DocumentScanDemoLayout({ children }: LayoutProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50">{children}</div>
      </ToastProvider>
    </QueryClientProvider>
  );
}
