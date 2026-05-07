export interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  author: string;
  contents: string;
  feedlabel: string;
  date: number;
  feedname: string;
  appid: number;
}

interface SteamNewsResponse {
  appnews: {
    appid: number;
    newsitems: SteamNewsItem[];
  };
}

const CHRONO_ODYSSEY_APPID = 2873440;

// Note: maxlength is omitted on purpose. Steam's API strips ALL BBCode (and most
// newlines) whenever maxlength is set, returning a flattened plain-text blurb —
// which is what made our posts render as a single wall of text. With it omitted,
// the API returns the original BBCode (e.g. [p], [h3], [hr], [list], [previewyoutube]).
export async function getSteamNews(count = 10): Promise<SteamNewsItem[]> {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${CHRONO_ODYSSEY_APPID}&count=${count}&format=json`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return [];

    const data: SteamNewsResponse = await res.json();
    return data.appnews?.newsitems ?? [];
  } catch {
    return [];
  }
}

// Single-post fetcher. Steam's API doesn't expose a get-by-gid endpoint, so we
// pull a wider window (the app has ~30 posts total) and filter.
export async function getSteamNewsItem(gid: string): Promise<SteamNewsItem | null> {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${CHRONO_ODYSSEY_APPID}&count=50&format=json`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data: SteamNewsResponse = await res.json();
    return data.appnews?.newsitems?.find((n) => n.gid === gid) ?? null;
  } catch {
    return null;
  }
}

export async function getAllSteamNewsGids(): Promise<string[]> {
  const items = await getSteamNews(50);
  return items.map((n) => n.gid);
}

export function steamBBCodeToText(bbcode: string): string {
  return bbcode
    .replace(/\[\/?\w+[^\]]*\]/g, ' ')
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Converts Steam announcement BBCode + Steam-specific tokens to safe HTML.
// Pipeline: substitute Steam URL tokens, escape HTML, then transform BBCode.
// HTML escaping happens before BBCode replacement so untrusted angle brackets
// in the source can't escape the renderer; bbcode brackets ([, ]) survive
// escaping unchanged so the regex passes still match.
//
// Real Steam contents look like:
//   [p]Greetings[/p][p][/p][h3][b]The Matrix System[/b][/h3][hr][/hr][p]...[/p]
//   [list][*][p][b]Channel System[/b][/p][list][*][p]Sub-bullet[/p][/*][/list][/*][/list]
//   [previewyoutube="abc123;full"][/previewyoutube]
// — i.e. `[p]` paragraphs, optionally-quoted previewyoutube attrs, and lists
// nested via `[list]…[*]…[list]…[/list][/*]…[/list]`.
export function steamBBCodeToHtml(bbcode: string): string {
  const isSafeUrl = (url: string): boolean => /^https?:\/\//i.test(url.trim());

  // 1. Resolve {STEAM_CLAN_IMAGE} token.
  let s = bbcode.replace(/\{STEAM_CLAN_IMAGE\}/g, 'https://clan.akamai.steamstatic.com/images');

  // 2. HTML-escape the entire string. After this, `"` becomes `&quot;`, so any
  //    later regex that has to match attribute quotes (e.g. previewyoutube)
  //    needs to look for `&quot;` rather than `"`.
  s = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 3. Drop the empty-paragraph spacers Steam uses ([p][/p]) — they'd
  //    otherwise turn into useless empty <p> tags.
  s = s.replace(/\[p\]\s*\[\/p\]/g, '');

  // 4. Headings & dividers.
  s = s.replace(/\[h1\]([\s\S]*?)\[\/h1\]/g, '<h2 class="font-heading text-2xl text-accent-gold mt-8 mb-3">$1</h2>');
  s = s.replace(/\[h2\]([\s\S]*?)\[\/h2\]/g, '<h2 class="font-heading text-xl text-accent-gold mt-7 mb-3">$1</h2>');
  s = s.replace(/\[h3\]([\s\S]*?)\[\/h3\]/g, '<h3 class="font-heading text-lg text-accent-gold mt-6 mb-2">$1</h3>');
  s = s.replace(/\[hr\](?:\[\/hr\])?/g, '<hr class="border-border-subtle my-4" />');

  // 5. Lists — process innermost first so nested lists work correctly. We
  //    bound the loop to avoid pathological inputs spinning forever.
  const splitListItems = (inner: string): string[] =>
    inner
      .split(/\[\*\]/)
      .slice(1) // anything before the first [*] is intro whitespace
      .map((x) => x.replace(/\[\/\*\]/g, '').trim())
      .filter(Boolean);

  for (let i = 0; i < 8; i++) {
    const before = s;
    s = s.replace(
      /\[olist\]((?:(?!\[olist\]|\[\/olist\]|\[list\]|\[\/list\])[\s\S])*?)\[\/olist\]/g,
      (_m, inner: string) =>
        '<ol class="list-decimal pl-6 space-y-1 my-3">' +
        splitListItems(inner).map((x) => '<li>' + x + '</li>').join('') +
        '</ol>',
    );
    s = s.replace(
      /\[list\]((?:(?!\[list\]|\[\/list\]|\[olist\]|\[\/olist\])[\s\S])*?)\[\/list\]/g,
      (_m, inner: string) =>
        '<ul class="list-disc pl-6 space-y-1 my-3">' +
        splitListItems(inner).map((x) => '<li>' + x + '</li>').join('') +
        '</ul>',
    );
    if (s === before) break;
  }

  // 6. Quotes & paragraphs.
  s = s.replace(/\[quote\]([\s\S]*?)\[\/quote\]/g, '<blockquote class="border-l-4 border-accent-gold-dim pl-4 italic text-text-muted my-3">$1</blockquote>');
  s = s.replace(/\[p\]([\s\S]*?)\[\/p\]/g, '<p class="my-3 leading-relaxed">$1</p>');

  // 7. Inline formatting.
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>');
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>');
  s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>');
  s = s.replace(/\[strike\]([\s\S]*?)\[\/strike\]/g, '<s>$1</s>');

  // 8. Links — only allow http(s).
  s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/g, (_m, url: string, label: string) => {
    const safe = isSafeUrl(url) ? url : '#';
    return '<a href="' + safe + '" target="_blank" rel="noopener noreferrer" class="text-accent-gold underline hover:text-accent-gold-dim">' + label + '</a>';
  });
  s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/g, (_m, url: string) => {
    const safe = isSafeUrl(url) ? url : '#';
    return '<a href="' + safe + '" target="_blank" rel="noopener noreferrer" class="text-accent-gold underline hover:text-accent-gold-dim">' + url + '</a>';
  });

  // 9. Images.
  s = s.replace(/\[img\]([\s\S]*?)\[\/img\]/g, (_m, url: string) => {
    if (!isSafeUrl(url)) return '';
    return '<img src="' + url.trim() + '" alt="" class="rounded my-4 mx-auto max-w-full h-auto" loading="lazy" />';
  });

  // 10. Steam YouTube preview embeds. Steam wraps the value in quotes
  //     ([previewyoutube="ID;full"]); after HTML-escape they're &quot;.
  s = s.replace(
    /\[previewyoutube=(?:&quot;|")?([\w-]+)(?:;[^\]&"]*)?(?:&quot;|")?\]\[\/previewyoutube\]/g,
    (_m, vid: string) =>
      '<div class="relative aspect-video my-4"><iframe src="https://www.youtube-nocookie.com/embed/' +
      vid +
      '" title="YouTube video" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="absolute inset-0 w-full h-full rounded"></iframe></div>',
  );

  // 11. Strip any unknown bbcode tags that survived.
  s = s.replace(/\[\/?\w+[^\]]*\]/g, '');

  // 12. Cleanup: Steam wraps each list item's lead text in a <p>, e.g.
  //     <li><p>Header</p><ul>…</ul></li>. Strip that leading <p>…</p> pair so
  //     the item header doesn't carry a paragraph margin and we don't leave
  //     an orphan </p> when a nested <ul> follows.
  s = s.replace(/<li>\s*<p[^>]*>([\s\S]*?)<\/p>/g, '<li>$1');

  // 13. Drop empty paragraphs that may remain after inner content was hoisted out.
  s = s.replace(/<p[^>]*>\s*<\/p>/g, '');

  return s;
}

export function formatSteamDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
