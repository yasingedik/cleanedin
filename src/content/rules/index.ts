import { adRule, promotedRule } from './ad';
import {
  celebratedRule,
  commentedRule,
  followedRule,
  funnyRule,
  insightfulRule,
  likedRule,
  lovedRule,
  recommendationRule,
  sharedRule,
  suggestionRule,
  supportedRule
} from './engagement';
import { carouselRule, imageRule, linkRule, pollRule, videoRule } from './media';
import type { CategoryRule } from './types';

export const CATEGORY_RULES: CategoryRule[] = [
  adRule,
  promotedRule,
  videoRule,
  pollRule,
  carouselRule,
  suggestionRule,
  recommendationRule,
  sharedRule,
  likedRule,
  lovedRule,
  supportedRule,
  celebratedRule,
  funnyRule,
  insightfulRule,
  commentedRule,
  followedRule,
  imageRule,
  linkRule
].sort((a, b) => b.priority - a.priority);
