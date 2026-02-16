import type { PostCategory, PostFeatures } from '../../shared/types';

export interface CategoryRule {
  id: string;
  category: PostCategory;
  priority: number;
  match(post: PostFeatures): boolean;
}
