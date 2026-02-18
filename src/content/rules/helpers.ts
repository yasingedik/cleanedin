import type { PostFeatures } from '../../shared/types';

const LINKEDIN_HOST = 'linkedin.com';

export function rootHasAnySelector(post: PostFeatures, selectors: string[]): boolean {
  const scope = post.contentRoot ?? post.root;
  return selectors.some((selector) => scope.matches(selector) || Boolean(scope.querySelector(selector)));
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
