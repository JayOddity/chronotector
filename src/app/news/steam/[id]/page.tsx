import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  formatSteamDate,
  getAllSteamNewsGids,
  getSteamNewsItem,
  steamBBCodeToHtml,
  steamBBCodeToText,
} from '@/lib/steam';

export const revalidate = 300;

export async function generateStaticParams() {
  const gids = await getAllSteamNewsGids();
  return gids.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getSteamNewsItem(id);
  if (!item) return { title: 'Post Not Found' };

  const description = steamBBCodeToText(item.contents).slice(0, 160);
  return {
    title: item.title,
    description,
    // Canonical points back to the original Steam announcement so search engines
    // treat that URL as authoritative — no duplicate-content penalty for us.
    alternates: { canonical: item.url },
    openGraph: {
      title: item.title,
      description,
      url: item.url,
      type: 'article',
      publishedTime: new Date(item.date * 1000).toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: item.title,
      description,
    },
  };
}

export default async function SteamNewsPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getSteamNewsItem(id);
  if (!item) notFound();

  const html = steamBBCodeToHtml(item.contents);
  const dateLabel = formatSteamDate(item.date);

  return (
    <article className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/#news"
        className="text-sm text-text-muted hover:text-accent-gold transition-colors inline-flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All news
      </Link>

      <header className="mb-6">
        <h1 className="font-heading text-3xl sm:text-4xl text-accent-gold mb-3">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <span>{dateLabel}</span>
          <span>·</span>
          <span className="bg-blue-500/10 text-blue-400 text-xs px-1.5 py-0.5 rounded">
            Steam announcement
          </span>
          {item.author && (
            <>
              <span>·</span>
              <span>{item.author}</span>
            </>
          )}
        </div>
      </header>

      <ViewOriginal href={item.url} placement="top" />

      <div
        className="prose-steam text-text-secondary leading-relaxed [&_a]:text-accent-gold [&_a]:underline [&_strong]:text-text-primary [&_h2]:scroll-mt-20 [&_h3]:scroll-mt-20 [&_img]:mx-auto [&_iframe]:rounded"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <ViewOriginal href={item.url} placement="bottom" />

      <p className="text-[11px] text-text-muted text-center mt-8">
        Republished on Chronotector for ease of reading. Original content © Chrono Odyssey Studios / Kakao Games via Steam.
      </p>
    </article>
  );
}

function ViewOriginal({ href, placement }: { href: string; placement: 'top' | 'bottom' }) {
  return (
    <div className={placement === 'top' ? 'mb-6' : 'mt-8'}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-accent-gold hover:text-accent-gold-dim transition-colors border border-accent-gold/40 hover:border-accent-gold rounded px-3 py-1.5"
      >
        View original on Steam
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
