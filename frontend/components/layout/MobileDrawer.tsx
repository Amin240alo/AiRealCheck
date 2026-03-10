'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutDashboard, ScanSearch, History, User, Settings, HelpCircle, MessageSquare, ShieldCheck, Star, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/LanguageContext';
import { PLAN_ORDER, PLANS, getNextPlanId, type PlanId } from '@/lib/plans';
import { cn } from '@/lib/utils';
import { ThemeLogo } from '@/components/ui/ThemeLogo';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEM_DEFS = [
  { labelKey: 'nav.dashboard',  href: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.analyze',    href: '/analyze',   icon: ScanSearch },
  { labelKey: 'nav.history',    href: '/history',   icon: History },
  { labelKey: 'nav.profile',    href: '/profile',   icon: User },
  { labelKey: 'nav.settings',   href: '/settings',  icon: Settings },
  { labelKey: 'nav.support',    href: '/support',   icon: HelpCircle },
  { labelKey: 'nav.feedback',   href: '/feedback',  icon: MessageSquare },
];

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, isAdmin, balance } = useAuth();
  const { t } = useT();

  const planType   = (balance?.plan_type ?? 'free') as string;
  const nextPlanId = getNextPlanId(planType, PLAN_ORDER);
  const nextPlan   = nextPlanId ? PLANS[nextPlanId as PlanId] : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col md:hidden"
          >
            <div className="flex items-center justify-between h-[var(--header-height)] px-4 border-b border-[var(--color-border)]">
              <ThemeLogo height="h-8" />
              <button onClick={onClose} className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)]">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              {NAV_ITEM_DEFS.map(({ labelKey, href, icon: Icon }) => {
                const isActive = pathname === href;
                const label = t(labelKey);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 h-11 px-4 text-[14px] transition-colors',
                      isActive
                        ? 'text-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 h-11 px-4 text-[14px] transition-colors',
                    pathname === '/admin'
                      ? 'text-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  <ShieldCheck size={18} /> {t('nav.admin')}
                </Link>
              )}
            </div>
            {isLoggedIn && balance && (
              <div className="mx-3 mb-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div className="flex justify-between mb-2">
                  <span className="text-[11px] text-[var(--color-muted-2)]">{t('layout.credits')}</span>
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">{balance.credits_available}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)]"
                    style={{ width: `${Math.max(0, Math.min(100, (balance.credits_available / (balance.credits_total || 100)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
            <div className="px-3 pb-4">
              {nextPlan ? (
                <button
                  onClick={() => { onClose(); router.push('/premium'); }}
                  className="flex items-center gap-2 w-full h-10 px-3 rounded-[var(--radius-md)] bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] text-white text-[13px] font-medium"
                >
                  <Star size={14} /> Upgrade auf {nextPlan.name}
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-muted)] text-[13px] font-medium">
                  <BadgeCheck size={14} /> Aktiver Plan
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
