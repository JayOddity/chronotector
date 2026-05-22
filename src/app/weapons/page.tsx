import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { classes } from '@/data/classes';
import { pageMetadata } from '@/lib/metadata';
import GamePanel from '@/components/GamePanel';
import SectionHeader from '@/components/SectionHeader';

const WEAPON_ICONS: Record<string, string> = {
  'Wrist Blades': '/images/game-icons/weapons/TX_ClassIcon_WristBlades.png',
  'Sabre': '/images/game-icons/weapons/TX_ClassIcon_Sabre.png',
  'Musket': '/images/game-icons/weapons/TX_ClassIcon_Musket.png',
  'Chain Swords': '/images/game-icons/weapons/TX_ClassIcon_ChainSwords.png',
  'Hatchets': '/images/game-icons/weapons/TX_ClassIcon_Hatchets.png',
  'Battle Axe': '/images/game-icons/weapons/TX_ClassIcon_BattleAxe.png',
  'Lance': '/images/game-icons/weapons/TX_ClassIcon_Lance.png',
  'Halberd': '/images/game-icons/weapons/TX_ClassIcon_Halberd.png',
  'Mace': '/images/game-icons/weapons/TX_ClassIcon_Mace.png',
  'Longbow': '/images/game-icons/weapons/TX_ClassIcon_LongBow.png',
  'Crossbows': '/images/game-icons/weapons/TX_ClassIcon_Crossbows.png',
  'Rapier': '/images/game-icons/weapons/TX_ClassIcon_Rapier.png',
  'Staff': '/images/game-icons/weapons/TX_ClassIcon_Staff.png',
  'Magic Orb': '/images/game-icons/weapons/TX_ClassIcon_MagicOrb.png',
  'Spellbook': '/images/game-icons/weapons/TX_ClassIcon_Spellbook.png',
  'Longsword': '/images/game-icons/weapons/TX_ClassIcon_LongSword.png',
  'Dual Swords': '/images/game-icons/weapons/TX_ClassIcon_DualSwords.png',
  'Greatsword': '/images/game-icons/weapons/TX_ClassIcon_GreatSword.png',
};

export const metadata: Metadata = pageMetadata({
  title: 'Weapons',
  description: 'All 18 weapons in Chrono Odyssey. Three weapons per class across six classes, with weapon swap on Q and four active abilities per weapon.',
  path: '/weapons',
});

export default function WeaponsPage() {
  const totalWeapons = classes.reduce((n, c) => n + c.weapons.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Chrono Odyssey Weapons</h1>
        <p className="text-text-secondary max-w-3xl">
          {totalWeapons} weapons across {classes.length} classes. Each class carries three weapons and equips two at a time. Press Q to swap between them on a 0.25s cooldown. Each weapon has eight abilities, with four slotted active at once.
        </p>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </section>

      {classes.map((cls) => (
        <section key={cls.slug} className="py-6">
          <SectionHeader title={cls.name} />
          <p className="text-center text-[11px] text-text-muted uppercase tracking-[0.25em] -mt-3 mb-5">
            <Link href={`/classes/${cls.slug}`} className="hover:text-accent-gold transition-colors">
              {cls.role}
            </Link>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cls.weapons.map((w) => (
              <GamePanel key={w.name} padding="p-5" className="flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  {WEAPON_ICONS[w.name] && (
                    <Image
                      src={WEAPON_ICONS[w.name]}
                      alt=""
                      width={48}
                      height={48}
                      className="shrink-0"
                    />
                  )}
                  <div>
                    <h3 className="font-heading text-lg text-accent-gold">{w.name}</h3>
                    <div className="text-xs text-text-muted uppercase tracking-wider mt-0.5">{w.tagline}</div>
                  </div>
                </div>
                <div className="game-rule mb-3" />
                <p className="text-text-secondary text-sm leading-relaxed flex-1">{w.description}</p>
                <Link
                  href={`/classes/${cls.slug}`}
                  className="mt-3 text-xs text-accent-gold-dim hover:text-accent-gold transition-colors uppercase tracking-wider"
                >
                  {cls.name} class &rarr;
                </Link>
              </GamePanel>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
