'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FeaturesPage() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const features = [
    {
      id: 'document-scanner',
      name: 'Document Scanner',
      icon: '📄',
      status: 'working',
      description: 'AI-powered extraction from prescriptions and lab reports',
      link: '/document-scan-demo',
    },
    {
      id: 'voice-processing',
      name: 'Voice Processing',
      icon: '🎤',
      status: 'working',
      description: '22 Indian languages with Sarvam API',
      link: '/features/voice',
    },
    {
      id: 'clinical-summarizer',
      name: 'Clinical Summarizer',
      icon: '📋',
      status: 'demo',
      description: 'AI-powered patient summaries',
      link: '/features/clinical-summary',
    },
    {
      id: 'fhir-transformer',
      name: 'FHIR Transformer',
      icon: '🔄',
      status: 'demo',
      description: 'HL7 FHIR R4 compliance',
      link: '/features/fhir',
    },
    {
      id: 'abdm-connector',
      name: 'ABDM Connector',
      icon: '🇮🇳',
      status: 'demo',
      description: 'Ayushman Bharat integration',
      link: '/features/abdm',
    },
    {
      id: 'hitl-handler',
      name: 'HITL Handler',
      icon: '👥',
      status: 'demo',
      description: 'Human-in-the-loop quality assurance',
      link: '/features/hitl',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">VaidyaLink Features</h1>
          <p className="mt-2 text-sm text-gray-600">
            Explore all 10 features of the VaidyaLink healthcare platform
          </p>
        </div>
      </header>

      {/* Features Grid */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.id}
              href={feature.link}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="text-4xl">{feature.icon}</div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    feature.status === 'working'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {feature.status === 'working' ? 'Working' : 'Demo'}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.name}</h3>
              <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
