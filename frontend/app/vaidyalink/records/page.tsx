'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RecordCard from '@/components/vaidyalink/RecordCard';
import { mockMedicalRecords } from '@/lib/vaidyalink/mock-data';
import { useProgressiveReveal } from '@/hooks/useProgressiveReveal';

type TabType = 'all' | 'prescriptions' | 'lab-reports' | 'scans';
type DateFilter = 'latest' | 'all';

export default function RecordsLibraryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredRecords = useMemo(() => {
    let records = [...mockMedicalRecords];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      records = records.filter(
        (record) =>
          record.title.toLowerCase().includes(query) ||
          record.category.toLowerCase().includes(query) ||
          record.date.includes(query)
      );
    }

    // Category filter
    if (activeTab !== 'all') {
      const categoryMap: Record<TabType, string> = {
        all: '',
        prescriptions: 'prescription',
        'lab-reports': 'lab-report',
        scans: 'scan',
      };
      records = records.filter((r) => r.category === categoryMap[activeTab]);
    }

    // Date filter
    if (dateFilter === 'latest') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      records = records.filter((r) => new Date(r.date) >= thirtyDaysAgo);
    }

    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [searchQuery, activeTab, dateFilter]);

  // Progressive reveal for records
  const revealedRecords = useProgressiveReveal(filteredRecords, 150, !loading);

  const handleRecordClick = (id: string) => {
    console.log('Record clicked:', id);
    // Navigate to detail view
  };

  return (
    <div className="records-library-page">
      <h1 className="fade-in">Medical Records</h1>

      {/* Search Bar */}
      <div className="search-bar fade-in" style={{ animationDelay: '0.1s' }}>
        <span className="material-symbols-outlined">search</span>
        <input
          type="text"
          placeholder="Search records..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="tabs fade-in" style={{ animationDelay: '0.2s' }}>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button
          className={`tab ${activeTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          Prescriptions
        </button>
        <button
          className={`tab ${activeTab === 'lab-reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('lab-reports')}
        >
          Lab Reports
        </button>
        <button
          className={`tab ${activeTab === 'scans' ? 'active' : ''}`}
          onClick={() => setActiveTab('scans')}
        >
          Scans
        </button>
      </div>

      {/* Quick Filters */}
      <div className="quick-filters fade-in" style={{ animationDelay: '0.3s' }}>
        <button
          className={`filter-btn ${dateFilter === 'latest' ? 'active' : ''}`}
          onClick={() => setDateFilter('latest')}
        >
          Latest
        </button>
        <button
          className={`filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
          onClick={() => setDateFilter('all')}
        >
          All Dates
        </button>
      </div>

      {/* Records Grid */}
      <div className="records-grid">
        {loading ? (
          // Skeleton loaders
          [...Array(6)].map((_, i) => (
            <div key={i} className="record-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div
                className="skeleton"
                style={{ width: '100%', height: '80px', marginBottom: '12px' }}
              />
              <div
                className="skeleton"
                style={{ width: '80%', height: '20px', marginBottom: '8px' }}
              />
              <div className="skeleton" style={{ width: '60%', height: '16px' }} />
            </div>
          ))
        ) : revealedRecords.length > 0 ? (
          revealedRecords.map((record, index) => (
            <div key={record.id} className="fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
              <RecordCard {...record} onClick={() => handleRecordClick(record.id)} />
            </div>
          ))
        ) : (
          <div className="empty-state fade-in">
            <span className="material-symbols-outlined">folder_open</span>
            <p>No records found</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
                setDateFilter('all');
              }}
              className="btn btn-secondary"
              style={{ marginTop: '1rem' }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        className="fab fade-in"
        style={{ animationDelay: '0.5s' }}
        onClick={() => router.push('/vaidyalink/scanner')}
        title="Add new record"
      >
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}
