import type { CategoryRule } from './types';
import { rootHasAnySelector } from './helpers';

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function containsPromotedToken(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  if (/\bpromoted\s+to\b/.test(normalized)) {
    return false;
  }

  if (/\bpromoted\b/.test(normalized)) {
    return true;
  }

  const compact = compactText(normalized);
  return compact.includes('promoted') && !compact.includes('promotedto');
}

function containsFollowersToken(value: string): boolean {
  const normalized = normalizeText(value);
  if (/\bfollowers?\b/.test(normalized)) {
    return true;
  }

  const compact = compactText(normalized);
  return compact.includes('follower') || compact.includes('followers');
}

function hasExactPromotedHeaderLabel(scope: ParentNode): boolean {
  const labelNodes = scope.querySelectorAll<HTMLElement>(
    [
      '[data-view-name*="feed-header"] p',
      '[data-view-name*="feed-header"] span',
      '[data-view-name*="feed-actor"] p',
      '[data-view-name*="feed-actor"] span',
      '[data-view-name*="feed-actor"] div'
    ].join(', ')
  );

  for (const node of [...labelNodes].slice(0, 48)) {
    if (normalizeText(node.textContent ?? '') === 'promoted') {
      return true;
    }
  }

  return false;
}

function hasPromotedHeaderMarker(post: Parameters<CategoryRule['match']>[0]): boolean {
  const scope = post.contentRoot ?? post.root;
  if (hasExactPromotedHeaderLabel(scope)) {
    return true;
  }

  const candidates: string[] = [];
  const seen = new Set<string>();

  const register = (raw: string | null | undefined, maxLength = 1200): void => {
    if (!raw) {
      return;
    }

    const normalized = normalizeText(raw).slice(0, maxLength);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  };

  const headerMenu = scope.querySelector<HTMLElement>('[data-view-name="feed-control-menu"]');
  register(headerMenu?.parentElement?.textContent);

  const feedHeader = scope.querySelector<HTMLElement>('[data-view-name="feed-header"]');
  register(feedHeader?.textContent);

  const actorImage = scope.querySelector<HTMLElement>('[data-view-name="feed-actor-image"], [data-view-name="feed-header-actor-image"]');
  register(actorImage?.parentElement?.textContent);
  const actorBlock = scope.querySelector<HTMLElement>('[data-view-name*="feed-actor"]');
  register(actorBlock?.textContent, 400);

  return candidates.some((candidate) => containsPromotedToken(candidate));
}

function hasPromotedLeadMarker(post: Parameters<CategoryRule['match']>[0]): boolean {
  const scope = post.contentRoot ?? post.root;
  const hasHeaderPromoted = hasPromotedHeaderMarker(post);
  const hasCommentaryNode = Boolean(scope.querySelector('[data-view-name="feed-commentary"]'));
  const lead = post.leadText.slice(0, 420);
  const hasLeadFallback = !hasCommentaryNode && containsPromotedToken(lead) && containsFollowersToken(lead);

  if (hasHeaderPromoted) {
    return true;
  }

  if (!hasLeadFallback) {
    return false;
  }

  return (
    post.profileType === 'company' ||
    containsFollowersToken(post.textContent.slice(0, 1800)) ||
    /\blearn more\b/.test(post.textContent.toLowerCase().slice(0, 900))
  );
}

export const adRule: CategoryRule = {
  id: 'ad.structural',
  category: 'ad',
  priority: 100,
  match: (post) =>
    rootHasAnySelector(post, [
      '[data-sponsored-update="true"]',
      '[data-test-ad-component]',
      '[data-ad-preview="true"]',
      '[data-test-id*="sponsored"]',
      '[data-view-tracking-scope*="SPONSORED_UPDATE_SERVED"]',
      '[data-view-tracking-scope*="SPONSORED"]',
      '[data-view-name*="sponsored"]',
      '[aria-label*="Sponsored"]',
      '[aria-label*="Promoted"]'
    ]) || hasPromotedLeadMarker(post)
};

export const promotedRule: CategoryRule = {
  id: 'promoted.structural',
  category: 'ad',
  priority: 95,
  match: (post) =>
    rootHasAnySelector(post, [
      '[data-control-name*="ad"]',
      '[data-test-id*="promoted"]',
      '[data-view-tracking-scope*="PROMOTED"]',
      '[data-view-name*="promoted"]',
      'a[href*="/ad/"]',
      '[aria-label*="Promoted"]'
    ]) || hasPromotedLeadMarker(post)
};
