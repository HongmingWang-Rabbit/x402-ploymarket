'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { LANDING_CONFIG } from './constants';

function PlatformGrowthChart() {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold mb-4">Platform Growth</h3>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 400 200" fill="none">
          <line x1="0" y1="40" x2="400" y2="40" stroke="#374151" strokeDasharray="4" />
          <line x1="0" y1="80" x2="400" y2="80" stroke="#374151" strokeDasharray="4" />
          <line x1="0" y1="120" x2="400" y2="120" stroke="#374151" strokeDasharray="4" />
          <line x1="0" y1="160" x2="400" y2="160" stroke="#374151" strokeDasharray="4" />
          <path
            d="M0 160 C50 155 100 140 150 130 S250 90 300 60 S380 30 400 20"
            stroke="#8B5CF6"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M0 160 C50 155 100 140 150 130 S250 90 300 60 S380 30 400 20 V200 H0 Z"
            fill="url(#gradient)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 pt-2">
          <span>Jan</span>
          <span>Feb</span>
          <span>Mar</span>
          <span>Apr</span>
          <span>May</span>
          <span>Jun</span>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const { hero } = LANDING_CONFIG;

  return (
    <section className="py-16 lg:py-24">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-purple-400 font-medium">{hero.badge}</span>
          </div>

          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
            <span className="text-white">{hero.title.line1} </span>
            <span className="text-purple-400">{hero.title.highlight1}</span>
            <br />
            <span className="text-purple-400">{hero.title.highlight2}</span>
            <span className="text-white"> {hero.title.line2}</span>
          </h1>

          <p className="text-gray-400 text-lg mb-8 max-w-lg">{hero.description}</p>

          <div className="flex flex-wrap gap-4">
            <Link href="/markets">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                {hero.primaryCta}
              </Button>
            </Link>
            <Link href="/markets">
              <Button variant="outline" size="lg" className="border-gray-600 text-white hover:bg-gray-800">
                {hero.secondaryCta}
              </Button>
            </Link>
          </div>
        </div>

        <div className="hidden lg:block">
          <PlatformGrowthChart />
        </div>
      </div>
    </section>
  );
}
