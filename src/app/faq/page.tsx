import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/metadata';
import JsonLd from '@/components/JsonLd';
import { faqPageSchema, breadcrumbSchema } from '@/lib/schema';
import GamePanel from '@/components/GamePanel';
import GameCorners from '@/components/GameCorners';
import SectionHeader from '@/components/SectionHeader';

export const metadata: Metadata = pageMetadata({
  title: 'FAQ',
  description:
    'Frequently asked questions about Chrono Odyssey: release date, platforms, monetisation, system requirements, and more.',
  path: '/faq',
});

interface FaqItem {
  q: string;
  a: React.ReactNode;
  /** Plain-text answer used for FAQPage JSON-LD. */
  plain: string;
}

const faq: FaqItem[] = [
  {
    q: 'When does Chrono Odyssey release?',
    plain:
      'Kakao Games is targeting Q1 2027 for full launch. The window has shifted from the original Q4 2025 to Q4 2026 to Q1 2027 as disclosed in Kakao quarterly reports.',
    a: (
      <>
        Kakao Games is targeting <strong>Q1 2027</strong> for full launch. The window has
        shifted from the original Q4 2025 → Q4 2026 → Q1 2027 as disclosed in Kakao&apos;s
        quarterly reports. See the{' '}
        <Link href="/release-date" className="text-accent-gold hover:underline">
          release date page
        </Link>{' '}
        for the full timeline.
      </>
    ),
  },
  {
    q: 'What platforms will the game be available on?',
    plain: 'PC (Steam and Epic Games Store), PlayStation 5, and Xbox Series X|S.',
    a: (
      <>
        PC (Steam and Epic Games Store), PlayStation 5, and Xbox Series X|S.
      </>
    ),
  },
  {
    q: 'Who is making Chrono Odyssey?',
    plain:
      'Developed by Chrono Odyssey Studios (formerly known as NPIXEL) and published by Kakao Games.',
    a: (
      <>
        Developed by <strong>Chrono Odyssey Studios</strong> (formerly known as NPIXEL)
        and published by <strong>Kakao Games</strong>.
      </>
    ),
  },
  {
    q: 'What engine does it use?',
    plain: 'Unreal Engine 5.',
    a: <>Unreal Engine 5.</>,
  },
  {
    q: 'Is Chrono Odyssey pay to win?',
    plain:
      'Kakao has stated the game will be buy to play with no pay to win mechanics. Monetisation is expected to focus on cosmetics. Full details have not yet been announced.',
    a: (
      <>
        Kakao has stated the game will be <strong>buy to play with no pay to win
        mechanics</strong>. Monetisation is expected to focus on cosmetics. Full details
        have not yet been announced.
      </>
    ),
  },
  {
    q: 'Has there been a beta?',
    plain:
      'Yes the first closed beta ran June 20-22, 2025 on PC, peaking at around 65,000 concurrent players on Steam. A second beta window has not been officially dated yet.',
    a: (
      <>
        Yes the first closed beta ran <strong>June 20 22, 2025</strong> on PC, peaking
        at around 65,000 concurrent players on Steam. A second beta window has not been
        officially dated yet.
      </>
    ),
  },
  {
    q: 'Where can I find the game on Steam?',
    plain:
      'Steam App ID 2873440. https://store.steampowered.com/app/2873440/Chrono_Odyssey/',
    a: (
      <>
        Steam App ID <strong>2873440</strong> {' '}
        <a
          href="https://store.steampowered.com/app/2873440/Chrono_Odyssey/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-gold hover:underline"
        >
          store.steampowered.com/app/2873440 ↗
        </a>
      </>
    ),
  },
  {
    q: 'Where is the official Chrono Odyssey site?',
    plain: 'https://chronoodyssey.kakaogames.com/',
    a: (
      <>
        <a
          href="https://chronoodyssey.kakaogames.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-gold hover:underline"
        >
          chronoodyssey.kakaogames.com ↗
        </a>
      </>
    ),
  },
  {
    q: 'Is this site affiliated with the developers?',
    plain:
      'No. Chronotector is an independent fan project. Chrono Odyssey and all related assets are property of Chrono Odyssey Studios and Kakao Games. Content here is sourced from official channels and community datamining from the June 2025 closed beta.',
    a: (
      <>
        No. Chronotector is an independent fan project. Chrono Odyssey and all related
        assets are property of Chrono Odyssey Studios and Kakao Games. Content here is
        sourced from official channels (Steam, developer notes, Kakao earnings calls,
        reputable gaming press) and community datamining from the June 2025 closed beta.
      </>
    ),
  },
];

interface SpecRow {
  label: string;
  minimum: string;
  recommended: string;
}

const specs: SpecRow[] = [
  { label: 'OS', minimum: 'Windows 10 (64-bit)', recommended: 'Windows 10 (64-bit)' },
  {
    label: 'Processor',
    minimum: 'Intel Core i5-3570K / AMD FX-8310',
    recommended: 'Intel Core i7-12700K / AMD Ryzen 5 5600X',
  },
  { label: 'RAM', minimum: '16 GB', recommended: '32 GB' },
  {
    label: 'Graphics',
    minimum: 'NVIDIA GeForce GTX 1660 Ti / AMD Radeon RX 6600',
    recommended: 'NVIDIA GeForce RTX 3070 / AMD Radeon RX 6800 XT',
  },
  { label: 'DirectX', minimum: 'Version 11', recommended: 'Version 12' },
  { label: 'Storage', minimum: '50 GB', recommended: '50 GB' },
];

export default function FaqPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <JsonLd
        data={[
          faqPageSchema(faq.map((it) => ({ question: it.q, answer: it.plain }))),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
        ]}
      />
      <header className="pt-4 pb-8">
        <h1 className="font-heading text-4xl text-accent-gold mb-2">FAQ</h1>
        <p className="text-text-muted">
          Answers to the most common questions about Chrono Odyssey. System requirements
          are listed at the bottom.
        </p>
        <div className="diamond-divider mt-6">
          <span className="diamond" />
        </div>
      </header>

      <section className="space-y-3">
        {faq.map((item, i) => (
          <details
            key={i}
            className="game-panel group transition-colors p-0"
          >
            <GameCorners />
            <summary className="relative z-[1] flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none select-none">
              <h3 className="font-heading text-lg text-text-primary group-open:text-accent-gold transition-colors">
                {item.q}
              </h3>
              <svg
                className="shrink-0 w-4 h-4 text-text-muted transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="relative z-[1] px-5 pb-4 pt-0 text-text-secondary text-base leading-relaxed">
              {item.a}
            </div>
          </details>
        ))}
      </section>

      {/* System Requirements */}
      <section id="system-requirements" className="mt-12 scroll-mt-24">
        <SectionHeader title="System Requirements" />
        <p className="text-text-muted mb-4 text-sm">
          Official PC specs as listed on the Steam store page. Subject to change before
          launch.
        </p>

        {/* Desktop table */}
        <GamePanel padding="p-0" className="overflow-hidden hidden sm:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(200,168,78,0.2)]">
                <th className="text-left p-4 font-heading text-accent-gold text-sm">
                  Component
                </th>
                <th className="text-left p-4 font-heading text-accent-gold text-sm">
                  Minimum
                </th>
                <th className="text-left p-4 font-heading text-accent-gold text-sm">
                  Recommended
                </th>
              </tr>
            </thead>
            <tbody>
              {specs.map((row) => (
                <tr key={row.label} className="border-b border-[rgba(200,168,78,0.12)] last:border-0">
                  <td className="p-4 text-text-primary font-medium">{row.label}</td>
                  <td className="p-4 text-text-secondary">{row.minimum}</td>
                  <td className="p-4 text-text-secondary">{row.recommended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GamePanel>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-4">
          <GamePanel padding="p-5">
            <h3 className="font-heading text-lg text-accent-gold mb-4">Minimum</h3>
            <dl className="space-y-3">
              {specs.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">
                    {row.label}
                  </dt>
                  <dd className="text-text-secondary">{row.minimum}</dd>
                </div>
              ))}
            </dl>
          </GamePanel>
          <GamePanel padding="p-5">
            <h3 className="font-heading text-lg text-accent-gold mb-4">Recommended</h3>
            <dl className="space-y-3">
              {specs.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-text-muted uppercase tracking-wider">
                    {row.label}
                  </dt>
                  <dd className="text-text-secondary">{row.recommended}</dd>
                </div>
              ))}
            </dl>
          </GamePanel>
        </div>
      </section>
    </main>
  );
}
