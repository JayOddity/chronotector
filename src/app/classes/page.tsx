import Link from 'next/link';
import Image from 'next/image';
import { classes } from '@/data/classes';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Classes',
  description: 'All six playable classes in Chrono Odyssey: Assassin, Berserker, Paladin, Ranger, Sorcerer, and Swordsman.',
  path: '/classes',
});

export default function ClassesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Chrono Odyssey Classes</h1>
        <p className="text-text-secondary max-w-3xl">
          Chrono Odyssey features six playable classes, each with three weapons swappable mid combat on a 0.25s cooldown. Each weapon has eight abilities (four active at a time). Classes use unique resources: Rage, Vigor, Mana, Bloodlust, and Arrows.
        </p>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      <section className="py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <Link
              key={cls.slug}
              href={`/classes/${cls.slug}`}
              className="game-panel flex flex-col overflow-hidden glow-gold-hover group transition-colors"
            >
              <span className="game-corner game-corner--tl" />
              <span className="game-corner game-corner--tr" />
              <span className="game-corner game-corner--bl" />
              <span className="game-corner game-corner--br" />
              <div className="relative aspect-square bg-black/30 overflow-hidden">
                <Image src={cls.image} alt={cls.name} fill className="object-contain object-top group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
              </div>
              <div className="p-5 relative z-[1]">
                <h2 className="font-heading text-xl text-text-primary group-hover:text-accent-gold transition-colors mb-1">
                  {cls.name}
                </h2>
                <p className="text-xs text-accent-gold-dim font-medium uppercase tracking-wider mb-3">{cls.role}</p>
                <p className="text-sm text-text-muted line-clamp-3">{cls.description}</p>
                <div className="flex gap-2 mt-3">
                  {cls.weapons.map((w) => (
                    <span key={w.name} className="text-xs px-2 py-1 bg-black/40 border border-[rgba(200,168,78,0.4)] rounded text-text-muted">
                      {w.name}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
