const PRIMARY_ID_ATTRIBUTES = [
  'data-urn',
  'data-id',
  'data-activity-urn',
  'data-update-id',
  'data-occludable-job-id',
  'id'
];

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

function tryStrongIdentifier(root: HTMLElement): string | null {
  for (const attr of PRIMARY_ID_ATTRIBUTES) {
    const value = root.getAttribute(attr);
    if (value?.trim()) {
      return value.trim();
    }
  }

  const activityNode = root.matches('[data-urn^="urn:li:activity:"]')
    ? root
    : root.querySelector<HTMLElement>('[data-urn^="urn:li:activity:"]');
  const activityUrn = activityNode?.getAttribute('data-urn');
  if (activityUrn?.trim()) {
    return activityUrn.trim();
  }

  const updateLink = root.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"]')?.href ?? null;
  if (updateLink) {
    return updateLink;
  }

  return null;
}

function fallbackPayload(root: HTMLElement): string {
  const canonicalLink = root.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"]')?.href ?? '';
  const authorLink = root.querySelector<HTMLAnchorElement>('a[href*="/in/"]')?.href ?? '';
  const timestamp = firstNonEmpty([
    root.querySelector('time')?.getAttribute('datetime'),
    root.querySelector('time')?.textContent
  ]);

  const links = [...root.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .map((link) => link.href.trim())
    .filter(Boolean)
    .sort()
    .slice(0, 8)
    .join('|');

  const mediaSignature = [
    root.querySelectorAll('video').length,
    root.querySelectorAll('img').length,
    root.querySelectorAll('iframe').length,
    root.querySelectorAll('[aria-roledescription="carousel"]').length
  ].join(':');

  const heading = normalizeText(
    firstNonEmpty([
      root.querySelector('h1, h2, h3, h4')?.textContent,
      root.querySelector('[data-test-id*="actor-name"]')?.textContent
    ]) ?? ''
  );
  const text = normalizeText(root.textContent ?? '').slice(0, 480);

  return [canonicalLink, authorLink, timestamp ?? '', mediaSignature, heading, links, text].join('|');
}

export function derivePostId(root: HTMLElement): string {
  const strongId = tryStrongIdentifier(root);
  if (strongId) {
    return strongId;
  }

  return `generated:${fnv1aHash(fallbackPayload(root))}`;
}
