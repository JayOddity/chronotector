import { Suspense } from 'react';
import type { Metadata } from 'next';
import TalentCalculator from './TalentCalculator';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Talent Calculator',
  description:
    'Plan a Chrono Odyssey build with weapon mastery trees and class mastery skills across all six classes.',
  path: '/talent-calculator',
});

export default function TalentCalculatorPage() {
  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
      <h1 className="font-heading text-2xl sm:text-3xl text-accent-gold mb-3">
        Talent Calculator
      </h1>
      <Suspense fallback={<div className="text-text-muted text-sm">Loading calculator…</div>}>
        <TalentCalculator />
      </Suspense>
      <p className="text-text-muted text-xs mt-4 text-center">
        Data sourced from the June 2025 closed beta.
      </p>
    </main>
  );
}
