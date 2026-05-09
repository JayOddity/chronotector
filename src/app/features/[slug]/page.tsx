import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { features, getFeatureBySlug } from '@/data/features';
import { gradeTextColor } from '@/components/database/GradeBadge';
import { ProfessionsFeatureLayout } from '@/components/features/ProfessionsFeatureLayout';
import { getItemSlug } from '@/data/item-slugs';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import JsonLd from '@/components/JsonLd';
import { breadcrumbSchema } from '@/lib/schema';
import GamePanel from '@/components/GamePanel';
import GameCorners from '@/components/GameCorners';
import SectionHeader from '@/components/SectionHeader';

export function generateStaticParams() {
  return features.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) return {};
  return pageMetadata({
    title: feature.name,
    description: feature.tagline,
    path: `/features/${feature.slug}`,
  });
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) notFound();

  const otherFeatures = features.filter((f) => f.slug !== slug);

  if (feature.slug === 'professions') {
    return <ProfessionsFeatureLayout feature={feature} otherFeatures={otherFeatures} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
          { name: feature.name, path: `/features/${feature.slug}` },
        ])}
      />
      <section className="pt-8 pb-4">
        <Link href="/features" className="text-sm text-accent-gold-dim hover:text-accent-gold transition-colors mb-4 inline-block">
          &larr; All Features
        </Link>
        <h1 className="font-heading text-4xl text-accent-gold mb-2">{feature.name}</h1>
        <p className="text-text-secondary max-w-3xl mb-4">{feature.tagline}</p>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      <section className="py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {feature.sections.map((section) => (
          <GamePanel
            key={section.heading}
            padding={section.image ? 'p-0' : 'p-5'}
            className={section.fullWidth ? 'md:col-span-2' : ''}
          >
            {section.image && (
              <figure className="mb-4">
                <div className="relative w-full overflow-hidden border-b border-[rgba(200,168,78,0.25)]">
                  <Image
                    src={section.image.src}
                    alt={section.image.alt}
                    width={1600}
                    height={900}
                    className="w-full h-auto"
                    sizes="(max-width: 768px) 100vw, 600px"
                  />
                </div>
                {section.image.caption && (
                  <figcaption className="px-5 pt-3 text-xs text-text-muted italic">{section.image.caption}</figcaption>
                )}
              </figure>
            )}
            <div className={section.image ? 'px-5 pb-5' : ''}>
              <h2 className="font-heading text-lg text-accent-gold mb-2">{section.heading}</h2>
              <p className="text-text-secondary text-sm leading-relaxed">{section.body}</p>
            </div>
          </GamePanel>
        ))}
      </section>

      {feature.gallery && feature.gallery.length > 0 && (
        <section className="py-4">
          <SectionHeader title="Post Beta Changes" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feature.gallery.map((img) => (
              <GamePanel key={img.src} padding="p-0" className="overflow-hidden">
                <figure>
                  <div className="relative w-full">
                    <Image
                      src={img.src}
                      alt={img.alt}
                      width={1600}
                      height={900}
                      className="w-full h-auto"
                      sizes="(max-width: 768px) 100vw, 600px"
                    />
                  </div>
                  {img.caption && (
                    <figcaption className="p-4 text-xs text-text-muted italic">{img.caption}</figcaption>
                  )}
                </figure>
              </GamePanel>
            ))}
          </div>
        </section>
      )}

      {feature.subPages && (
        <section className="py-4">
          <SectionHeader title="Jump to" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feature.subPages.map((sp) => (
              <Link
                key={sp.slug}
                href={`/features/${feature.slug}/${sp.slug}`}
                className="game-panel group block p-5 transition-colors glow-gold-hover"
              >
                <GameCorners />
                <div className="relative z-[1]">
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="font-heading text-xl text-accent-gold transition-colors">{sp.name}</h3>
                    <span className="text-accent-gold-dim group-hover:text-accent-gold transition-colors">&rarr;</span>
                  </div>
                  <p className="text-text-muted text-sm">{sp.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {feature.professions && (() => {
        const crafting = feature.professions.filter((p) => p.type === 'Crafting');
        const gathering = feature.professions.filter((p) => p.type === 'Gathering');
        return (
          <section className="py-4">
            <SectionHeader title="Professions" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Crafting', rows: crafting, col: 'Recipes' },
                { label: 'Gathering', rows: gathering, col: 'Tool' },
              ].map((group) => (
                <GamePanel key={group.label} padding="p-0" className="overflow-hidden">
                  <div className="px-4 py-2.5 bg-black/40 border-b border-[rgba(200,168,78,0.3)]">
                    <span className="font-heading text-sm text-accent-gold uppercase tracking-wider">{group.label}</span>
                    <span className="text-text-muted text-xs ml-2">{group.rows.length} lines</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[rgba(200,168,78,0.2)]">
                        <th className="text-left px-4 py-2 font-heading text-accent-gold-dim text-xs uppercase tracking-wider">Profession</th>
                        <th className="text-left px-4 py-2 font-heading text-accent-gold-dim text-xs uppercase tracking-wider">{group.col}</th>
                        <th className="text-right px-4 py-2 font-heading text-accent-gold-dim text-xs uppercase tracking-wider">Max Lv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((p) => (
                        <tr key={p.name} className="border-b border-[rgba(200,168,78,0.12)] last:border-0 hover:bg-black/30 transition-colors">
                          <td className="px-4 py-2.5 text-text-primary font-medium text-sm">{p.name}</td>
                          <td className="px-4 py-2.5 text-text-secondary text-sm">{p.tool ?? `${p.recipeCount?.toLocaleString()} recipes`}</td>
                          <td className="px-4 py-2.5 text-text-secondary text-sm text-right">{p.maxLevel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GamePanel>
              ))}
            </div>
          </section>
        );
      })()}

      {feature.pvpTerritories && (
        <section className="py-4">
          <SectionHeader title="Siege Territories" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feature.pvpTerritories.map((t) => (
              <GamePanel key={t.name} padding="p-4">
                <div className="font-heading text-accent-gold">{t.name}</div>
                <div className="text-xs text-text-muted uppercase tracking-wider mt-1">{t.recommendedLevels}</div>
              </GamePanel>
            ))}
          </div>
        </section>
      )}

      {feature.siegeCamps && (
        <section className="py-4">
          <SectionHeader title="Siege Camps" />
          <GamePanel padding="p-0" className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(200,168,78,0.2)]">
                  <th className="text-left p-3 font-heading text-accent-gold text-sm">Tier</th>
                  <th className="text-left p-3 font-heading text-accent-gold text-sm">Cost</th>
                  <th className="text-left p-3 font-heading text-accent-gold text-sm">Weapon Limit</th>
                </tr>
              </thead>
              <tbody>
                {feature.siegeCamps.map((c) => (
                  <tr key={c.tier} className="border-b border-[rgba(200,168,78,0.12)] last:border-0">
                    <td className="p-3 text-text-primary font-medium">Tier {c.tier}</td>
                    <td className="p-3 text-text-secondary text-sm">{c.cost.toLocaleString()} gold</td>
                    <td className="p-3 text-text-secondary text-sm">{c.weaponLimit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GamePanel>
        </section>
      )}

      {feature.wantedSystem && (
        <section className="py-4">
          <SectionHeader title="Wanted System" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <GamePanel padding="p-3" className="text-center">
              <div className="text-2xl font-heading text-accent-gold">{feature.wantedSystem.totalBounties}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Bounties</div>
            </GamePanel>
            <GamePanel padding="p-3" className="text-center">
              <div className="text-2xl font-heading text-accent-gold">{feature.wantedSystem.bountyLevels}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Difficulty</div>
            </GamePanel>
            <GamePanel padding="p-3" className="text-center">
              <div className="text-2xl font-heading text-accent-gold">{feature.wantedSystem.rankLevels}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Player Ranks</div>
            </GamePanel>
            <GamePanel padding="p-3" className="text-center">
              <div className="text-sm font-heading text-accent-gold">{feature.wantedSystem.topRankBonus}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Cap Bonus</div>
            </GamePanel>
          </div>
        </section>
      )}

      {feature.featuredCrafted && (
        <section className="py-4">
          <SectionHeader title="Featured crafted items" />
          <p className="text-text-muted text-sm mb-4 max-w-3xl">
            A small slice from the {feature.featuredCrafted.reduce((n, g) => n + g.items.length, 0)} item pool we have indexed. Click a name to open its item tooltip and full crafting breakdown.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feature.featuredCrafted.map((group) => (
              <GamePanel key={group.profession} padding="p-0" className="overflow-hidden">
                <div className="px-4 py-2.5 bg-black/40 border-b border-[rgba(200,168,78,0.3)]">
                  <span className="font-heading text-sm text-accent-gold uppercase tracking-wider">{group.profession}</span>
                  <span className="text-text-muted text-xs ml-2">{group.items.length}</span>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={`/database/${getItemSlug(item.id) ?? item.id}`}
                      className={`inline-flex items-center px-2.5 py-1 text-sm rounded border border-[rgba(200,168,78,0.3)] bg-black/40 hover:border-accent-gold-dim hover:bg-black/60 transition-colors ${gradeTextColor(item.grade)}`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </GamePanel>
            ))}
          </div>
        </section>
      )}

      {feature.suffixExamples && (
        <section className="py-4">
          <SectionHeader title="Crafted suffix prefixes" />
          <p className="text-text-muted text-sm mb-4 max-w-3xl">
            Five base prefixes determine the primary stat. Each combines with five modifiers (Strong, Dexterous, Erudite, Wise, Sturdy) for a secondary stat 25 total combinations.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {feature.suffixExamples.map((s) => (
              <GamePanel key={s.name} padding="p-3" className="text-center">
                <div className="font-heading text-accent-gold">{s.name}</div>
                <div className="text-xs text-text-muted uppercase tracking-wider mt-1">{s.stat}</div>
              </GamePanel>
            ))}
          </div>
        </section>
      )}

      {feature.video && (
        <section className="py-8">
          <SectionHeader title={feature.video.title} />
          <GamePanel padding="p-0" className="overflow-hidden">
            <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${feature.video.youtubeId}`}
                title={feature.video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </GamePanel>
        </section>
      )}

      {feature.externalSources && (
        <section className="py-4">
          <SectionHeader title="Sources" />
          <ul className="space-y-1 text-sm">
            {feature.externalSources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-secondary hover:text-accent-gold transition-colors underline decoration-border-subtle hover:decoration-accent-gold underline-offset-4"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Other Features */}
      <section className="py-8">
        <div className="diamond-divider mb-6">
          <span className="diamond" />
        </div>
        <SectionHeader title="More Features" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {otherFeatures.map((f) => (
            <Link
              key={f.slug}
              href={`/features/${f.slug}`}
              className="game-panel block p-4 transition-colors group text-center"
            >
              <GameCorners />
              <span className="relative z-[1] font-heading text-sm text-text-primary group-hover:text-accent-gold transition-colors">
                {f.name}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
