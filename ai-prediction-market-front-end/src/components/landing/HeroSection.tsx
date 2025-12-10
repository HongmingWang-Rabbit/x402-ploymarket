'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { LANDING_CONFIG } from './constants';
import { useState, useEffect } from 'react';

// Static initial data to avoid hydration mismatch
const INITIAL_CHART_DATA = [
  { x: 0, y: 100 }, { x: 20, y: 95 }, { x: 40, y: 105 }, { x: 60, y: 90 },
  { x: 80, y: 110 }, { x: 100, y: 85 }, { x: 120, y: 115 }, { x: 140, y: 80 },
  { x: 160, y: 120 }, { x: 180, y: 75 }, { x: 200, y: 125 }, { x: 220, y: 70 },
  { x: 240, y: 130 }, { x: 260, y: 65 }, { x: 280, y: 135 }, { x: 300, y: 60 },
  { x: 320, y: 140 }, { x: 340, y: 55 }, { x: 360, y: 145 }, { x: 380, y: 50 },
];

function PlatformGrowthChart() {
  const [data, setData] = useState(INITIAL_CHART_DATA);

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prevData) => {
        const lastY = prevData[prevData.length - 1].y;
        const newY = Math.max(10, Math.min(190, lastY + Math.random() * 20 - 10));
        const newDataPoint = { x: 380, y: newY };
        const updatedData = [...prevData.slice(1), newDataPoint];
        return updatedData.map((p, i) => ({ ...p, x: i * 20 }));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const pathD = data.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');

  return (
    <div className="bg-gray-900/50 rounded-2xl p-6 border border-purple-900/30 shadow-2xl shadow-purple-500/10">
      <h3 className="text-white font-semibold mb-4 text-center">Protocol Volume</h3>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 400 200" fill="none">
          <defs>
            <filter id="glow">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d={pathD} stroke="#A78BFA" strokeWidth="2" fill="none" style={{ transition: 'd 0.5s linear' }} />
          <path
            d={`${pathD} V 200 H 0 Z`}
            fill="url(#gradient)"
            opacity="0.2"
            style={{ transition: 'd 0.5s linear' }}
          />
        </svg>
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
            <Link href="/propose">
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
