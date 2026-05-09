import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import GamePanel from '@/components/GamePanel';
import SectionHeader from '@/components/SectionHeader';

export const metadata: Metadata = pageMetadata({
  title: 'Activities',
  description: 'Fishing, hunting, camp, and housing systems in Chrono Odyssey.',
  path: '/activities',
});

const fishingTiers = [
  { tier: 1, wait: '5-7 s', hook: '5 s' },
  { tier: 2, wait: '5-10 s', hook: '4 s' },
  { tier: 3, wait: '10-25 s', hook: '3 s' },
  { tier: 4, wait: '15-30 s', hook: '2 s' },
  { tier: 5, wait: '20-30 s', hook: '1 s' },
];

export default function ActivitiesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Activities</h1>
        <p className="text-text-secondary max-w-3xl">
          Beyond combat and crafting, Setera is set up to host a handful of life skill systems and player utilities. Kakao hasn&rsquo;t fully detailed any of these yet what&rsquo;s below is what we&rsquo;ve seen demonstrated in beta footage.
        </p>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      {/* Fishing */}
      <section className="py-8">
        <SectionHeader title="Fishing" />
        <p className="text-text-secondary leading-relaxed max-w-3xl mb-4">
          A skill based mini game with five difficulty tiers, demonstrated in closed beta footage. Higher tiers wait longer for bites and shrink the hook window, rewarding sharper reactions.
        </p>
        <GamePanel padding="p-0" className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(200,168,78,0.2)]">
                <th className="text-left p-3 font-heading text-accent-gold text-sm">Tier</th>
                <th className="text-left p-3 font-heading text-accent-gold text-sm">Bite Wait</th>
                <th className="text-left p-3 font-heading text-accent-gold text-sm">Hook Window</th>
              </tr>
            </thead>
            <tbody>
              {fishingTiers.map((t) => (
                <tr key={t.tier} className="border-b border-[rgba(200,168,78,0.12)] last:border-0">
                  <td className="p-3 text-text-primary font-medium">Tier {t.tier}</td>
                  <td className="p-3 text-text-secondary text-sm">{t.wait}</td>
                  <td className="p-3 text-text-secondary text-sm">{t.hook}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GamePanel>
      </section>

      {/* Hunting */}
      <section className="py-8">
        <SectionHeader title="Gathering" />
        <p className="text-text-secondary leading-relaxed max-w-3xl">
          Beta footage has shown gathering professions sitting alongside fishing the usual MMO mix of mining, herbalism, butchery, and logging but Kakao hasn&rsquo;t published a breakdown of how they level, what they unlock, or how the resource economy ties back into crafting. Details to follow as they&rsquo;re announced.
        </p>
      </section>

      {/* Camp */}
      <section className="py-8">
        <SectionHeader title="Camps" />
        <p className="text-text-secondary leading-relaxed max-w-3xl">
          Players can build camps in the field that grant rest buffs to nearby allies. Each camp accepts a food item that determines the buff effect. Mechanics around fuel, tier scaling, and party wide effects haven&rsquo;t been formally detailed.
        </p>
      </section>

      {/* Housing */}
      <section className="py-8">
        <SectionHeader title="Housing" />
        <p className="text-text-secondary leading-relaxed max-w-3xl">
          Player housing is planned, with houses anchored to specific territories rather than instanced plots. Beyond that, Kakao hasn&rsquo;t shared how housing is purchased, what it&rsquo;s used for at endgame, or whether decoration and storage features will be in at launch.
        </p>
      </section>

    </div>
  );
}
