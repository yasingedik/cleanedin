import type { PostCategory, PostFeatures, RuleResult } from '../shared/types';
import { CATEGORY_RULES } from './rules';

const HIGH_CONFIDENCE_LABELS: Set<PostCategory> = new Set(['ad', 'video', 'poll', 'carousel']);

export function classifyPost(post: PostFeatures): RuleResult {
  const labels = new Set<PostCategory>();

  for (const rule of CATEGORY_RULES) {
    if (rule.match(post)) {
      labels.add(rule.category);
    }
  }

  const confidence: RuleResult['confidence'] =
    labels.size === 0
      ? 'low'
      : [...labels].some((label) => HIGH_CONFIDENCE_LABELS.has(label)) || labels.size > 1
        ? 'high'
        : 'medium';

  return { labels, confidence };
}
