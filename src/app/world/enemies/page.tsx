import Link from 'next/link';
import { factions } from '@/data/world';
import { bestiary, monsterSouls, type EnemyGrade } from '@/data/bestiary';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import GamePanel from '@/components/GamePanel';
import SectionHeader from '@/components/SectionHeader';

export const metadata: Metadata = pageMetadata({
  title: 'Enemies',
  description: 'Bestiary of monsters, bosses, and faction enemies in Chrono Odyssey.',
  path: '/world/enemies',
});

const gradeColors: Record<EnemyGrade, string> = {
  HighBoss: 'text-red-400 border-red-500/40 bg-red-950/30',
  MidBoss: 'text-orange-400 border-orange-500/40 bg-orange-950/30',
  LowBoss: 'text-amber-400 border-amber-500/40 bg-amber-950/30',
  Elite: 'text-purple-400 border-purple-500/40 bg-purple-950/30',
  Named: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30',
  Normal: 'text-text-muted border-border-subtle bg-dark-surface',
};

const gradeLabels: Record<EnemyGrade, string> = {
  HighBoss: 'World Boss',
  MidBoss: 'Mid Boss',
  LowBoss: 'Field Boss',
  Elite: 'Elite',
  Named: 'Named',
  Normal: 'Normal',
};

const enemyFactionLore = factions.filter((f) =>
  ['The Guardians', 'The Void', 'The Broken', 'The Outcasts'].includes(f.name)
);

const GRADE_RANK: Record<EnemyGrade, number> = {
  HighBoss: 5, MidBoss: 4, LowBoss: 3, Named: 2, Elite: 1, Normal: 0,
};

// Strip raw datamined prefixes/suffixes ("Field Boss X", "X_Red", "X Boss", etc.) for display.
function cleanName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(field boss|dungeon|giant|forest queen)\s+/i, '')
    .replace(/\s+(boss|red|varied weapon)$/i, '')
    .trim();
}

function canonicalKey(name: string): string {
  return cleanName(name).toLowerCase();
}

// Pick the cleanest display name across all variants. Prefer ones that already look clean
// (no underscore, no datamined prefix); otherwise fall back to a cleaned form.
function pickDisplayName(variants: string[]): string {
  const clean = variants
    .filter((n) => !/_/.test(n) && !/^(field boss|dungeon|giant|forest queen)\s+/i.test(n) && !/\s+(boss|red|varied weapon)$/i.test(n))
    .sort((a, b) => a.length - b.length);
  if (clean[0]) return clean[0];
  return cleanName(variants[0]);
}

function dedupeEntries(entries: { name: string; grade: EnemyGrade }[]) {
  const groups = new Map<string, { name: string; grade: EnemyGrade; variants: string[] }>();
  for (const e of entries) {
    const key = canonicalKey(e.name);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { name: pickDisplayName([e.name]), grade: e.grade, variants: [e.name] });
    } else {
      existing.variants.push(e.name);
      if (GRADE_RANK[e.grade] > GRADE_RANK[existing.grade]) {
        existing.grade = e.grade;
      }
      existing.name = pickDisplayName(existing.variants);
    }
  }
  return [...groups.values()].map(({ name, grade }) => ({ name, grade }));
}

export default function EnemiesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <Link href="/world" className="text-sm text-accent-gold-dim hover:text-accent-gold transition-colors mb-4 inline-block">
          &larr; World
        </Link>
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Enemies</h1>
        <p className="text-text-secondary max-w-3xl">
          A datamined catalogue of the hostile creatures, bandits, and otherworldly horrors of Setera. Names are extracted from the game files and may change before launch.
        </p>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      {/* Faction lore */}
      <section className="py-8 space-y-6">
        <SectionHeader title="Hostile Factions" />
        {enemyFactionLore.map((faction) => (
          <GamePanel key={faction.name} padding="p-6">
            <h3 className={`font-heading text-xl ${faction.colour} mb-2`}>{faction.name}</h3>
            <p className="text-accent-gold-dim italic text-sm mb-3">&ldquo;{faction.tagline}&rdquo;</p>
            <p className="text-text-secondary leading-relaxed">{faction.description}</p>
          </GamePanel>
        ))}
      </section>

      {/* Monster Souls */}
      <section className="py-8">
        <SectionHeader title="Monster Souls" />
        <p className="text-text-muted text-sm mb-4 max-w-3xl">
          Slaying certain creatures lets you bind their soul as a summonable specter that fights alongside you. Currently five souls have been datamined.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {monsterSouls.map((soul) => (
            <GamePanel key={soul.name} padding="p-5">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-heading text-lg text-accent-gold">{soul.name}</h3>
                <span className="text-xs text-text-muted">Lv. {soul.level} &middot; {soul.grade}</span>
              </div>
              <p className="text-text-secondary italic leading-relaxed text-sm mb-3">&ldquo;{soul.lore}&rdquo;</p>
              <div className="flex gap-3 text-xs text-text-muted">
                <span>ATK <span className="text-text-primary">{soul.attack}</span></span>
                <span>HP <span className="text-text-primary">{soul.hp.toLocaleString()}</span></span>
              </div>
            </GamePanel>
          ))}
        </div>
      </section>

      {/* Bestiary */}
      <section className="py-8 space-y-8">
        <div>
          <SectionHeader title="Bestiary" />
          <p className="text-text-muted text-sm max-w-3xl">
            Grouped by faction. Bosses surface first (World &gt; Mid &gt; Field), then Elites, then standard mobs. Variant suffixes (e.g. &ldquo;1.2&rdquo; difficulty tiers) collapsed into the strongest version.
          </p>
        </div>
        {bestiary.map((faction) => {
          const bossGrades: EnemyGrade[] = ['HighBoss', 'MidBoss', 'LowBoss', 'Named'];
          const cleaned = dedupeEntries(faction.entries);
          const bosses = cleaned.filter((e) => bossGrades.includes(e.grade));
          const elites = cleaned.filter((e) => e.grade === 'Elite');
          const normals = cleaned.filter((e) => e.grade === 'Normal');
          return (
            <GamePanel key={faction.key} padding="p-6">
              <h3 className="font-heading text-xl text-accent-gold mb-1">{faction.name}</h3>
              <p className="text-text-muted text-sm mb-4">{faction.description}</p>

              {bosses.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Bosses ({bosses.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {bosses.map((e) => (
                      <span key={e.name} className={`text-sm px-3 py-1 border rounded ${gradeColors[e.grade]}`} title={gradeLabels[e.grade]}>
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {elites.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Elites ({elites.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {elites.map((e) => (
                      <span key={e.name} className={`text-xs px-2 py-1 border rounded ${gradeColors[e.grade]}`}>
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {normals.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-accent-gold-dim">
                    Standard mobs ({normals.length})
                  </summary>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {normals.map((e) => (
                      <span key={e.name} className="text-xs px-2 py-1 border rounded text-text-muted border-border-subtle bg-dark-surface">
                        {e.name}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </GamePanel>
          );
        })}
      </section>
    </div>
  );
}
