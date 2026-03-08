'use client';

/**
 * DemoModeToggle Component
 *
 * Provides a UI toggle to switch between live and demo mode.
 * Note: This requires page reload to take effect since environment
 * variables are read at build time in Next.js.
 */

import { useState, useEffect } from 'react';

export default function DemoModeToggle() {
  // Initialize with environment variable to avoid hydration mismatch
  const [isDemoMode, setIsDemoMode] = useState(() => {
    // This will be evaluated on both server and client with the same value
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  });
  const [showReloadPrompt, setShowReloadPrompt] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggle = () => {
    const newMode = !isDemoMode;
    setIsDemoMode(newMode);
    setShowReloadPrompt(true);

    // Store preference in localStorage for persistence (only on client)
    if (isMounted && typeof window !== 'undefined') {
      localStorage.setItem('demoMode', newMode.toString());
    }
  };

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Demo Mode</span>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none ${
            isDemoMode ? 'bg-blue-600' : 'bg-gray-300'
          }`}
          role="switch"
          aria-checked={isDemoMode}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
              isDemoMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        {isDemoMode && (
          <span className="animate-fade-in rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 transition-all duration-200">
            Using Mock Data
          </span>
        )}
      </div>

      {/* Reload Prompt */}
      {showReloadPrompt && (
        <div className="animate-fade-in absolute top-full right-0 z-10 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <p className="mb-3 text-sm text-gray-700">
            Demo mode preference saved. Reload the page to apply changes.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleReload}
              className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
            >
              Reload Now
            </button>
            <button
              onClick={() => setShowReloadPrompt(false)}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
