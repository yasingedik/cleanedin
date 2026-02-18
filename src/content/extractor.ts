import type { ConnectionLevel, PostFeatures, ProfileType } from '../shared/types';
import { derivePostId } from './post-id';

const RELATIVE_TOKEN_PATTERN =
  /(\d+)\s*(years?|yrs?|yr|y|months?|mos?|mo|weeks?|wks?|wk|w|days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m(?!o\b)|seconds?|secs?|sec|s)\b/gi;
const RELATIVE_TOKEN_FALLBACK_PATTERN =
  /(\d+)\s*(?:years?|yrs?|yr|y|months?|mos?|mo|weeks?|wks?|wk|w|days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m(?!o\b)|seconds?|secs?|sec|s)\b/i;
const RELATIVE_TOKEN_HEADER_PATTERN =
  /(?:^|[•·|])\s*(\d+\s*(?:years?|yrs?|yr|y|months?|mos?|mo|weeks?|wks?|wk|w|days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m(?!o\b)|seconds?|secs?|sec|s))\b/i;
const LEAD_TEXT_LENGTH = 360;
const ACTOR_LINK_SELECTOR = [
  'a[data-view-name*="actor"][href]',
  'a[data-test-id*="actor"][href]',
  'a[href*="/in/"]',
  'a[href*="/company/"]',
  'a[href*="/school/"]',
  'a[href*="/groups/"]'
].join(', ');
const ACTOR_SIGNAL_SELECTOR = [
  '[data-view-name*="feed-actor"]',
  '[data-view-name*="actor"]',
  '[data-test-id*="actor"]'
].join(', ');
const CONNECTION_CONTROL_SELECTOR = 'button, [role="button"], a[role="button"]';
const PROFILE_LINK_SELECTOR = ['a[href*="/in/"]', 'a[href*="/company/"]', 'a[href*="/school/"]', 'a[href*="/groups/"]'].join(
  ', '
);

const LEAD_ACTIVITY_NAME_PATTERNS = [
  /^(.+?)\s+(?:reposted|reshared|shared)\s+(?:this|a post)\b/i,
  /^(.+?)\s+(?:commented|liked|loves?|supports?|celebrates?|followed)\b/i,
  /^(.+?)\s+[•·|]\s*(?:following|1st|2nd|3rd\+?)\b/i,
  /^(.+?)\s+posted\b/i
] as const;

const HOURS_BY_UNIT: Record<string, number> = {
  y: 24 * 365,
  yr: 24 * 365,
  yrs: 24 * 365,
  year: 24 * 365,
  years: 24 * 365,
  mo: 24 * 30,
  mos: 24 * 30,
  month: 24 * 30,
  months: 24 * 30,
  w: 24 * 7,
  wk: 24 * 7,
  wks: 24 * 7,
  week: 24 * 7,
  weeks: 24 * 7,
  d: 24,
  day: 24,
  days: 24,
  h: 1,
  hr: 1,
  hrs: 1,
  hour: 1,
  hours: 1,
  m: 1 / 60,
  min: 1 / 60,
  mins: 1 / 60,
  minute: 1 / 60,
  minutes: 1 / 60,
  s: 1 / 3600,
  sec: 1 / 3600,
  secs: 1 / 3600,
  second: 1 / 3600,
  seconds: 1 / 3600
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractLeadText(root: HTMLElement): string {
  return normalizeText(root.textContent ?? '').slice(0, LEAD_TEXT_LENGTH);
}

function extractLeadTimestampToken(leadText: string): string | null {
  const head = leadText.slice(0, 220);
  const explicit = head.match(RELATIVE_TOKEN_HEADER_PATTERN)?.[1] ?? null;
  if (explicit) {
    return explicit;
  }

  return head.match(RELATIVE_TOKEN_FALLBACK_PATTERN)?.[0] ?? null;
}

function extractTimestampText(root: HTMLElement, leadText: string): string | null {
  const leadTimestamp = extractLeadTimestampToken(leadText);
  const candidates = [
    root.querySelector<HTMLElement>('time')?.getAttribute('datetime') ?? null,
    root.querySelector<HTMLElement>('time')?.textContent ?? null,
    root.querySelector<HTMLElement>('[data-test-id*="timestamp"]')?.textContent ?? null,
    root.querySelector<HTMLElement>('[data-view-name*="feed-actor"]')?.textContent ?? null,
    root.querySelector<HTMLElement>('[data-view-name*="actor"]')?.textContent ?? null,
    root.querySelector<HTMLElement>('a[href*="/feed/update/"] time')?.textContent ?? null,
    leadTimestamp
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return normalizeText(candidate);
    }
  }

  return null;
}

function parseDateHours(raw: string): number | null {
  const parsedDate = Date.parse(raw);
  if (Number.isNaN(parsedDate)) {
    return null;
  }

  const deltaHours = (Date.now() - parsedDate) / (1000 * 60 * 60);
  return deltaHours >= 0 ? deltaHours : null;
}

function parseRelativeHours(raw: string): number | null {
  let totalHours = 0;
  let tokenCount = 0;

  for (const match of raw.matchAll(RELATIVE_TOKEN_PATTERN)) {
    if (!match[1] || !match[2]) {
      continue;
    }

    const value = Number(match[1]);
    const multiplier = HOURS_BY_UNIT[match[2].toLowerCase()];

    if (Number.isNaN(value) || typeof multiplier !== 'number') {
      continue;
    }

    tokenCount += 1;
    totalHours += value * multiplier;
  }

  return tokenCount > 0 ? totalHours : null;
}

export function parseAgeHours(rawTimestamp: string | null): number | null {
  if (!rawTimestamp) {
    return null;
  }

  const source = normalizeText(rawTimestamp).toLowerCase();
  const looksLikeDate = /\d{4}-\d{2}-\d{2}/.test(source) || /\d{1,2}:\d{2}/.test(source) || source.includes('t');

  if (looksLikeDate) {
    const parsed = parseDateHours(source);
    if (parsed !== null) {
      return parsed;
    }
  }

  const relative = parseRelativeHours(source);
  if (relative !== null) {
    return relative;
  }

  return parseDateHours(source);
}

function extractLinks(root: HTMLElement): string[] {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href]');
  const unique = new Set<string>();

  for (const link of links) {
    if (link.href) {
      unique.add(link.href);
    }
  }

  return [...unique];
}

function normalizeActorName(value: string): string | null {
  const normalized = normalizeText(value)
    .replace(/\s+/g, ' ')
    .replace(/^[·•|,:;\-]+/, '')
    .replace(/[·•|,:;\-]+$/, '');

  if (normalized.length < 2 || normalized.length > 120) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const blocked = [
    'follow',
    'connect',
    'message',
    'see more',
    'view profile',
    'learn more',
    'subscribe'
  ];
  if (blocked.some((token) => lower === token)) {
    return null;
  }

  if (/\b(?:hours?|days?|weeks?|months?|years?|1st|2nd|3rd\+?)\b/i.test(normalized) && normalized.length < 8) {
    return null;
  }

  return normalized;
}

function extractActorNames(root: HTMLElement, leadText: string): string[] {
  const namesByKey = new Map<string, string>();

  const registerName = (value: string | null): void => {
    if (!value) {
      return;
    }

    const key = value.toLowerCase();
    if (!namesByKey.has(key)) {
      namesByKey.set(key, value);
    }
  };

  const anchors = root.querySelectorAll<HTMLAnchorElement>(ACTOR_LINK_SELECTOR);
  for (const anchor of anchors) {
    const normalized = normalizeActorName(anchor.textContent ?? '');
    registerName(normalized);

    if (namesByKey.size >= 20) {
      break;
    }
  }

  for (const pattern of LEAD_ACTIVITY_NAME_PATTERNS) {
    const match = leadText.match(pattern);
    const candidate = match?.[1] ?? null;
    if (!candidate) {
      continue;
    }

    const normalized = normalizeActorName(candidate);
    registerName(normalized);
  }

  const actorSignals = root.querySelectorAll<HTMLElement>(ACTOR_SIGNAL_SELECTOR);
  for (const signal of actorSignals) {
    const source = normalizeText(signal.textContent ?? '');
    if (!source) {
      continue;
    }

    const headByMarker = source.split(/[•·|]/)[0] ?? '';
    const beforeRelativeToken = headByMarker.replace(
      /\s+\d+\s*(?:years?|yrs?|yr|y|months?|mos?|mo|weeks?|wks?|wk|w|days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b.*$/i,
      ''
    );
    const normalized = normalizeActorName(beforeRelativeToken);
    registerName(normalized);

    if (namesByKey.size >= 20) {
      break;
    }
  }

  return [...namesByKey.values()];
}

function collectConnectionSignalTexts(root: HTMLElement, leadText: string): string[] {
  const signals: string[] = [];
  const seen = new Set<string>();

  const register = (raw: string | null, maxLength: number): void => {
    if (!raw || !raw.trim()) {
      return;
    }

    const normalized = normalizeText(raw).toLowerCase().slice(0, maxLength);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    signals.push(normalized);
  };

  const actorNodes = root.querySelectorAll<HTMLElement>(ACTOR_SIGNAL_SELECTOR);
  for (const node of actorNodes) {
    register(node.textContent, 280);
    if (signals.length >= 8) {
      break;
    }
  }

  const profileLinks = root.querySelectorAll<HTMLAnchorElement>(PROFILE_LINK_SELECTOR);
  for (const link of profileLinks) {
    register(link.textContent, 240);
    if (signals.length >= 12) {
      break;
    }
  }

  register(leadText, 240);
  return signals;
}

function extractControlText(node: Element): string {
  const text = [
    node.getAttribute('aria-label'),
    node.getAttribute('title'),
    (node as HTMLElement).textContent
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return normalizeText(text).toLowerCase();
}

function hasFollowingControlSignal(root: HTMLElement): boolean {
  const controls = root.querySelectorAll<HTMLElement>(CONNECTION_CONTROL_SELECTOR);

  for (const control of controls) {
    const controlText = extractControlText(control);
    if (!controlText) {
      continue;
    }

    const hasFollowingKeyword = /\bfollowing\b(?!\s+up\b)/.test(controlText) || /\bunfollow\b/.test(controlText);
    if (!hasFollowingKeyword) {
      continue;
    }

    const controlName = (control.getAttribute('data-control-name') ?? '').toLowerCase();
    const nearbyControlName = (control.closest<HTMLElement>('[data-control-name]')?.getAttribute('data-control-name') ?? '').toLowerCase();
    const hasFollowControlHint = controlName.includes('follow') || nearbyControlName.includes('follow') || /\bfollow\b/.test(controlText);

    if (hasFollowControlHint) {
      return true;
    }
  }

  return false;
}

function extractConnectionLevelFromSignal(signal: string): ConnectionLevel | null {
  const hasMarkerBoundToken = (token: string): boolean =>
    new RegExp(`(?:^|[•·|])\\s*${token}\\b`).test(signal) || new RegExp(`\\b${token}\\b\\s*(?:[•·|]|$)`).test(signal);

  const hasFollowingToken = /\bfollowing(?!\s*up\b)/.test(signal);
  const hasFollowersToken = /\bfollowers?\b/.test(signal);
  const hasConnectionMarkers = /[•·|]/.test(signal) || /\b(?:1st|2nd|3rd\+?)\b/.test(signal);
  const hasFollowingWithRelativeAge = /\bfollowing(?!\s*up\b)\s*\d+\s*(?:y|yr|yrs|mo|mos|w|wk|wks|d|h|m|s)\b/.test(signal);
  const hasFollowingAfterMarker = /(?:^|[•·|])\s*following(?!\s*up\b)/.test(signal);
  const hasFollowingNearTimestamp =
    /\bfollowing(?!\s*up\b)[^a-z0-9]{0,12}.{0,80}\b\d+\s*(?:y|yr|yrs|mo|mos|w|wk|wks|d|h|hr|hrs|m|min|mins)\b/.test(signal);

  if (
    !/\bfollowed\b/.test(signal) &&
    (hasFollowingAfterMarker ||
      /\bfollowing(?!\s*up\b)\s*(?:[•·|]|$)/.test(signal) ||
      hasFollowingWithRelativeAge ||
      (!hasFollowersToken && hasFollowingNearTimestamp) ||
      (hasFollowingToken && hasConnectionMarkers))
  ) {
    return 'following';
  }

  if (hasMarkerBoundToken('1st')) {
    return 'first';
  }

  if (hasMarkerBoundToken('2nd')) {
    return 'second';
  }

  if (hasMarkerBoundToken('3rd\\+?')) {
    return 'third_plus';
  }

  return null;
}

function extractConnectionLevel(root: HTMLElement, leadText: string): ConnectionLevel | null {
  if (hasFollowingControlSignal(root)) {
    return 'following';
  }

  const signals = collectConnectionSignalTexts(root, leadText);
  for (const signal of signals) {
    const level = extractConnectionLevelFromSignal(signal);
    if (level) {
      return level;
    }
  }

  return null;
}

function extractProfileType(
  root: HTMLElement,
  leadText: string,
  actorNames: string[],
  connectionLevel: ConnectionLevel | null
): ProfileType {
  const actorHref =
    root.querySelector<HTMLAnchorElement>('a[data-view-name*="feed-actor"][href]')?.href ??
    root.querySelector<HTMLAnchorElement>('a[data-view-name="feed-actor"][href]')?.href ??
    root.querySelector<HTMLAnchorElement>('a[data-view-name="feed-header-actor-image"][href]')?.href ??
    root.querySelector<HTMLAnchorElement>('a[data-view-name*="actor"][href]')?.href ??
    root.querySelector<HTMLAnchorElement>('a[href*="/in/"], a[href*="/company/"], a[href*="/groups/"], a[href*="/school/"]')?.href ??
    null;

  if (actorHref) {
    if (actorHref.includes('/in/')) {
      return 'individual';
    }

    if (actorHref.includes('/company/')) {
      return 'company';
    }

    if (actorHref.includes('/groups/')) {
      return 'group';
    }
  }

  const head = leadText.toLowerCase().slice(0, 200);
  const actorSignalText = normalizeText(root.querySelector<HTMLElement>(ACTOR_SIGNAL_SELECTOR)?.textContent ?? '').toLowerCase();
  if (head.includes('group')) {
    return 'group';
  }

  if (head.includes('followers')) {
    return 'company';
  }

  if (head.includes('company')) {
    return 'company';
  }

  if (/\b(?:following|1st|2nd|3rd\+?)\b/.test(actorSignalText)) {
    return 'individual';
  }

  if (connectionLevel || actorNames.length > 0) {
    return 'individual';
  }

  return 'other';
}

export function extractPostFeatures(root: HTMLElement): PostFeatures {
  const leadText = extractLeadText(root);
  const timestampText = extractTimestampText(root, leadText);
  const ageHours = parseAgeHours(timestampText);
  const actorNames = extractActorNames(root, leadText);
  const connectionLevel = extractConnectionLevel(root, leadText);

  return {
    postId: derivePostId(root),
    root,
    hasTimestamp: Boolean(timestampText),
    ageHours,
    leadText: leadText.toLowerCase(),
    actorNames,
    connectionLevel,
    profileType: extractProfileType(root, leadText, actorNames, connectionLevel),
    labels: new Set(),
    textContent: normalizeText(root.textContent ?? ''),
    links: extractLinks(root)
  };
}
