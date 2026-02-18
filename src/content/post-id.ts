const PRIMARY_ID_ATTRIBUTES = ['data-urn', 'data-id', 'data-activity-urn', 'data-update-id', 'data-occludable-job-id', 'id'] as const;
const STRUCTURAL_ID_SELECTOR = '[data-urn], [data-id], [data-activity-urn], [data-update-id], [data-occludable-job-id]';
const LINKEDIN_HOST = 'linkedin.com';
const COMPONENT_KEY_SELECTOR = '[componentkey]';

type UrnType = 'activity' | 'ugcPost' | 'share';
export type PostIdSource = 'strong_attr' | 'feed_update_url' | 'componentkey' | 'fallback_hash';

export type PostIdentity = {
  postId: string;
  source: PostIdSource;
};

/**
 * FNV1a hash for post deduplication and tracking.
 *
 * WARNING: This is NOT cryptographically secure.
 * Use only for internal deduplication and feature matching.
 * Do NOT use for authorization, integrity verification, or security-sensitive operations.
 */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? '').filter(Boolean))];
}

function normalizeUrnCandidate(value: string): string | null {
  const match = value.match(/urn:li:(activity|ugcpost|share):(\d+)/i);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  const rawType = match[1].toLowerCase();
  const urnType: UrnType = rawType === 'ugcpost' ? 'ugcPost' : rawType === 'activity' ? 'activity' : 'share';
  return `urn:li:${urnType}:${match[2]}`;
}

function extractUrnFromText(value: string): string | null {
  const normalized = normalizeUrnCandidate(value);
  if (normalized) {
    return normalized;
  }

  const token = value.match(/urn:li:(activity|ugcpost|share):\d+/i)?.[0] ?? null;
  return token ? normalizeUrnCandidate(token) : null;
}

function normalizeUpdateLink(urlLike: string): string | null {
  try {
    const url = new URL(urlLike, 'https://www.linkedin.com');
    if (!url.pathname.includes('/feed/update/')) {
      return null;
    }

    const canonical = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    return canonical;
  } catch {
    return null;
  }
}

function extractUrnFromUpdateUrl(urlLike: string): string | null {
  try {
    const url = new URL(urlLike, 'https://www.linkedin.com');
    if (!url.pathname.includes('/feed/update/')) {
      return null;
    }

    const index = url.pathname.indexOf('/feed/update/');
    const tail = decodeURIComponent(url.pathname.slice(index + '/feed/update/'.length));
    const directPathToken = tail.split('/').filter(Boolean)[0] ?? '';

    const fromPath = extractUrnFromText(directPathToken);
    if (fromPath) {
      return fromPath;
    }

    const fromPathFallback = extractUrnFromText(tail);
    if (fromPathFallback) {
      return fromPathFallback;
    }

    const fromQuery = extractUrnFromText(url.search);
    if (fromQuery) {
      return fromQuery;
    }

    return null;
  } catch {
    return null;
  }
}

function isNonUniqueCompanyPostsUrl(urlLike: string): boolean {
  try {
    const url = new URL(urlLike, 'https://www.linkedin.com');
    return /^\/company\/[^/]+\/posts\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function normalizeLinkForFallback(urlLike: string): string | null {
  try {
    const url = new URL(urlLike, 'https://www.linkedin.com');
    const hostname = url.hostname.toLowerCase();
    if (hostname === LINKEDIN_HOST || hostname.endsWith(`.${LINKEDIN_HOST}`)) {
      return `${url.pathname}${url.search ? url.search : ''}`;
    }

    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function collectScopes(renderRoot: HTMLElement, featureRoot: HTMLElement): HTMLElement[] {
  return [...new Set([renderRoot, featureRoot])];
}

function collectStrongAttributeCandidates(renderRoot: HTMLElement, featureRoot: HTMLElement): string[] {
  const values: Array<string | null> = [];

  for (const scope of collectScopes(renderRoot, featureRoot)) {
    for (const attr of PRIMARY_ID_ATTRIBUTES) {
      values.push(scope.getAttribute(attr));
    }

    for (const node of scope.querySelectorAll<HTMLElement>(STRUCTURAL_ID_SELECTOR)) {
      for (const attr of PRIMARY_ID_ATTRIBUTES) {
        values.push(node.getAttribute(attr));
      }

      if (values.length >= 120) {
        return uniqueNonEmpty(values);
      }
    }
  }

  return uniqueNonEmpty(values);
}

function collectFeedUpdateLinks(renderRoot: HTMLElement, featureRoot: HTMLElement): string[] {
  const links: string[] = [];

  for (const scope of collectScopes(renderRoot, featureRoot)) {
    for (const anchor of scope.querySelectorAll<HTMLAnchorElement>('a[href*="/feed/update/"]')) {
      links.push(anchor.href);
      if (links.length >= 30) {
        return uniqueNonEmpty(links);
      }
    }
  }

  return uniqueNonEmpty(links);
}

function collectComponentKeyCandidates(renderRoot: HTMLElement, featureRoot: HTMLElement): string[] {
  const values: Array<string | null> = [];

  for (const scope of collectScopes(renderRoot, featureRoot)) {
    values.push(scope.getAttribute('componentkey'));

    for (const node of scope.querySelectorAll<HTMLElement>(COMPONENT_KEY_SELECTOR)) {
      values.push(node.getAttribute('componentkey'));
      if (values.length >= 80) {
        return uniqueNonEmpty(values);
      }
    }
  }

  return uniqueNonEmpty(values);
}

function extractCommentaryText(root: HTMLElement): string {
  const candidates = [
    root.querySelector<HTMLElement>('[data-view-name*="commentary"]')?.textContent,
    root.querySelector<HTMLElement>('[data-view-name*="description"]')?.textContent,
    root.querySelector<HTMLElement>('p')?.textContent
  ];

  return normalizeText(firstNonEmpty(candidates) ?? '').slice(0, 360);
}

function fallbackPayload(renderRoot: HTMLElement, featureRoot: HTMLElement): string {
  const scope = featureRoot ?? renderRoot;

  const normalizedUpdateLinks = collectFeedUpdateLinks(renderRoot, featureRoot)
    .map((href) => normalizeUpdateLink(href))
    .filter((value): value is string => Boolean(value))
    .slice(0, 6)
    .join('|');

  const actorSignature = uniqueNonEmpty(
    [...scope.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"], a[href*="/company/"], a[href*="/school/"], a[href*="/groups/"]')]
      .slice(0, 6)
      .flatMap((link) => [normalizeText(link.textContent ?? ''), normalizeLinkForFallback(link.href)])
  ).join('|');

  const timestamp = firstNonEmpty([
    scope.querySelector('time')?.getAttribute('datetime'),
    scope.querySelector('time')?.textContent,
    renderRoot.querySelector('time')?.getAttribute('datetime'),
    renderRoot.querySelector('time')?.textContent
  ]);

  const links = uniqueNonEmpty(
    [...scope.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .map((link) => link.href)
      .filter((href) => !isNonUniqueCompanyPostsUrl(href))
      .map((href) => normalizeLinkForFallback(href))
      .slice(0, 10)
  )
    .sort()
    .join('|');

  const mediaSignature = [
    scope.querySelectorAll('video').length,
    scope.querySelectorAll('img').length,
    scope.querySelectorAll('iframe').length,
    scope.querySelectorAll('[aria-roledescription="carousel"]').length,
    scope.querySelectorAll('[data-view-name*="document"]').length
  ].join(':');

  const heading = normalizeText(
    firstNonEmpty([
      scope.querySelector('h1, h2, h3, h4')?.textContent,
      scope.querySelector('[data-test-id*="actor-name"]')?.textContent,
      scope.querySelector('[data-view-name*="feed-header-text"]')?.textContent
    ]) ?? ''
  );

  const commentary = extractCommentaryText(scope);
  const leadText = normalizeText(scope.textContent ?? '').slice(0, 420);

  return [normalizedUpdateLinks, actorSignature, timestamp ?? '', mediaSignature, heading, commentary, links, leadText].join('|');
}

export function derivePostIdentity(renderRoot: HTMLElement, featureRoot: HTMLElement = renderRoot): PostIdentity {
  const strongAttrCandidates = collectStrongAttributeCandidates(renderRoot, featureRoot);
  for (const value of strongAttrCandidates) {
    const urn = extractUrnFromText(value);
    if (urn) {
      return { postId: urn, source: 'strong_attr' };
    }
  }

  const feedUpdateLinks = collectFeedUpdateLinks(renderRoot, featureRoot);
  for (const link of feedUpdateLinks) {
    const urn = extractUrnFromUpdateUrl(link);
    if (urn) {
      return { postId: urn, source: 'feed_update_url' };
    }
  }

  const componentKeys = collectComponentKeyCandidates(renderRoot, featureRoot);
  for (const key of componentKeys) {
    const urn = extractUrnFromText(key);
    if (urn) {
      return { postId: urn, source: 'componentkey' };
    }
  }

  for (const link of feedUpdateLinks) {
    const normalized = normalizeUpdateLink(link);
    if (normalized) {
      return { postId: normalized, source: 'feed_update_url' };
    }
  }

  return {
    postId: `generated:${fnv1aHash(fallbackPayload(renderRoot, featureRoot))}`,
    source: 'fallback_hash'
  };
}

export function derivePostId(renderRoot: HTMLElement, featureRoot: HTMLElement = renderRoot): string {
  return derivePostIdentity(renderRoot, featureRoot).postId;
}
