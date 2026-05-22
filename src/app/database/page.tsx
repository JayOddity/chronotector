import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { items } from '@/data/items';
import type { ItemListEntry } from '@/data/items';
import ItemFilters from '@/components/database/ItemFilters';
import ItemGrid from '@/components/database/ItemGrid';
import {
  getMonsterSummaries,
  formatLevelRange,
  GRADE_COLORS,
  GRADE_LABELS,
  type MonsterSummary,
} from '@/data/monsters';
import { getNpcSummaries, type NpcSummary } from '@/data/npcs';
import { pageMetadata } from '@/lib/metadata';

const ITEMS_PER_PAGE = 100;
const BESTIARY_PER_PAGE = 100;
const NPCS_PER_PAGE = 100;

type DatabaseType = 'items' | 'enemies' | 'npcs';

const gradeOrder: Record<string, number> = {
  Legendary: 0, Epic: 1, Rare: 2, Uncommon: 3, Common: 4,
};

export const metadata: Metadata = pageMetadata({
  title: 'Database',
  description: 'Browse items, enemies and NPCs from the Chrono Odyssey closed beta. Filter by category, grade, and more.',
  path: '/database',
});

function resolveType(raw: string | undefined): DatabaseType {
  if (raw === 'enemies' || raw === 'monsters') return 'enemies';
  if (raw === 'npcs') return 'npcs';
  return 'items';
}

function filterItems(
  searchParams: Record<string, string | undefined>,
): { items: ItemListEntry[]; total: number; page: number; totalPages: number } {
  const search = (searchParams.q || '').toLowerCase();
  const category = searchParams.category || '';
  const grade = searchParams.grade || '';
  const tier = searchParams.tier || '';
  const sort = searchParams.sort || 'name';
  const source = searchParams.source || '';
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));

  let result = items;

  if (search) result = result.filter((i) => i.name.toLowerCase().includes(search));
  if (category) result = result.filter((i) => i.category === category);
  if (grade) result = result.filter((i) => i.grade === grade);
  if (tier) result = result.filter((i) => i.tier === parseInt(tier, 10));
  if (source) result = result.filter((i) => i.sources.includes(source));

  result = [...result];
  switch (sort) {
    case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
    case 'type': result.sort((a, b) => a.typeDisplay.localeCompare(b.typeDisplay) || a.name.localeCompare(b.name)); break;
    case 'type-desc': result.sort((a, b) => b.typeDisplay.localeCompare(a.typeDisplay) || a.name.localeCompare(b.name)); break;
    case 'grade': result.sort((a, b) => (gradeOrder[a.grade] ?? 5) - (gradeOrder[b.grade] ?? 5) || a.name.localeCompare(b.name)); break;
    case 'grade-desc': result.sort((a, b) => (gradeOrder[b.grade] ?? 5) - (gradeOrder[a.grade] ?? 5) || a.name.localeCompare(b.name)); break;
    case 'tier-asc': result.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)); break;
    case 'tier-desc': result.sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name)); break;
    case 'gs-asc': result.sort((a, b) => a.gearScoreMin - b.gearScoreMin || a.name.localeCompare(b.name)); break;
    case 'gs-desc': result.sort((a, b) => b.gearScoreMin - a.gearScoreMin || a.name.localeCompare(b.name)); break;
    case 'source': result.sort((a, b) => (a.sources[0] || 'zzz').localeCompare(b.sources[0] || 'zzz') || a.name.localeCompare(b.name)); break;
    case 'source-desc': result.sort((a, b) => (b.sources[0] || '').localeCompare(a.sources[0] || '') || a.name.localeCompare(b.name)); break;
  }

  const totalPages = Math.ceil(result.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(page, totalPages);
  const pageItems = result.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  return { items: pageItems, total: result.length, page: safePage, totalPages };
}

function filterEnemies(
  searchParams: Record<string, string | undefined>,
): { monsters: MonsterSummary[]; total: number; page: number; totalPages: number } {
  const q = (searchParams.q || '').toLowerCase().trim();
  const gradeFilter = searchParams.grade || '';
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));

  let result = getMonsterSummaries();
  if (q) result = result.filter((m) => m.name.toLowerCase().includes(q));
  if (gradeFilter) result = result.filter((m) => m.grade === gradeFilter);

  const totalPages = Math.ceil(result.length / BESTIARY_PER_PAGE) || 1;
  const safePage = Math.min(page, totalPages);
  const monsters = result.slice((safePage - 1) * BESTIARY_PER_PAGE, safePage * BESTIARY_PER_PAGE);
  return { monsters, total: result.length, page: safePage, totalPages };
}

function filterNpcs(
  searchParams: Record<string, string | undefined>,
): { npcs: NpcSummary[]; total: number; page: number; totalPages: number } {
  const q = (searchParams.q || '').toLowerCase().trim();
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));

  let result = getNpcSummaries();
  if (q) result = result.filter((n) => n.name.toLowerCase().includes(q));

  const totalPages = Math.ceil(result.length / NPCS_PER_PAGE) || 1;
  const safePage = Math.min(page, totalPages);
  const npcs = result.slice((safePage - 1) * NPCS_PER_PAGE, safePage * NPCS_PER_PAGE);
  return { npcs, total: result.length, page: safePage, totalPages };
}

const ENEMY_GRADE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All grades' },
  { value: 'HighBoss', label: 'High Boss' },
  { value: 'MidBoss', label: 'Mid Boss' },
  { value: 'LowBoss', label: 'Low Boss' },
  { value: 'Named', label: 'Named' },
  { value: 'Elite', label: 'Elite' },
  { value: 'Normal', label: 'Normal' },
];

function buildHref(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged: Record<string, string | undefined> = { ...base, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/database?${qs}` : '/database';
}

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const type = resolveType(params.type);

  const enemyCount = getMonsterSummaries().length;
  const npcCount = getNpcSummaries().length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-accent-gold mb-2">Chrono Odyssey Database</h1>
        <p className="text-text-muted text-sm">
          {type === 'items' && `${items.length.toLocaleString()} items datamined from the Chrono Odyssey closed beta (June 2025). `}
          {type === 'enemies' && `${enemyCount.toLocaleString()} creatures with an open world spawn, from the June 2025 CBT data. `}
          {type === 'npcs' && `${npcCount.toLocaleString()} NPCs placed in Setera, from the June 2025 CBT data. `}
          Stats and data are subject to change before release.{' '}
          <Link href="/database/systems" className="text-accent-gold-dim hover:text-accent-gold underline">
            See item systems &rarr;
          </Link>
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <TabLink href="/database" active={type === 'items'} label="Items" count={items.length} />
        <TabLink href="/database?type=enemies" active={type === 'enemies'} label="Enemies" count={enemyCount} />
        <TabLink href="/database?type=npcs" active={type === 'npcs'} label="NPCs" count={npcCount} />
      </div>

      {type === 'items' && <ItemsView params={params} />}
      {type === 'enemies' && <EnemiesView params={params} />}
      {type === 'npcs' && <NpcsView params={params} />}
    </main>
  );
}

function TabLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={
        'px-3 py-1.5 rounded border text-sm transition-colors ' +
        (active
          ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
          : 'border-border-subtle text-text-muted hover:border-accent-gold hover:text-white')
      }
    >
      {label}
      <span className="ml-2 text-xs opacity-70">{count.toLocaleString()}</span>
    </Link>
  );
}

function ItemsView({ params }: { params: Record<string, string | undefined> }) {
  const { items: pageItems, total, page, totalPages } = filterItems(params);
  return (
    <>
      <Suspense fallback={<div className="text-text-muted">Loading filters...</div>}>
        <div className="mb-6">
          <ItemFilters />
        </div>
      </Suspense>
      <ItemGrid items={pageItems} total={total} page={page} totalPages={totalPages} />
    </>
  );
}

function EnemiesView({ params }: { params: Record<string, string | undefined> }) {
  const { monsters, total, page, totalPages } = filterEnemies(params);

  return (
    <>
      <form method="get" className="mb-6 grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
        <input type="hidden" name="type" value="enemies" />
        <input
          type="text"
          name="q"
          defaultValue={params.q || ''}
          placeholder="Search enemies..."
          className="bg-dark-surface border border-border-subtle rounded px-3 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-accent-gold"
        />
        <select
          name="grade"
          defaultValue={params.grade || ''}
          className="bg-dark-surface border border-border-subtle rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-gold"
        >
          {ENEMY_GRADE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </form>

      <div className="mb-3 text-xs text-text-muted">
        Showing {monsters.length} of {total.toLocaleString()} results
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-deep-night text-left text-text-muted uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-2 font-normal">Name</th>
              <th className="px-4 py-2 font-normal">Grade</th>
              <th className="px-4 py-2 font-normal">Level</th>
              <th className="px-4 py-2 font-normal text-right">Locations</th>
              <th className="px-4 py-2 font-normal text-right">Spawns</th>
            </tr>
          </thead>
          <tbody>
            {monsters.map((m) => {
              const color = GRADE_COLORS[m.grade] ?? '#94a3b8';
              const lv = formatLevelRange(m.levelMin, m.levelMax);
              return (
                <tr key={m.monsterId} className="border-t border-border-subtle hover:bg-dark-surface/60">
                  <td className="px-4 py-2">
                    <Link href={`/database/monsters/${m.monsterId}`} className="text-white hover:text-accent-gold">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
                    >
                      {GRADE_LABELS[m.grade] ?? m.grade}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-text-muted text-xs">{lv ?? '\u2014'}</td>
                  <td className="px-4 py-2 text-right text-text-muted">{m.pinCount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-text-muted">{m.totalSpawns.toLocaleString()}</td>
                </tr>
              );
            })}
            {monsters.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-muted">No enemies match that filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pager params={params} page={page} totalPages={totalPages} />
      )}
    </>
  );
}

function NpcsView({ params }: { params: Record<string, string | undefined> }) {
  const { npcs, total, page, totalPages } = filterNpcs(params);

  return (
    <>
      <form method="get" className="mb-6">
        <input type="hidden" name="type" value="npcs" />
        <input
          type="text"
          name="q"
          defaultValue={params.q || ''}
          placeholder="Search NPCs..."
          className="w-full bg-dark-surface border border-border-subtle rounded px-3 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-accent-gold"
        />
      </form>

      <div className="mb-3 text-xs text-text-muted">
        Showing {npcs.length} of {total.toLocaleString()} results
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-deep-night text-left text-text-muted uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-2 font-normal">Name</th>
              <th className="px-4 py-2 font-normal text-right">Regions</th>
              <th className="px-4 py-2 font-normal text-right">Locations</th>
            </tr>
          </thead>
          <tbody>
            {npcs.map((n) => (
              <tr key={n.characterId} className="border-t border-border-subtle hover:bg-dark-surface/60">
                <td className="px-4 py-2">
                  <Link href={`/database/npcs/${n.characterId}`} className="text-white hover:text-accent-gold">
                    {n.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right text-text-muted">{n.regionIds.length.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-text-muted">{n.pinCount.toLocaleString()}</td>
              </tr>
            ))}
            {npcs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-text-muted">No NPCs match that search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pager params={params} page={page} totalPages={totalPages} />
      )}
    </>
  );
}

function Pager({ params, page, totalPages }: { params: Record<string, string | undefined>; page: number; totalPages: number }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <div className="text-text-muted">Page {page} of {totalPages}</div>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={buildHref(params, { page: String(page - 1) })} className="px-3 py-1 rounded border border-border-subtle text-white hover:border-accent-gold">Previous</Link>
        )}
        {page < totalPages && (
          <Link href={buildHref(params, { page: String(page + 1) })} className="px-3 py-1 rounded border border-border-subtle text-white hover:border-accent-gold">Next</Link>
        )}
      </div>
    </div>
  );
}
