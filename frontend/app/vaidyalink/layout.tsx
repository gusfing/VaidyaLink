'use client';

import { Inter } from 'next/font/google';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/document-scan-demo/ToastContainer';
import ThemeToggle from '@/components/vaidyalink/ThemeToggle';
import './vaidyalink.css';

const inter = Inter({ subsets: ['latin'] });

export default function VaidyaLinkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { id: 'health-passport', label: 'Health', icon: 'badge', path: '/vaidyalink/health-passport' },
    { id: 'records', label: 'Records', icon: 'folder_open', path: '/vaidyalink/records' },
    { id: 'voice', label: 'Voice', icon: 'mic', path: '/vaidyalink/voice' },
    { id: 'doctor', label: 'Doctor', icon: 'medical_services', path: '/vaidyalink/doctor-portal' },
  ];

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className={`${inter.className} vaidyalink-app`}>
          {/* Header with theme toggle */}
          <header className="vaidyalink-header">
            <div className="header-content">
              <h1 className="app-title">VaidyaLink</h1>
              <ThemeToggle />
            </div>
          </header>

          <main className="vaidyalink-main">{children}</main>

          {/* Bottom Navigation */}
          <nav className="bottom-nav">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.path}
                className={`nav-item ${pathname === item.path ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
