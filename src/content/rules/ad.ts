import type { CategoryRule } from './types';
import { rootHasAnySelector } from './helpers';

function hasPromotedLeadMarker(post: Parameters<CategoryRule['match']>[0]): boolean {
  const lead = post.leadText.slice(0, 420);
  if (!/\bpromoted\b/.test(lead) || /\bpromoted\s+to\b/.test(lead)) {
    return false;
  }

  return (
    post.profileType === 'company' ||
    /\bfollowers?\b/.test(lead) ||
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
