export type FilterAction = 'show' | 'hide';
export type ValueFilterAction = 'off' | 'hide';

// Legacy types kept for migration support.
export type FilterMode = 'hide_selected' | 'show_only_selected';
export type UnknownPolicy = 'show_unknown' | 'hide_unknown';

export type ConnectionLevel = 'following' | 'first' | 'second' | 'third_plus';
export type ProfileType = 'individual' | 'group' | 'company' | 'other';
export type ConnectionLevelActions = Record<ConnectionLevel, FilterAction>;
export type ProfileTypeActions = Record<ProfileType, FilterAction>;

export type PostCategory =
  | 'ad'
  | 'suggested'
  | 'recommendation'
  | 'liked'
  | 'loved'
  | 'supported'
  | 'celebrated'
  | 'funny'
  | 'insightful'
  | 'commented'
  | 'followed'
  | 'shared'
  | 'video'
  | 'poll'
  | 'image'
  | 'link'
  | 'carousel';

export type CategoryActions = Record<PostCategory, FilterAction>;

export interface FilterSettingsSync {
  enabled: boolean;
  categoryActions: CategoryActions;
  showBadgeOnHidden: boolean;
}

export interface FilterSettingsLocal {
  includeKeywords: string[];
  includeKeywordsAction: ValueFilterAction;
  excludeKeywords: string[];
  excludeKeywordsAction: ValueFilterAction;
  hiddenNames: string[];
  hiddenNamesAction: ValueFilterAction;
  connectionLevelActions: ConnectionLevelActions;
  profileTypeActions: ProfileTypeActions;
  ageFilter: { maxAgeDays: number | null; action: ValueFilterAction };
  debug: boolean;
  schemaVersion: number;
}

export interface FilterSettings extends FilterSettingsSync, FilterSettingsLocal {}

export interface PostFeatures {
  postId: string;
  root: HTMLElement;
  hasTimestamp: boolean;
  ageHours: number | null;
  leadText: string;
  actorNames: string[];
  connectionLevel: ConnectionLevel | null;
  profileType: ProfileType | null;
  labels: Set<PostCategory>;
  textContent: string;
  links: string[];
}

export interface RuleResult {
  labels: Set<PostCategory>;
  confidence: 'high' | 'medium' | 'low';
}

export type DecisionReason =
  | 'category_match'
  | 'include_keyword_miss'
  | 'exclude_keyword_match'
  | 'hidden_name_match'
  | 'connection_level_match'
  | 'profile_type_match'
  | 'age_exceeded';

export interface DecisionReasonContext {
  matchedKeyword: string | null;
  missingKeywords: string[];
  matchedName: string | null;
  matchedConnectionLevel: ConnectionLevel | null;
  matchedProfileType: ProfileType | null;
  ageLimitDays: number | null;
}

export interface PostDecision {
  hide: boolean;
  reasons: DecisionReason[];
  isUnknown: boolean;
  hiddenCategory: PostCategory | null;
  reasonContext: DecisionReasonContext;
}
