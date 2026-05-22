import Link from 'next/link';
import { factions } from '@/data/world';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import GamePanel from '@/components/GamePanel';

export const metadata: Metadata = pageMetadata({
  title: 'Lore',
  description: 'The lore of Setera: the Chrono Stones, the gods, the factions, and the war that shaped the world of Chrono Odyssey.',
  path: '/world/lore',
});

export default function LorePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <Link href="/world" className="text-sm text-accent-gold-dim hover:text-accent-gold transition-colors mb-4 inline-block">
          &larr; World
        </Link>
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Chrono Odyssey Lore</h1>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      <section className="py-8 space-y-6">
        {factions.map((faction) => (
          <GamePanel key={faction.name} padding="p-6">
            <h2 className={`font-heading text-2xl ${faction.colour} mb-2`}>{faction.name}</h2>
            <p className="text-accent-gold-dim italic mb-4">&ldquo;{faction.tagline}&rdquo;</p>
            <p className="text-text-secondary leading-relaxed">{faction.description}</p>
          </GamePanel>
        ))}
      </section>
    </div>
  );
}
