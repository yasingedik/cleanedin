import type { PostFeatures } from '../../shared/types';

const LINKEDIN_HOST = 'linkedin.com';

export function rootHasAnySelector(post: PostFeatures, selectors: string[]): boolean {
  return selectors.some((selector) => post.root.matches(selector) || Boolean(post.root.querySelector(selector)));
}

export function hasExternalLink(post: PostFeatures): boolean {
  return post.links.some((url) => {
    try {
      const parsed = new URL(url);
      return !parsed.hostname.includes(LINKEDIN_HOST);
    } catch {
      return false;
    }
  });
}
