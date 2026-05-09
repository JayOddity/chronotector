import Link from 'next/link';
import { features } from '@/data/features';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import GameCorners from '@/components/GameCorners';

export const metadata: Metadata = pageMetadata({
  title: 'Features',
  description: 'Chrono Odyssey features: combat, crafting, gameplay, PvP, and PvE.',
  path: '/features',
});

export default function FeaturesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Features</h1>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      <section className="py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="game-panel flex flex-col p-6 transition-colors glow-gold-hover group"
            >
              <GameCorners />
              <h2 className="relative z-[1] font-heading text-xl text-text-primary group-hover:text-accent-gold transition-colors mb-2">
                {feature.name}
              </h2>
              <p className="relative z-[1] text-sm text-text-muted">{feature.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
