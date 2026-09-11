import { afterEach, expect, it } from 'vitest';
import { decidePostVisibility } from '../../src/content/decision';
import {
  applyPostRendering,
  clearTemporaryReveals
} from '../../src/content/render';
import { features, settings } from '../fixtures/baseline/helpers';

afterEach(() => {
  clearTemporaryReveals();
  document.body.innerHTML = '';
});

it.each([
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '"><svg onload=alert(1)>'
])('renders matched keyword as literal badge text: %s', (payload) => {
  const root = document.createElement('article');
  root.setAttribute('data-urn', 'urn:li:activity:9001');
  root.textContent = `Fixture literal ${payload}`;
  document.body.append(root);
  const config = settings({
    excludeKeywordsAction: 'hide',
    excludeKeywords: [payload]
  });
  const post = features(root);
  const decision = decidePostVisibility(post, config);
  expect(decision.reasons).toEqual(['exclude_keyword_match']);
  applyPostRendering(post, decision, config);
  const badge = root.previousElementSibling!;
  expect(badge.querySelector('span')?.textContent).toBe(
    `Post hidden (keyword: "${payload}")`
  );
  expect(
    badge.querySelectorAll('script, img, svg, [onerror], [onload]')
  ).toHaveLength(0);
  expect(root.classList.contains('cleanedin-hidden')).toBe(true);
  badge.querySelector<HTMLButtonElement>('button')!.click();
  expect(root.classList.contains('cleanedin-hidden')).toBe(false);
  expect(root.textContent).toBe(`Fixture literal ${payload}`);
});
