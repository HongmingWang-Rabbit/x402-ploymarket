'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { LANDING_CONFIG } from './constants';

export function CTASection() {
  const { cta } = LANDING_CONFIG;

  return (
    <section className="py-16">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-12 text-center border border-gray-800">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">{cta.title}</h2>
        <p className="text-gray-400 mb-8 max-w-2xl mx-auto">{cta.description}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/markets">
            <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
              {cta.primaryButton}
            </Button>
          </Link>
          <Link href="/markets">
            <Button variant="outline" size="lg" className="border-gray-600 text-white hover:bg-gray-700">
              {cta.secondaryButton}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
