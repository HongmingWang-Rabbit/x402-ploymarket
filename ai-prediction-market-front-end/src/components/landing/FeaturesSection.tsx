'use client';

import { featureIcons, type FeatureIconType } from '@/components/icons';
import { LANDING_CONFIG } from './constants';
import { SectionHeader } from './SectionHeader';

interface FeatureCardProps {
  iconType: FeatureIconType;
  title: string;
  description: string;
}

function FeatureCard({ iconType, title, description }: FeatureCardProps) {
  const Icon = featureIcons[iconType];

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-colors">
      <div className="w-14 h-14 bg-gray-800 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-purple-400" />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section className="py-16">
      <SectionHeader
        title="Platform Features"
        description="Advanced technology for next-generation prediction markets"
      />

      <div className="grid md:grid-cols-3 gap-8">
        {LANDING_CONFIG.features.map((feature) => (
          <FeatureCard
            key={feature.id}
            iconType={feature.iconType}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
    </section>
  );
}
