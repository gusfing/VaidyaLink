'use client';

import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">VaidyaLink Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Healthcare platform with AI-powered document processing and voice transcription
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/document-scan-demo"
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-3 text-4xl">📄</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Document Scanner</h3>
            <p className="text-sm text-gray-600">AI-powered extraction from medical documents</p>
            <span className="mt-3 inline-block rounded bg-green-100 px-2 py-1 text-xs text-green-700">
              Working
            </span>
          </Link>

          <Link
            href="/features"
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-3 text-4xl">🎯</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">All Features</h3>
            <p className="text-sm text-gray-600">Explore all 10 platform features</p>
            <span className="mt-3 inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
              Demo
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
