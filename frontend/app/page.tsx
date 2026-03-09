'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';

import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { DemoSection } from '@/components/landing/DemoSection';
import { TrustStrip } from '@/components/landing/TrustStrip';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { AudienceFitSection } from '@/components/landing/AudienceFitSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';
import { FooterSection } from '@/components/landing/FooterSection';

export default function LandingPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    if (!loading && isLoggedIn) router.replace('/dashboard');
  }, [isLoggedIn, loading, router]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#06070A' }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (isLoggedIn) return null;

  return (
    // Force dark appearance for the landing page independent of user theme
    <div style={{ background: '#06070A', color: '#F5F7FB', minHeight: '100vh' }}>
      <LandingNav />
      <main>
        {/* 1. Hero */}
        <HeroSection />

        {/* 2. Demo / Live Preview */}
        <DemoSection />

        {/* 3. Trust / Stats Strip */}
        <TrustStrip />

        {/* 4. Features */}
        <FeaturesSection />

        {/* 5. How It Works */}
        <HowItWorksSection />

        {/* 6. Comparison */}
        <ComparisonSection />

        {/* 7. Pricing */}
        <PricingSection />

        {/* 8. Audience Fit */}
        <AudienceFitSection />

        {/* 9. FAQ */}
        <FAQSection />

        {/* 10. Final CTA */}
        <FinalCTASection />
      </main>

      {/* 11. Footer */}
      <FooterSection />
    </div>
  );
}
