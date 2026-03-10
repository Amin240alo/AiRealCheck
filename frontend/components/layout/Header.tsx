'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User, Settings, ShieldCheck, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/LanguageContext';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { isLoggedIn, isAdmin, user, balance, logout } = useAuth();
  const { t, tf } = useT();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef    = useRef<HTMLDivElement>(null);
  const avatarRef  = useRef<HTMLButtonElement>(null);

  const PAGE_TITLES: Record<string, string> = {
    '/analyze':    t('nav.analyze'),
    '/dashboard':  t('nav.dashboard'),
    '/history':    t('nav.history'),
    '/profile':    t('nav.profile'),
    '/settings':   t('nav.settings'),
    '/admin':      t('nav.admin'),
    '/support':    t('nav.support'),
    '/feedback':   t('nav.feedback'),
    '/premium':    t('nav.premium'),
    '/api-access': t('nav.apiAccess'),
  };

  const pageTitle = PAGE_TITLES[pathname] || '';

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
        avatarRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dropdownOpen]);

  // Close on route change
  useEffect(() => { setDropdownOpen(false); }, [pathname]);

  const handleLogout = useCallback(async () => {
    setDropdownOpen(false);
    await logout();
    router.push('/login');
  }, [logout, router]);

  const creditsAvail = balance?.credits_available ?? 0;

  const menuItems = [
    { label: t('nav.profile'),  icon: <User size={14} aria-hidden />,        href: '/profile' },
    { label: t('nav.settings'), icon: <Settings size={14} aria-hidden />,    href: '/settings' },
    ...(isAdmin ? [{ label: t('nav.admin'), icon: <ShieldCheck size={14} aria-hidden />, href: '/admin' }] : []),
  ];

  return (
    <header
      aria-label={t('layout.mainHeader')}
      className="sticky top-0 z-20 flex items-center justify-between h-[var(--header-height)] px-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      {/* Skip link */}
      <a href="#main-content" className="skip-link">{t('layout.skipToContent')}</a>

      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          aria-label={t('layout.openMenu')}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        {pageTitle && (
          <span className="text-[14px] font-semibold text-[var(--color-text)]" aria-hidden="true">{pageTitle}</span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {isLoggedIn ? (
          <div className="flex items-center gap-2" ref={dropRef}>
            {/* Credits pill */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[12px]"
              aria-label={tf('layout.creditsAvailable', creditsAvail)}
            >
              <CreditCard size={12} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span className="font-semibold text-[var(--color-text)]">{creditsAvail}</span>
              <span className="text-[var(--color-muted-2)]" aria-hidden="true">{t('layout.credits')}</span>
            </div>

            {/* Avatar / dropdown */}
            <div className="relative">
              <button
                ref={avatarRef}
                onClick={() => setDropdownOpen(v => !v)}
                className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[12px] font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                aria-label={`${t('layout.userProfile')}: ${user?.display_name || user?.email || t('layout.noName')}`}
              >
                {getInitials(user?.display_name || user?.email)}
              </button>

              {dropdownOpen && (
                <div
                  role="menu"
                  aria-label={t('layout.userMenu')}
                  className="absolute right-0 top-full mt-2 w-52 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] py-1 z-50"
                >
                  <div className="px-3 py-2 border-b border-[var(--color-border)]">
                    <div className="text-[13px] font-medium text-[var(--color-text)] truncate">
                      {user?.display_name || t('layout.noName')}
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)] truncate">{user?.email}</div>
                  </div>

                  {menuItems.map(item => (
                    <button
                      key={item.href}
                      role="menuitem"
                      onClick={() => { setDropdownOpen(false); router.push(item.href); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}

                  <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
                    >
                      <LogOut size={14} aria-hidden="true" /> {t('layout.signOut')}
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
              {t('layout.signIn')}
            </button>
            <button
              onClick={() => router.push('/register')}
              className="h-8 px-4 text-[13px] font-medium bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              {t('layout.register')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
