import type { Metadata } from 'next';
import { dungeonTypes } from '@/data/dungeons';
import { pageMetadata } from '@/lib/metadata';
import GamePanel from '@/components/GamePanel';

export const metadata: Metadata = pageMetadata({
  title: 'Dungeons',
  description: 'Expeditions, raids, labyrinths, trials and Chrono Gates of Setera.',
  path: '/dungeons',
});

// Drop entries that are obvious datamined placeholders or test rows.
function isPlaceholder(name: string): boolean {
  if (/^Trial: Boss Title \d+$/i.test(name)) return true;
  if (/^Mini Dungeon \d+$/i.test(name)) return true;
  if (/^\(Eden\) Cave test dungeon/i.test(name)) return true;
  return false;
}

// A few raw datamined labels are bare faction nouns. Rephrase to match site voice.
const NAME_OVERRIDES: Record<string, string> = {
  Broken: 'The Broken',
  Guardian: 'The Guardian',
  Outcast: 'The Outcast',
};

function displayName(name: string): string {
  return NAME_OVERRIDES[name] ?? name;
}

const cleanedDungeonTypes = dungeonTypes
  .map((t) => ({
    ...t,
    entries: t.entries.filter((e) => !isPlaceholder(e.name)),
  }))
  .filter((t) => t.entries.length > 0);

export default function DungeonsPage() {
  const totalCount = cleanedDungeonTypes.reduce((s, t) => s + t.entries.length, 0);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Dungeons</h1>
        <p className="text-text-secondary max-w-3xl mb-2">
          Chrono Odyssey&rsquo;s instanced content spans solo trials, party expeditions, and a single raid. Most named dungeons fall into one of the categories below.
        </p>
        <p className="text-text-muted text-sm max-w-3xl">
          {totalCount} named instances are present in the current data. Some category names (e.g. Labyrinths) are being actively redesigned per the developers&rsquo; post beta notes, so structure may shift before launch.
        </p>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      <section className="py-8 space-y-6">
        {cleanedDungeonTypes.map((dt) => (
          <GamePanel key={dt.type} padding="p-6">
            <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
              <h2 className="font-heading text-xl text-accent-gold">{dt.label}</h2>
              <span className="text-xs text-text-muted">{dt.entries.length} {dt.entries.length === 1 ? 'instance' : 'instances'}</span>
            </div>
            <p className="text-text-secondary text-sm mb-4">{dt.description}</p>
            <details open={dt.entries.length <= 12}>
              <summary className="cursor-pointer text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-accent-gold-dim">
                List
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                {dt.entries.map((e) => (
                  <div key={e.name} className="bg-black/40 border border-[rgba(200,168,78,0.25)] rounded p-2 text-sm flex justify-between gap-2">
                    <span className="text-text-secondary truncate">{displayName(e.name)}</span>
                    <span className="text-xs text-text-muted shrink-0">{e.max === 1 ? 'Solo' : `1-${e.max}p`}</span>
                  </div>
                ))}
              </div>
            </details>
          </GamePanel>
        ))}
      </section>
    </div>
  );
}
