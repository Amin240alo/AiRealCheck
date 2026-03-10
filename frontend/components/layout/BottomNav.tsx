'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ScanSearch, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

const NAV_ITEM_DEFS = [
  { labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.analyze',   href: '/analyze',   icon: ScanSearch },
  { labelKey: 'nav.history',   href: '/history',   icon: History },
  { labelKey: 'nav.profile',   href: '/profile',   icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <nav
      aria-label={t('layout.mobileNavLabel')}
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-stretch pb-safe"
      style={{ minHeight: '4rem' }}
    >
      {NAV_ITEM_DEFS.map(({ labelKey, href, icon: Icon }) => {
        const isActive = pathname === href;
        const label = t(labelKey);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]'
            )}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
