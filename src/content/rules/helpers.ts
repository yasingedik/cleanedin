import type { PostFeatures } from '../../shared/types';

const LINKEDIN_HOST = 'linkedin.com';
const LINKEDIN_HOST_SUFFIX = `.${LINKEDIN_HOST}`;

function isLinkedInHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.+$/, '');
  return normalized === LINKEDIN_HOST || normalized.endsWith(LINKEDIN_HOST_SUFFIX);
}

export function rootHasAnySelector(post: PostFeatures, selectors: string[]): boolean {
  const scope = post.contentRoot ?? post.root;
  return selectors.some((selector) => scope.matches(selector) || Boolean(scope.querySelector(selector)));
}

export function hasExternalLink(post: PostFeatures): boolean {
  return post.links.some((url) => {
    try {
      const parsed = new URL(url);
      return !isLinkedInHost(parsed.hostname);
    } catch {
      return false;
    }
  });
}
