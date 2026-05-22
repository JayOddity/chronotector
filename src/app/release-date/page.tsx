import type { Metadata } from 'next';
import Image from 'next/image';
import { pageMetadata } from '@/lib/metadata';
import GamePanel from '@/components/GamePanel';
import SectionHeader from '@/components/SectionHeader';

export const metadata: Metadata = pageMetadata({
  title: 'Release Date',
  description: 'Chrono Odyssey targets a Q1 2027 launch on PC, PS5, and Xbox Series X. Beta history, platform support, and the road to release.',
  path: '/release-date',
});

export default function ReleaseDatePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <section className="pt-8 pb-4">
        <h1 className="font-heading text-4xl text-accent-gold mb-4">Chrono Odyssey Release Date</h1>
      </section>

      <section className="py-8 space-y-6">
        <GamePanel padding="p-6">
          <SectionHeader title="Q1 2027" />
          <p className="text-text-secondary leading-relaxed">
            Chrono Odyssey is currently scheduled for Q1 2027 according to Kakao Games&apos; quarterly report. The game was previously targeting Q4 2026 but was postponed to allow more time to implement feedback from the June 2025 closed beta.
          </p>
          <figure className="mt-5">
            <div className="relative w-full overflow-hidden rounded-md border border-[rgba(200,168,78,0.25)]">
              <Image
                src="/images/release-date/kakao-earnings-q1-2027.avif"
                alt="Kakao Games earnings presentation slide listing Chrono Odyssey with a Q1 2027 release target"
                width={1600}
                height={900}
                className="w-full h-auto"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
            <figcaption className="mt-2 text-sm text-text-muted italic">
              Source: Kakao Games earnings presentation Q1 2027 target for Chrono Odyssey.
            </figcaption>
          </figure>
        </GamePanel>

        <GamePanel padding="p-6">
          <SectionHeader title="Platforms" />
          <p className="text-text-secondary leading-relaxed">
            PC (Steam and Epic Games), PlayStation 5, Xbox Series X.
          </p>
        </GamePanel>

        <GamePanel padding="p-6">
          <SectionHeader title="Closed Beta" />
          <p className="text-text-secondary leading-relaxed">
            The first closed beta ran June 20-22, 2025 on Steam. It drew over 65,000 players at peak with mixed reception. Kakao Games stated that the CBT &ldquo;really helped us to understand and recognize the high level of interest and positive anticipation that&apos;s building up in the Western market&rdquo; and decided to &ldquo;further dial up the game&apos;s level of completeness&rdquo; even with additional development time required.
          </p>
          <figure className="mt-5">
            <div className="relative w-full overflow-hidden rounded-md border border-[rgba(200,168,78,0.25)]">
              <Image
                src="/images/release-date/beta-stats.avif"
                alt="Kakao Games CBT statistics infographic listing top weapons, most defeated monsters, average playtime, and most popular area"
                width={1600}
                height={900}
                className="w-full h-auto"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
            <figcaption className="mt-2 text-sm text-text-muted italic">
              CBT statistics published by Kakao Games. Source: Developer&rsquo;s Notes #1 (Apr 2025).
            </figcaption>
          </figure>
        </GamePanel>

        <GamePanel padding="p-6">
          <SectionHeader title="Post Beta Development" />
          <p className="text-text-secondary leading-relaxed">
            Since the beta, the developers have published four sets of Developer&apos;s Notes detailing improvements to hit feedback, animations, control feel, enemy behaviour, and graphical quality. Multiple focus group tests have taken place in the home market. A second closed beta is expected before launch.
          </p>
        </GamePanel>

        <GamePanel padding="p-6">
          <SectionHeader title="Timeline" />
          <ul className="space-y-3 text-text-secondary">
            <li className="flex items-start gap-3">
              <span className="text-accent-gold font-heading text-sm shrink-0 w-28 text-right mt-0.5">Jun 2025</span>
              <span>First closed beta on Steam (65K peak players)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-accent-gold font-heading text-sm shrink-0 w-28 text-right mt-0.5">Q2 2025</span>
              <span>Kakao earnings call moves target from Q4 2025 to Q4 2026</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-accent-gold font-heading text-sm shrink-0 w-28 text-right mt-0.5">Feb 2026</span>
              <span>Kakao quarterly report delays launch again to Q1 2027</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-accent-gold font-heading text-sm shrink-0 w-28 text-right mt-0.5">Q1 2027</span>
              <span>Current target launch (PC, PS5, Xbox Series X)</span>
            </li>
          </ul>
        </GamePanel>
      </section>
    </div>
  );
}
