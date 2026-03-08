'use client';

/**
 * Header Component
 *
 * Displays application title, current workflow step, and demo mode toggle.
 * Shows the workflow progression: Upload → Processing → Results
 *
 * NOTE: Authentication temporarily disabled - user info and logout removed
 */

import React from 'react';
import DemoModeToggle from './DemoModeToggle';

type WorkflowStep = 'upload' | 'processing' | 'results';

interface HeaderProps {
  currentStep?: WorkflowStep;
}

export function Header({ currentStep = 'upload' }: HeaderProps) {
  // Authentication disabled for testing
  const user = null;
  const signOut = () => {};

  const steps = [
    { id: 'upload', label: 'Upload' },
    { id: 'processing', label: 'Processing' },
    { id: 'results', label: 'Results' },
  ];

  const getStepStatus = (stepId: string) => {
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const currentIndex = steps.findIndex((s) => s.id === currentStep);

    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Application Title */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">Medical Document Scanner</h1>
          </div>

          {/* Demo Mode Toggle */}
          <div className="flex items-center gap-4">
            <DemoModeToggle />
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="mt-4">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {steps.map((step, index) => {
                const status = getStepStatus(step.id);
                return (
                  <li
                    key={step.id}
                    className={`relative ${index !== steps.length - 1 ? 'flex-1' : ''}`}
                  >
                    <div className="flex items-center">
                      {/* Step Circle */}
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ${
                          status === 'complete'
                            ? 'scale-110 bg-blue-600'
                            : status === 'current'
                              ? 'scale-105 border-2 border-blue-600 bg-white'
                              : 'border-2 border-gray-300 bg-white'
                        }`}
                      >
                        {status === 'complete' ? (
                          <svg
                            className="h-5 w-5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <span
                            className={`text-sm font-medium ${
                              status === 'current' ? 'text-blue-600' : 'text-gray-400'
                            }`}
                          >
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Step Label */}
                      <span
                        className={`ml-2 text-sm font-medium ${
                          status === 'current'
                            ? 'text-blue-600'
                            : status === 'complete'
                              ? 'text-gray-900'
                              : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>

                      {/* Connector Line */}
                      {index !== steps.length - 1 && (
                        <div
                          className={`ml-4 h-0.5 flex-1 transition-all duration-500 ${
                            status === 'complete' ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </div>
    </header>
  );
}
