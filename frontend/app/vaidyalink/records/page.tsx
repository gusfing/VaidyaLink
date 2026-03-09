'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import RecordCard from '@/components/vaidyalink/RecordCard';
import { mockMedicalRecords } from '@/lib/vaidyalink/mock-data';

type TabType = 'all' | 'prescriptions' | 'lab-reports' | 'scans';
type DateFilter = 'latest' | 'all';

export default function RecordsLibraryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

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

  const handleRecordClick = (id: string) => {
    console.log('Record clicked:', id);
    // Navigate to detail view
  };

  return (
    <div className="records-library-page">
      <h1>Medical Records</h1>

      {/* Search Bar */}
      <div className="search-bar">
        <span className="material-symbols-outlined">search</span>
        <input
          type="text"
          placeholder="Search records..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
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
      <div className="quick-filters">
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
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <RecordCard key={record.id} {...record} onClick={() => handleRecordClick(record.id)} />
          ))
        ) : (
          <div className="empty-state">
            <span className="material-symbols-outlined">folder_open</span>
            <p>No records found</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button className="fab" onClick={() => router.push('/vaidyalink/scanner')}>
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}
