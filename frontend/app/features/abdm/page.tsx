'use client';

import { useState } from 'react';

export default function ABDMConnectorPage() {
  const [abhaId, setAbhaId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkedData, setLinkedData] = useState<any>(null);

  const linkToABDM = async () => {
    if (!abhaId) return;

    setIsLinking(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setLinkedData({
      abhaId,
      abhaAddress: `${abhaId}@abdm`,
      name: 'Vivek M',
      gender: 'Male',
      yearOfBirth: '1990',
      mobile: '+91 98765 43210',
      linkedAt: new Date().toISOString(),
      healthRecords: [
        { type: 'Prescription', date: '2024-03-08', facility: 'Adichunchanagiri Hospital' },
        { type: 'Lab Report', date: '2024-03-07', facility: 'City Diagnostics' },
        { type: 'Consultation', date: '2024-03-05', facility: 'Apollo Clinic' },
      ],
    });
    setIsLinking(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">ABDM Connector</h1>
          <p className="mt-2 text-sm text-gray-600">
            Connect to Ayushman Bharat Digital Mission (ABDM) national health stack
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {!linkedData ? (
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <div className="mb-8 text-center">
              <div className="mb-4 text-6xl">🇮🇳</div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Link ABHA ID</h2>
              <p className="text-gray-600">Connect patient records to the national health stack</p>
            </div>

            <div className="mx-auto max-w-md space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  ABHA ID (Ayushman Bharat Health Account)
                </label>
                <input
                  type="text"
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value)}
                  placeholder="Enter 14-digit ABHA ID"
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Example: 12-3456-7890-1234</p>
              </div>

              <button
                onClick={linkToABDM}
                disabled={!abhaId || isLinking}
                className="w-full rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLinking ? 'Linking to ABDM...' : 'Link to ABDM'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">ABDM Profile</h2>
                <button
                  onClick={() => {
                    setLinkedData(null);
                    setAbhaId('');
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Link Another
                </button>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-md bg-blue-50 p-4">
                  <p className="text-sm text-gray-600">ABHA ID</p>
                  <p className="text-lg font-semibold text-gray-900">{linkedData.abhaId}</p>
                </div>
                <div className="rounded-md bg-green-50 p-4">
                  <p className="text-sm text-gray-600">ABHA Address</p>
                  <p className="text-lg font-semibold text-gray-900">{linkedData.abhaAddress}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between border-b py-2">
                  <span className="text-gray-600">Name</span>
                  <span className="font-medium text-gray-900">{linkedData.name}</span>
                </div>
                <div className="flex justify-between border-b py-2">
                  <span className="text-gray-600">Gender</span>
                  <span className="font-medium text-gray-900">{linkedData.gender}</span>
                </div>
                <div className="flex justify-between border-b py-2">
                  <span className="text-gray-600">Year of Birth</span>
                  <span className="font-medium text-gray-900">{linkedData.yearOfBirth}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Mobile</span>
                  <span className="font-medium text-gray-900">{linkedData.mobile}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Linked Health Records</h3>
              <div className="space-y-3">
                {linkedData.healthRecords.map((record: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md bg-gray-50 p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{record.type}</p>
                      <p className="text-sm text-gray-600">{record.facility}</p>
                    </div>
                    <span className="text-sm text-gray-500">{record.date}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-start space-x-3">
                <svg
                  className="mt-0.5 h-5 w-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Successfully Linked to ABDM</p>
                  <p className="mt-1 text-xs text-green-600">
                    Patient records are now part of the national health stack and can be accessed by
                    authorized healthcare providers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
