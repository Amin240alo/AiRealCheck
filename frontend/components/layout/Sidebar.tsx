'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ScanSearch, History, User, Settings,
  HelpCircle, MessageSquare, Zap, ShieldCheck,
  PanelLeftClose, PanelLeftOpen, Sparkles, CreditCard,
  Sun, Moon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const SIDEBAR_KEY = 'ac_sidebar_collapsed';
const COLLAPSED_W = 60;
const EXPANDED_W = 220;

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
  disabled?: boolean;
  badge?: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Arbeitsbereich',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Analyse',   href: '/analyze',   icon: ScanSearch },
      { label: 'Verlauf',   href: '/history',    icon: History },
    ],
  },
  {
    title: 'Konto',
    items: [
      { label: 'Profil',         href: '/profile',   icon: User },
      { label: 'Einstellungen',  href: '/settings',  icon: Settings },
    ],
  },
  {
    title: 'Tools & Support',
    items: [
      { label: 'Support & Hilfe', href: '/support',    icon: HelpCircle },
      { label: 'Feedback',        href: '/feedback',   icon: MessageSquare },
      { label: 'API-Zugang',      href: '/api-access', icon: Zap, disabled: true, badge: 'Bald' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Admin-Panel', href: '/admin', icon: ShieldCheck, adminOnly: true },
    ],
  },
];

/* ── Framer Motion variants ── */
const labelVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.16, delay: 0.08, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] } },
  exit:    { opacity: 0, x: -6, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as [number,number,number,number] } },
};

const sectionLabelVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.16, delay: 0.1 } },
  exit:    { opacity: 0, transition: { duration: 0.08 } },
};

const logoVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.18, delay: 0.06, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] } },
  exit:    { opacity: 0, x: -10, transition: { duration: 0.1 } },
};

const sidebarTransition = {
  duration: 0.24,
  ease: [0.4, 0, 0.2, 1] as [number,number,number,number],
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname  = usePathname();
  const router    = useRouter();
  const { isLoggedIn, isAdmin, balance } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === '1') setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  }

  const creditsTotal = balance?.credits_total || 100;
  const creditsAvail = balance?.credits_available ?? 0;
  const creditsPct   = Math.max(0, Math.min(100, (creditsAvail / creditsTotal) * 100));

  return (
    <motion.aside
      animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      transition={sidebarTransition}
      className="hidden md:flex flex-col h-screen sticky top-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-hidden flex-shrink-0 z-30"
      style={{ minWidth: collapsed ? COLLAPSED_W : EXPANDED_W }}
    >
      {/* ── Header / Logo ── */}
      <div
        className={cn(
          'flex items-center h-[var(--header-height)] border-b border-[var(--color-border)] flex-shrink-0',
          collapsed ? 'justify-center px-2' : 'justify-between px-3'
        )}
      >
        <AnimatePresence>
          {!collapsed && (
            <motion.button
              variants={logoVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => router.push(isLoggedIn ? '/analyze' : '/')}
              className="flex items-center min-w-0 cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Assets/Logos/airealcheck-secondary.png"
                alt="AIRealCheck"
                className="h-8 object-contain"
              />
            </motion.button>
          )}
        </AnimatePresence>

        <button
          onClick={toggle}
          className="p-2 rounded-[var(--radius-md)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex-shrink-0"
          aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          <AnimatePresence mode="wait">
            {collapsed ? (
              <motion.span
                key="open"
                initial={{ opacity: 0, rotate: -10 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 10 }}
                transition={{ duration: 0.14 }}
                className="flex"
              >
                <PanelLeftOpen size={18} />
              </motion.span>
            ) : (
              <motion.span
                key="close"
                initial={{ opacity: 0, rotate: 10 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -10 }}
                transition={{ duration: 0.14 }}
                className="flex"
              >
                <PanelLeftClose size={18} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ── Nav ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {NAV_SECTIONS.map((section, sectionIdx) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-1">
              {/* Collapsed: visual divider between sections */}
              {collapsed && sectionIdx > 0 && (
                <div className="mx-3 mt-2 mb-2 h-px bg-[var(--color-border)]" />
              )}

              {/* Expanded: section label */}
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    variants={sectionLabelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={cn(
                      'px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-2)]',
                      sectionIdx > 0 ? 'pt-3' : 'pt-1'
                    )}
                  >
                    {section.title}
                  </motion.div>
                )}
              </AnimatePresence>

              {visibleItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <div key={item.href} className="px-2 py-0.5">
                    {item.disabled ? (
                      <div
                        className={cn(
                          'flex items-center h-9 rounded-[var(--radius-sm)] opacity-40 cursor-not-allowed text-[var(--color-muted)]',
                          collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon size={collapsed ? 18 : 16} />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.div
                              variants={labelVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
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
                          'flex items-center h-9 rounded-[var(--radius-sm)] transition-colors duration-150',
                          collapsed ? 'justify-center' : 'gap-2.5 px-2.5',
                          isActive
                            ? 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon size={collapsed ? 18 : 16} />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span
                              variants={labelVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
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

        {/* ── Divider ── */}
        <div className="mx-3 mt-3 mb-1 h-px bg-[var(--color-border)]" />

        {/* ── Theme Toggle ── */}
        <div className="px-2 py-0.5">
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center h-9 w-full rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors duration-150',
              collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
            )}
            title={collapsed ? (theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus') : undefined}
          >
            <AnimatePresence mode="wait">
              {theme === 'dark' ? (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-shrink-0"
                >
                  <Sun size={collapsed ? 18 : 16} />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ opacity: 0, rotate: 30, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -30, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-shrink-0"
                >
                  <Moon size={collapsed ? 18 : 16} />
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  variants={labelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="text-[13px]"
                >
                  {theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* ── Upgrade CTA ── */}
        {isLoggedIn && (
          <div className="px-2 mt-2 pb-1">
            <button
              onClick={() => router.push('/premium')}
              className={cn(
                'w-full rounded-[var(--radius-md)] transition-all duration-200',
                'bg-gradient-to-r from-violet-600 to-blue-500',
                'hover:from-violet-500 hover:to-blue-400',
                'text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.99]',
                collapsed
                  ? 'h-10 flex items-center justify-center'
                  : 'h-11 px-4 flex items-center gap-3 text-[13px] font-semibold'
              )}
              title={collapsed ? 'Upgrade auf Premium' : undefined}
            >
              <Sparkles size={collapsed ? 18 : 15} className="flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    variants={labelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    Upgrade auf Premium
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        )}
      </div>

      {/* ── Credits Card (expanded + logged in only) ── */}
      <AnimatePresence>
        {!collapsed && isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-3 mb-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-2)]">
                {balance?.plan_type || 'Free'}
              </span>
              <div className="flex items-center gap-1.5">
                <CreditCard size={12} className="text-[var(--color-primary)]" />
                <span className="text-[14px] font-bold text-[var(--color-text)]">{creditsAvail}</span>
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
              <div className="flex justify-between mt-2">
                <span className="text-[11px] text-[var(--color-muted-2)]">Reset</span>
                <span className="text-[11px] text-[var(--color-muted)]">
                  {new Date(balance.last_credit_reset).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer Links (expanded only) ── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
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
