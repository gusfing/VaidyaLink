'use client';

/**
 * LoadingSpinner Component
 *
 * Displays a loading spinner with optional message.
 * Can be used inline or as a full-page overlay.
 */

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

/**
 * Get size classes for spinner
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'h-6 w-6';
    case 'md':
      return 'h-12 w-12';
    case 'lg':
      return 'h-16 w-16';
  }
}

export default function LoadingSpinner({
  message,
  size = 'md',
  fullPage = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <svg
        className={`animate-spin text-blue-600 ${getSizeClasses(size)}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {message && <p className="mt-4 text-gray-600">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">{spinner}</div>
    );
  }

  return spinner;
}
