import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getSteamNews, steamBBCodeToText } from '@/lib/steam';
import { sanityClient, urlFor } from '@/lib/sanity';
import { pageMetadata } from '@/lib/metadata';
import JsonLd from '@/components/JsonLd';
import { videoGameSchema } from '@/lib/schema';
import GameCorners from '@/components/GameCorners';

export const metadata: Metadata = pageMetadata({
  title: 'Chronotector | Chrono Odyssey News, Database, Map',
  description: 'Chrono Odyssey MMO news, item and bestiary database, interactive map of Setera, talent calculator, and class guides for the Chrono Odyssey Studios MMO.',
  path: '/',
  absoluteTitle: true,
});

interface SanityNews {
  _id: string;
  title: string;
  slug: { current: string };
  excerpt?: string;
  featuredImage?: { asset: { _ref: string } };
  publishedAt?: string;
}

interface FeedItem {
  id: string;
  title: string;
  excerpt?: string;
  date: string;
  source: 'sanity' | 'steam';
  href: string;
  image?: string;
}

export const revalidate = 300;

// Rotating fallback images from Steam store screenshots
const STEAM_FALLBACK_IMAGES = [
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2873440/de48f2d77db5eb14226739d563fdd68332c39e30/header.jpg',
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2873440/ss_e751db5e229413f520c06c6acd845b3585da8cae.600x338.jpg',
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2873440/ss_aab3d8e7659e7dd916099abb51380e66cb526f25.600x338.jpg',
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2873440/ss_4c66126229c0c2e674ad4f02e66c163b468caea5.600x338.jpg',
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2873440/ss_332c49d0ee89b290fcb5deca06f0961f65acb7b4.600x338.jpg',
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2873440/ss_6cc1f0b86b945ce0f2394749c65bee76ff1a0656.600x338.jpg',
];

// Extract best thumbnail from Steam post: YouTube > Steam clan image > fallback screenshot
function getSteamImage(contents: string, index: number = 0): string {
  const yt = contents.match(/\[previewyoutube="?([\w-]+)/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;

  const ytEmbed = contents.match(/youtube\.com\/embed\/([\w-]+)/);
  if (ytEmbed) return `https://img.youtube.com/vi/${ytEmbed[1]}/hqdefault.jpg`;

  const ytWatch = contents.match(/youtube\.com\/watch\?v=([\w-]+)/);
  if (ytWatch) return `https://img.youtube.com/vi/${ytWatch[1]}/hqdefault.jpg`;

  const ytShort = contents.match(/youtu\.be\/([\w-]+)/);
  if (ytShort) return `https://img.youtube.com/vi/${ytShort[1]}/hqdefault.jpg`;

  const steamImg = contents.match(/\{STEAM_CLAN_IMAGE\}\/([^\s"\]]+)/);
  if (steamImg) return `https://clan.akamai.steamstatic.com/images/${steamImg[1]}`;

  return STEAM_FALLBACK_IMAGES[index % STEAM_FALLBACK_IMAGES.length];
}

// Shared box style: purple outline, slightly rounded, hover lifts to brighter purple
const boxClass =
  'border border-[rgba(90,61,128,0.5)] hover:border-[rgba(106,77,144,0.8)] rounded-lg transition-colors';

export default async function HomePage() {
  const [sanityNews, steamNews] = await Promise.all([
    sanityClient.fetch<SanityNews[]>(
      `*[_type == "newsPost"] | order(publishedAt desc) [0...20] {
        _id, title, slug, excerpt, featuredImage, publishedAt
      }`,
    ).catch(() => [] as SanityNews[]),
    getSteamNews(10),
  ]);

  // Merge into unified feed
  const feed: FeedItem[] = [];

  for (const post of sanityNews) {
    feed.push({
      id: post._id,
      title: post.title,
      excerpt: post.excerpt,
      date: post.publishedAt || '',
      source: 'sanity',
      href: `/news/${post.slug.current}`,
      image: post.featuredImage?.asset ? urlFor(post.featuredImage).width(600).height(338).url() : undefined,
    });
  }

  steamNews.forEach((item, i) => {
    feed.push({
      id: `steam-${item.gid}`,
      title: item.title,
      excerpt: steamBBCodeToText(item.contents).slice(0, 200),
      date: new Date(item.date * 1000).toISOString(),
      source: 'steam',
      href: `/news/steam/${item.gid}`,
      image: getSteamImage(item.contents, i),
    });
  });

  // Sort newest first
  feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <JsonLd data={videoGameSchema()} />
      {/* Things to Check Out */}
      <section className="mb-12">
        <h2 className="font-heading text-xl text-accent-gold mb-4">Things to Check Out</h2>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/#news" className={`${boxClass} group relative aspect-video overflow-hidden`}>
            <Image src={STEAM_FALLBACK_IMAGES[1]} alt="News" fill priority className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-3 left-3 font-heading text-2xl text-white">News</span>
          </Link>
          <Link href="/classes" className={`${boxClass} group relative aspect-video overflow-hidden`}>
            <Image src="/images/home/classes-card.avif" alt="Classes" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-3 left-3 font-heading text-2xl text-white">Classes</span>
          </Link>
          <Link href="/features/combat" className={`${boxClass} group relative aspect-video overflow-hidden`}>
            <Image src="/images/home/combat-card.avif" alt="Combat" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-3 left-3 font-heading text-2xl text-white">Combat</span>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Link href="/release-date" className={`${boxClass} group relative aspect-video overflow-hidden`}>
            <Image src={STEAM_FALLBACK_IMAGES[3]} alt="Release Date" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-3 left-3 font-heading text-2xl text-white">Release Date</span>
          </Link>
          <Link href="/world/lore" className={`${boxClass} group relative aspect-video overflow-hidden`}>
            <Image src="/images/world/soroma-stronghold.avif" alt="World & Lore" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-3 left-3 font-heading text-2xl text-white">World & Lore</span>
          </Link>
          <a href="https://store.steampowered.com/app/2873440/Chrono_Odyssey/" target="_blank" rel="noopener noreferrer" className={`${boxClass} group relative aspect-video overflow-hidden`}>
            <Image src={STEAM_FALLBACK_IMAGES[0]} alt="Steam" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 to-black/70" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <svg className="w-12 h-12 text-white/90 mb-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.387 3.387 0 0 1 1.912-.59c.064 0 .127.003.19.008l2.861-4.142V8.91a4.528 4.528 0 0 1 4.524-4.524 4.528 4.528 0 0 1 4.524 4.524 4.528 4.528 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.004.105.004.159a3.392 3.392 0 0 1-3.39 3.393 3.396 3.396 0 0 1-3.322-2.72L.453 14.07A11.98 11.98 0 0 0 11.979 24c6.627 0 12.001-5.373 12.001-12S18.606 0 11.979 0z" />
              </svg>
              <span className="font-heading text-lg text-white">Steam Page</span>
            </div>
          </a>
        </div>
      </section>

      {/* Latest News - Sanity + Steam merged */}
      <section id="news" className="mb-12 scroll-mt-20">
        <h2 className="font-heading text-xl text-accent-gold mb-4">Latest News</h2>

        {feed.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feed.slice(0, 9).map((item) => {
              const card = (
                <>
                  {item.image ? (
                    <div className="w-full aspect-video bg-dark-surface overflow-hidden relative">
                      <Image src={item.image} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-dark-surface flex items-center justify-center">
                      <span className="text-2xl text-text-muted">📰</span>
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-sm font-medium text-text-primary group-hover:text-accent-gold transition-colors line-clamp-2 mb-2">
                      {item.title}
                    </h3>
                    {item.excerpt && (
                      <p className="text-xs text-text-muted line-clamp-2 mb-3 flex-1">{item.excerpt}</p>
                    )}
                    <div className="flex items-center gap-2 mt-auto">
                      {item.date && (
                        <span className="text-[11px] text-text-muted">
                          {new Date(item.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        item.source === 'steam'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-accent-gold/10 text-accent-gold'
                      }`}>
                        {item.source === 'steam' ? 'Steam' : 'Chronotector'}
                      </span>
                    </div>
                  </div>
                </>
              );

              return (
                <Link key={item.id} href={item.href} className={`${boxClass} bg-card-bg flex flex-col overflow-hidden group`}>
                  {card}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={`${boxClass} bg-card-bg p-8 text-center`}>
            <p className="text-text-muted">No news available right now.</p>
          </div>
        )}
      </section>

      {/* Classes Quick Links */}
      <section className="mb-12">
        <h2 className="font-heading text-xl text-accent-gold mb-4">Classes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(['Assassin', 'Berserker', 'Paladin', 'Ranger', 'Sorcerer', 'Swordsman'] as const).map((name) => (
            <Link
              key={name}
              href={`/classes/${name.toLowerCase()}`}
              className="game-panel flex flex-col items-center p-4 glow-gold-hover group transition-colors"
            >
              <GameCorners />
              <div className="relative z-[1] w-20 h-20 rounded-full overflow-hidden bg-black/40 border border-[rgba(200,168,78,0.4)] mb-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(200,168,78,0.12),transparent_70%)] z-[1]" />
                <Image
                  src={`/images/classes/${name.toLowerCase()}.webp`}
                  alt={name}
                  fill
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                  sizes="80px"
                />
              </div>
              <span className="relative z-[1] font-heading text-sm text-text-primary group-hover:text-accent-gold transition-colors">
                {name}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
