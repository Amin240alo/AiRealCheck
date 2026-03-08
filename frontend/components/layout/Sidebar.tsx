'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ScanSearch, History, User, Settings,
  HelpCircle, MessageSquare, Zap, ShieldCheck, ChevronLeft, ChevronRight,
  Star, CreditCard
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const SIDEBAR_KEY = 'ac_sidebar_collapsed';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  disabled?: boolean;
  badge?: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Arbeitsbereich',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} /> },
      { label: 'Analyse', href: '/analyze', icon: <ScanSearch size={16} /> },
      { label: 'Verlauf', href: '/history', icon: <History size={16} /> },
    ],
  },
  {
    title: 'Konto',
    items: [
      { label: 'Profil', href: '/profile', icon: <User size={16} /> },
      { label: 'Einstellungen', href: '/settings', icon: <Settings size={16} /> },
    ],
  },
  {
    title: 'Tools & Support',
    items: [
      { label: 'Support & Hilfe', href: '/support', icon: <HelpCircle size={16} /> },
      { label: 'Feedback', href: '/feedback', icon: <MessageSquare size={16} /> },
      { label: 'API-Zugang', href: '/api-access', icon: <Zap size={16} />, disabled: true, badge: 'Bald' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Admin-Panel', href: '/admin', icon: <ShieldCheck size={16} />, adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, isAdmin, user, balance } = useAuth();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === '1') setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  }

  const creditsTotal = balance?.credits_total || 100;
  const creditsAvail = balance?.credits_available ?? 0;
  const creditsPct = Math.max(0, Math.min(100, (creditsAvail / creditsTotal) * 100));

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="hidden md:flex flex-col h-screen sticky top-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-hidden flex-shrink-0 z-30"
      style={{ minWidth: collapsed ? 56 : 220 }}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between h-[var(--header-height)] px-3 border-b border-[var(--color-border)] flex-shrink-0">
        <button
          onClick={() => router.push(isLoggedIn ? '/analyze' : '/')}
          className="flex items-center gap-2 min-w-0 cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Assets/Logos/airealcheck-brandmark.png"
            alt="AIRealCheck"
            className="w-7 h-7 flex-shrink-0 object-contain"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.img
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                src="/Assets/Logos/airealcheck-wordmark.png"
                alt="AIRealCheck"
                className="h-5 object-contain overflow-hidden"
              />
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={toggle}
          className="p-1 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex-shrink-0 ml-1"
          aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.title} className="mb-2">
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)]"
                  >
                    {section.title}
                  </motion.div>
                )}
              </AnimatePresence>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <div key={item.href} className="px-2 py-0.5">
                    {item.disabled ? (
                      <div className={cn(
                        'flex items-center gap-2.5 h-8 px-2 rounded-[var(--radius-sm)] opacity-40 cursor-not-allowed',
                        'text-[var(--color-muted)]'
                      )}>
                        <span className="flex-shrink-0">{item.icon}</span>
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-2 min-w-0 flex-1"
                            >
                              <span className="text-[13px] truncate">{item.label}</span>
                              {item.badge && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-muted-2)]">
                                  {item.badge}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 h-8 px-2 rounded-[var(--radius-sm)] transition-colors duration-150',
                          isActive
                            ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-[13px] truncate"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Upgrade CTA */}
        {isLoggedIn && (
          <div className="px-2 mt-2">
            <button
              onClick={() => router.push('/premium')}
              className={cn(
                'flex items-center gap-2.5 h-8 w-full px-2 rounded-[var(--radius-sm)]',
                'bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] text-white text-[13px] font-medium',
                'hover:opacity-90 transition-opacity'
              )}
              title={collapsed ? 'Upgrade auf Premium' : undefined}
            >
              <Star size={14} className="flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    Upgrade auf Premium
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        )}
      </div>

      {/* Credits card (only expanded + logged in) */}
      <AnimatePresence>
        {!collapsed && isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mx-3 mb-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-2)]">
                {balance?.plan_type || 'Free'}
              </span>
              <div className="flex items-center gap-1 text-[var(--color-text)]">
                <CreditCard size={12} className="text-[var(--color-primary)]" />
                <span className="text-[13px] font-semibold">{creditsAvail}</span>
                <span className="text-[11px] text-[var(--color-muted-2)]">Credits</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                style={{ width: `${creditsPct}%` }}
              />
            </div>
            {balance?.last_credit_reset && (
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px] text-[var(--color-muted-2)]">Reset</span>
                <span className="text-[11px] text-[var(--color-muted)]">
                  {new Date(balance.last_credit_reset).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer links */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 pb-4 text-[11px] text-[var(--color-muted-2)]"
          >
            <Link href="/legal?section=impressum" className="hover:text-[var(--color-muted)] transition-colors">Impressum</Link>
            <span>·</span>
            <Link href="/legal?section=privacy" className="hover:text-[var(--color-muted)] transition-colors">Datenschutz</Link>
            <span>·</span>
            <Link href="/legal?section=tac" className="hover:text-[var(--color-muted)] transition-colors">AGB</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
