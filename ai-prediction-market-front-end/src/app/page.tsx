'use client';

import {
  AnimatedBackground,
  HeroSection,
  FeaturesSection,
  TrendingMarketsSection,
  StatsSection,
  CTASection,
  Footer,
} from '@/components/landing';

export default function HomePage() {
  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <div className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <TrendingMarketsSection />
        <StatsSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
