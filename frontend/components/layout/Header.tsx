'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User, Settings, ShieldCheck, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/lib/utils';

const PAGE_TITLES: Record<string, string> = {
  '/analyze': 'Analyse',
  '/dashboard': 'Dashboard',
  '/history': 'Verlauf',
  '/profile': 'Profil',
  '/settings': 'Einstellungen',
  '/admin': 'Admin-Panel',
  '/support': 'Support & Hilfe',
  '/feedback': 'Feedback',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, isAdmin, user, balance, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const pageTitle = PAGE_TITLES[pathname] || '';

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleLogout() {
    setDropdownOpen(false);
    await logout();
    router.push('/login');
  }

  const creditsAvail = balance?.credits_available ?? 0;

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between h-[var(--header-height)] px-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
          aria-label="Menü öffnen"
        >
          <Menu size={20} />
        </button>
        {pageTitle && (
          <h1 className="text-[14px] font-semibold text-[var(--color-text)]">{pageTitle}</h1>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {isLoggedIn ? (
          <div className="flex items-center gap-2" ref={dropRef}>
            {/* Credits */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[12px]">
              <CreditCard size={12} className="text-[var(--color-primary)]" />
              <span className="font-semibold text-[var(--color-text)]">{creditsAvail}</span>
              <span className="text-[var(--color-muted-2)]">Credits</span>
            </div>
            {/* Avatar */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[12px] font-bold text-white cursor-pointer"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
              >
                {getInitials(user?.display_name || user?.email)}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] py-1 z-50">
                  <div className="px-3 py-2 border-b border-[var(--color-border)]">
                    <div className="text-[13px] font-medium text-[var(--color-text)] truncate">
                      {user?.display_name || 'Kein Name'}
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)] truncate">{user?.email}</div>
                  </div>
                  {[
                    { label: 'Profil', icon: <User size={14} />, href: '/profile' },
                    { label: 'Einstellungen', icon: <Settings size={14} />, href: '/settings' },
                    ...(isAdmin ? [{ label: 'Admin-Panel', icon: <ShieldCheck size={14} />, href: '/admin' }] : []),
                  ].map(item => (
                    <button
                      key={item.href}
                      onClick={() => { setDropdownOpen(false); router.push(item.href); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                  <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                    >
                      <LogOut size={14} /> Abmelden
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/login')}
              className="h-8 px-3 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Anmelden
            </button>
            <button
              onClick={() => router.push('/register')}
              className="h-8 px-4 text-[13px] font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              Registrieren
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
