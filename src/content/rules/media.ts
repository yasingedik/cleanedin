import type { CategoryRule } from './types';
import { hasExternalLink, rootHasAnySelector } from './helpers';

const IMAGE_SIGNAL_SELECTOR = [
  'img[data-test-id*="image"]',
  'figure img',
  'a[href*="/feed/update/"] img',
  '[data-test-id*="image-component"] img'
].join(', ');

const IMAGE_EXCLUDE_SELECTOR = [
  '[class*="avatar"]',
  '[data-test-id*="entity-image"]',
  '[data-test-id*="profile-photo"]',
  '[aria-label*="profile"]'
].join(', ');

function hasMeaningfulImage(postRoot: HTMLElement): boolean {
  const images = [...postRoot.querySelectorAll<HTMLImageElement>(IMAGE_SIGNAL_SELECTOR)];

  return images.some((image) => {
    if (image.closest(IMAGE_EXCLUDE_SELECTOR)) {
      return false;
    }

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (width === 0 && height === 0) {
      return false;
    }

    return width * height >= 40_000 || width >= 220 || height >= 220;
  });
}

export const videoRule: CategoryRule = {
  id: 'video.structural',
  category: 'video',
  priority: 90,
  match: (post) =>
    rootHasAnySelector(post, [
      'video',
      '[data-test-id*="video"]',
      'iframe[src*="youtube.com"]',
      'iframe[src*="vimeo.com"]'
    ])
};

export const pollRule: CategoryRule = {
  id: 'poll.structural',
  category: 'poll',
  priority: 88,
  match: (post) =>
    rootHasAnySelector(post, [
      '[data-test-id*="poll"]',
      '[role="progressbar"][aria-valuenow]',
      'form[action*="poll"]'
    ])
};

export const imageRule: CategoryRule = {
  id: 'image.structural',
  category: 'image',
  priority: 50,
  match: (post) => hasMeaningfulImage(post.root)
};

export const linkRule: CategoryRule = {
  id: 'link.structural',
  category: 'link',
  priority: 45,
  match: (post) => hasExternalLink(post)
};

export const carouselRule: CategoryRule = {
  id: 'carousel.structural',
  category: 'carousel',
  priority: 80,
  match: (post) =>
    rootHasAnySelector(post, [
      '[aria-roledescription="carousel"]',
      '[data-test-id*="multi-image"]',
      '[data-test-id*="document"]',
      'a[href*="/document/"]'
    ])
};
