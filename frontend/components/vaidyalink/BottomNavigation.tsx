'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'health-passport', label: 'Health', icon: 'badge', path: '/vaidyalink/health-passport' },
  { id: 'records', label: 'Records', icon: 'folder_open', path: '/vaidyalink/records' },
  { id: 'voice', label: 'Voice', icon: 'mic', path: '/vaidyalink/voice' },
  { id: 'doctor', label: 'Doctor', icon: 'medical_services', path: '/vaidyalink/doctor-portal' },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
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
  );
}
