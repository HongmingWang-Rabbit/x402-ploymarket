'use client';

import { LANDING_CONFIG } from './constants';

export function StatsSection() {
  return (
    <section className="py-16">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {LANDING_CONFIG.stats.map((stat) => (
          <div key={stat.id} className="text-center">
            <div className={`text-4xl lg:text-5xl font-bold mb-2 ${stat.colorClass}`}>
              {stat.value}
            </div>
            <div className="text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
