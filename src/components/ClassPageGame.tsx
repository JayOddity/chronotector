import Link from 'next/link';
import Image from 'next/image';
import type { GameClass } from '@/data/classes';
import GamePanel from './GamePanel';
import SectionHeader from './SectionHeader';

type Props = {
  cls: GameClass;
  otherClasses: GameClass[];
};

export default function ClassPageGame({ cls, otherClasses }: Props) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/classes"
        className="text-sm text-accent-gold-dim hover:text-accent-gold transition-colors mb-6 inline-block"
      >
        &larr; All Classes
      </Link>

      {/* Hero */}
      <GamePanel padding="p-0" className="overflow-hidden mb-10">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 md:gap-10 px-6 sm:px-10 py-10 items-center">
          <div className="relative mx-auto md:mx-0 w-[180px] h-[180px] rounded-full overflow-hidden border border-[rgba(200,168,78,0.45)] shadow-[0_0_24px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(200,168,78,0.12),transparent_70%)]" />
            <Image
              src={cls.image}
              alt={cls.name}
              fill
              className="object-cover object-top"
              sizes="180px"
              priority
            />
          </div>
          <div className="text-center md:text-left">
            <p className="text-[11px] tracking-[0.4em] text-accent-gold-dim uppercase mb-3">
              {cls.role}
            </p>
            <h1 className="font-heading text-5xl sm:text-6xl text-accent-gold leading-none mb-4 [text-shadow:0_2px_18px_rgba(200,168,78,0.25)]">
              {cls.name}
            </h1>
            <div className="game-rule mb-5 max-w-md mx-auto md:mx-0" />
            <p className="text-text-secondary text-lg max-w-xl mx-auto md:mx-0 mb-5 leading-relaxed">
              {cls.description}
            </p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              {cls.weapons.map((w) => (
                <span
                  key={w.name}
                  className="text-xs uppercase tracking-[0.18em] px-3 py-1.5 bg-black/40 border border-[rgba(200,168,78,0.4)] text-accent-gold-light"
                >
                  {w.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </GamePanel>

      {/* Lore */}
      <GamePanel seal className="mb-10">
        <p className="text-text-secondary leading-relaxed italic text-center text-lg max-w-3xl mx-auto">
          &ldquo;{cls.lore}&rdquo;
        </p>
      </GamePanel>

      {/* Resource + How it plays — two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 mb-10">
        <GamePanel>
          <SectionHeader title="Resource" />
          <p className="font-heading text-2xl text-accent-gold-light text-center mb-3">
            {cls.resource}
          </p>
          <div className="game-rule mb-4" />
          <p className="text-text-secondary leading-relaxed text-[15px]">
            {cls.resourceDescription}
          </p>
        </GamePanel>
        <GamePanel>
          <SectionHeader title="How it plays" />
          <div className="space-y-4">
            {cls.overview.split('\n\n').map((para, i) => (
              <p key={i} className="text-text-secondary leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        </GamePanel>
      </div>

      {/* Weapons */}
      <div className="mb-10">
        <SectionHeader title="Weapons" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cls.weapons.map((w) => (
            <GamePanel key={w.name} padding="p-5">
              <h3 className="font-heading text-xl text-accent-gold-light mb-1 text-center">
                {w.name}
              </h3>
              <p className="text-[10px] text-accent-gold-dim font-medium uppercase tracking-[0.25em] text-center mb-3">
                {w.tagline}
              </p>
              <div className="game-rule mb-4" />
              <p className="text-text-secondary leading-relaxed text-sm">
                {w.description}
              </p>
            </GamePanel>
          ))}
        </div>
      </div>

      {/* Build directions */}
      <div className="mb-10">
        <SectionHeader title="Build directions" />
        <p className="text-text-muted text-sm mb-5 max-w-3xl">
          Per the developers&rsquo; post beta notes, each weapon will get four progression paths in
          the upcoming Matrix system, twelve builds per class in total. Final paths aren&rsquo;t
          published yet; these are the rough shapes players are likely to settle into.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cls.buildDirections.map((b) => (
            <GamePanel key={b.name} padding="p-5">
              <h3 className="font-heading text-lg text-accent-gold mb-2">{b.name}</h3>
              <div className="game-rule mb-3" />
              <p className="text-text-secondary leading-relaxed text-sm">{b.description}</p>
            </GamePanel>
          ))}
        </div>
      </div>

      {/* Class Mastery */}
      {cls.classMastery && (
        <div className="mb-10">
          <SectionHeader title="Class Mastery" />
          <p className="text-text-muted text-sm mb-5 max-w-3xl">
            Seven cross weapon abilities that belong to the class itself rather than any single
            weapon. Three actives (unlocked at Lv 15) and four passives (Lv 10 and Lv 20). These
            remain available regardless of which weapon you have equipped.
          </p>
          <GamePanel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cls.classMastery.map((m) => {
                const isActive = m.type === 'Active';
                return (
                  <div
                    key={m.name}
                    className={`flex items-center gap-3 px-3 py-2.5 bg-black/40 border-l-2 ${
                      isActive ? 'border-amber-400' : 'border-[rgba(200,168,78,0.4)]'
                    }`}
                  >
                    <span
                      className={`text-[10px] uppercase tracking-[0.2em] font-medium w-14 shrink-0 ${
                        isActive ? 'text-amber-400' : 'text-accent-gold-dim'
                      }`}
                    >
                      {m.type}
                    </span>
                    <span className="font-heading text-text-primary text-sm flex-1">
                      {m.name}
                    </span>
                    <span className="text-xs text-text-muted shrink-0">Lv {m.unlockLevel}</span>
                  </div>
                );
              })}
            </div>
          </GamePanel>
        </div>
      )}

      {/* Other classes */}
      <section className="py-8">
        <div className="diamond-divider mb-6">
          <span className="diamond" />
        </div>
        <h2 className="font-heading text-xl text-accent-gold mb-4 text-center tracking-[0.2em] uppercase">
          Other Classes
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {otherClasses.map((c) => (
            <Link
              key={c.slug}
              href={`/classes/${c.slug}`}
              className="flex flex-col items-center bg-card-bg border border-border-subtle rounded-lg overflow-hidden hover:border-accent-gold-dim transition-colors group"
            >
              <div className="relative w-full aspect-square bg-dark-surface">
                <Image
                  src={c.image}
                  alt={c.name}
                  fill
                  className="object-contain object-top"
                  sizes="20vw"
                />
              </div>
              <span className="font-heading text-sm text-text-primary group-hover:text-accent-gold transition-colors p-3">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
