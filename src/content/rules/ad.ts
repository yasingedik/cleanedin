import type { CategoryRule } from './types';
import { rootHasAnySelector } from './helpers';

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
      '[aria-label*="Sponsored"]',
      '[aria-label*="Promoted"]'
    ])
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
      'a[href*="/ad/"]',
      '[aria-label*="Promoted"]'
    ])
};
