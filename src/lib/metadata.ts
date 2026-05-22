import type { Metadata } from 'next';

export const SITE_URL = 'https://chronotector.com';
export const SITE_NAME = 'Chronotector';

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  /** When true, the title is used verbatim (skips the root layout's `%s | Chronotector` template). */
  absoluteTitle?: boolean;
  ogType?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
}

// OG/Twitter image is supplied by Next's file convention (app/opengraph-image.tsx
// at root, plus per-route overrides where useful). We don't set images here so
// the convention can do its job — manual `images` would override it.
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  ogType = 'website',
  publishedTime,
  modifiedTime,
  noindex = false,
}: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path}`;
  const ogTitle = absoluteTitle ? title : `${title} - Chrono Odyssey | ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: ogTitle,
      description,
      siteName: SITE_NAME,
      url,
      type: ogType,
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
    },
  };
}
