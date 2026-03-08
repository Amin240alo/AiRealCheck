'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/spinner';
import { saveReturnPath } from '@/contexts/AuthContext';

const PUBLIC_APP_ROUTES = ['/analyze']; // allow analyze page even if not logged in (shows CTA)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isLoggedIn && !PUBLIC_APP_ROUTES.includes(pathname)) {
      saveReturnPath(pathname);
      router.replace('/login');
    }
  }, [isLoggedIn, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
