import type {
  CategoryActions,
  ConnectionLevel,
  ConnectionLevelActions,
  FilterAction,
  FilterMode,
  FilterSettings,
  FilterSettingsLocal,
  FilterSettingsSync,
  PostCategory,
  ProfileType,
  ProfileTypeActions,
  ValueFilterAction
} from './types';

export const SCHEMA_VERSION = 6;

export const ALL_CATEGORIES = [
  'ad',
  'suggested',
  'recommendation',
  'liked',
  'loved',
  'supported',
  'celebrated',
  'funny',
  'insightful',
  'commented',
  'followed',
  'shared',
  'video',
  'poll',
  'image',
  'link',
  'carousel'
] as const;

const FILTER_ACTIONS: readonly FilterAction[] = ['show', 'hide'] as const;
const VALUE_FILTER_ACTIONS: readonly ValueFilterAction[] = ['off', 'hide'] as const;
const CATEGORY_SET = new Set<PostCategory>(ALL_CATEGORIES);
const FILTER_ACTION_SET = new Set<FilterAction>(FILTER_ACTIONS);
const VALUE_FILTER_ACTION_SET = new Set<ValueFilterAction>(VALUE_FILTER_ACTIONS);

const CONNECTION_LEVELS: readonly ConnectionLevel[] = ['following', 'first', 'second', 'third_plus'] as const;
const PROFILE_TYPES: readonly ProfileType[] = ['individual', 'group', 'company', 'other'] as const;
const CONNECTION_LEVEL_SET = new Set<ConnectionLevel>(CONNECTION_LEVELS);
const PROFILE_TYPE_SET = new Set<ProfileType>(PROFILE_TYPES);

function createCategoryActions(defaultAction: FilterAction): CategoryActions {
  return ALL_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = defaultAction;
      return acc;
    },
    {} as CategoryActions
  );
}

function createDefaultCategoryActions(): CategoryActions {
  const actions = createCategoryActions('show');
  actions.ad = 'hide';
  return actions;
}

function createConnectionLevelActions(defaultAction: FilterAction): ConnectionLevelActions {
  return CONNECTION_LEVELS.reduce(
    (acc, level) => {
      acc[level] = defaultAction;
      return acc;
    },
    {} as ConnectionLevelActions
  );
}

function createProfileTypeActions(defaultAction: FilterAction): ProfileTypeActions {
  return PROFILE_TYPES.reduce(
    (acc, profileType) => {
      acc[profileType] = defaultAction;
      return acc;
    },
    {} as ProfileTypeActions
  );
}

export const DEFAULT_SYNC_SETTINGS: FilterSettingsSync = {
  enabled: true,
  categoryActions: createDefaultCategoryActions(),
  showBadgeOnHidden: true
};

export const DEFAULT_LOCAL_SETTINGS: FilterSettingsLocal = {
  includeKeywords: [],
  includeKeywordsAction: 'off',
  excludeKeywords: [],
  excludeKeywordsAction: 'off',
  hiddenNames: [],
  hiddenNamesAction: 'off',
  connectionLevelActions: createConnectionLevelActions('show'),
  profileTypeActions: createProfileTypeActions('show'),
  ageFilter: { maxAgeDays: null, action: 'off' },
  debug: false,
  schemaVersion: SCHEMA_VERSION
};

function normalizeSelectedCategories(value: unknown): PostCategory[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = new Set<PostCategory>();

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    if (entry === 'promoted') {
      normalized.add('ad');
      continue;
    }

    if (entry === 'recommended') {
      normalized.add('suggested');
      continue;
    }

    if (CATEGORY_SET.has(entry as PostCategory)) {
      normalized.add(entry as PostCategory);
    }
  }

  return [...normalized];
}

function normalizeConnectionLevel(value: string): ConnectionLevel | null {
  if (CONNECTION_LEVEL_SET.has(value as ConnectionLevel)) {
    return value as ConnectionLevel;
  }

  switch (value) {
    case 'followed':
      return 'following';
    case '1st':
      return 'first';
    case '2nd':
      return 'second';
    case '3rd':
    case '3rd+':
      return 'third_plus';
    default:
      return null;
  }
}

function normalizeProfileType(value: string): ProfileType | null {
  if (PROFILE_TYPE_SET.has(value as ProfileType)) {
    return value as ProfileType;
  }

  switch (value) {
    case 'individuals':
      return 'individual';
    case 'groups':
      return 'group';
    case 'companies':
      return 'company';
    default:
      return null;
  }
}

function normalizeFilterAction(value: unknown, fallback: FilterAction = 'show'): FilterAction {
  if (value === 'off') {
    return 'show';
  }

  if (typeof value === 'string' && FILTER_ACTION_SET.has(value as FilterAction)) {
    return value as FilterAction;
  }

  return fallback;
}

function normalizeValueFilterAction(value: unknown, fallback: ValueFilterAction = 'off'): ValueFilterAction {
  if (value === 'show') {
    return 'off';
  }

  if (typeof value === 'string' && VALUE_FILTER_ACTION_SET.has(value as ValueFilterAction)) {
    return value as ValueFilterAction;
  }

  return fallback;
}

function sanitizeCategoryActions(value: unknown, fallback: CategoryActions): CategoryActions {
  const normalized: CategoryActions = { ...fallback };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized;
  }

  const source = value as Record<string, unknown>;
  for (const category of ALL_CATEGORIES) {
    if (source[category] === undefined) {
      continue;
    }

    normalized[category] = normalizeFilterAction(source[category], normalized[category]);
  }

  if (source.promoted !== undefined && source.ad === undefined) {
    normalized.ad = normalizeFilterAction(source.promoted, normalized.ad);
  }

  if (source.recommended !== undefined && source.suggested === undefined) {
    normalized.suggested = normalizeFilterAction(source.recommended, normalized.suggested);
  }

  return normalized;
}

function sanitizeConnectionLevels(value: unknown): ConnectionLevel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Set<ConnectionLevel>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const mapped = normalizeConnectionLevel(entry);
    if (mapped) {
      normalized.add(mapped);
    }
  }

  return [...normalized];
}

function sanitizeConnectionLevelActions(value: unknown, fallback: ConnectionLevelActions): ConnectionLevelActions {
  const normalized: ConnectionLevelActions = { ...fallback };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized;
  }

  const source = value as Record<string, unknown>;
  for (const level of CONNECTION_LEVELS) {
    if (source[level] === undefined) {
      continue;
    }

    normalized[level] = normalizeFilterAction(source[level], normalized[level]);
  }

  return normalized;
}

function sanitizeProfileTypes(value: unknown): ProfileType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Set<ProfileType>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const mapped = normalizeProfileType(entry);
    if (mapped) {
      normalized.add(mapped);
    }
  }

  return [...normalized];
}

function sanitizeProfileTypeActions(value: unknown, fallback: ProfileTypeActions): ProfileTypeActions {
  const normalized: ProfileTypeActions = { ...fallback };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized;
  }

  const source = value as Record<string, unknown>;
  for (const profileType of PROFILE_TYPES) {
    if (source[profileType] === undefined) {
      continue;
    }

    normalized[profileType] = normalizeFilterAction(source[profileType], normalized[profileType]);
  }

  return normalized;
}

export function sanitizeHiddenNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const MAX_NAMES = 200;
  const MAX_NAME_LENGTH = 120;

  const deduped = new Set(
    value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .map((entry) => entry.replace(/\s+/g, ' '))
      .map((entry) => entry.slice(0, MAX_NAME_LENGTH))
      .filter(Boolean)
  );

  return [...deduped].slice(0, MAX_NAMES);
}

export function sanitizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const MAX_KEYWORDS = 200;
  const MAX_KEYWORD_LENGTH = 80;

  const deduped = new Set(
    value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .map((entry) => entry.replace(/\s+/g, ' '))
      .map((entry) => entry.slice(0, MAX_KEYWORD_LENGTH))
      .filter(Boolean)
  );

  return [...deduped].slice(0, MAX_KEYWORDS);
}

type LegacySyncFields = {
  mode?: FilterMode;
  selectedCategories?: unknown;
};

type LegacyAgeFields = {
  enabled?: unknown;
  maxAgeDays?: unknown;
  maxAgeHours?: unknown;
  action?: unknown;
};

type LegacyLocalFields = {
  ageFilter?: LegacyAgeFields;
  connectionLevels?: unknown;
  connectionLevelsAction?: unknown;
  profileTypes?: unknown;
  profileTypesAction?: unknown;
  connectionLevelActions?: unknown;
  profileTypeActions?: unknown;
};

export function migrateLocalSettings(input: Partial<FilterSettingsLocal> | undefined): FilterSettingsLocal {
  const src = input ?? {};
  const legacy = src as unknown as LegacyLocalFields;

  const includeKeywords = sanitizeKeywords(src.includeKeywords);
  const excludeKeywords = sanitizeKeywords(src.excludeKeywords);
  const hiddenNames = sanitizeHiddenNames(src.hiddenNames);
  const legacyConnectionLevels = sanitizeConnectionLevels(legacy.connectionLevels);
  const legacyConnectionLevelsAction = normalizeFilterAction(
    legacy.connectionLevelsAction,
    legacyConnectionLevels.length > 0 ? 'hide' : 'show'
  );
  const legacyProfileTypes = sanitizeProfileTypes(legacy.profileTypes);
  const legacyProfileTypesAction = normalizeFilterAction(
    legacy.profileTypesAction,
    legacyProfileTypes.length > 0 ? 'hide' : 'show'
  );

  const hasConnectionLevelActionMap =
    legacy.connectionLevelActions !== undefined &&
    typeof legacy.connectionLevelActions === 'object' &&
    !Array.isArray(legacy.connectionLevelActions);
  const hasProfileTypeActionMap =
    legacy.profileTypeActions !== undefined &&
    typeof legacy.profileTypeActions === 'object' &&
    !Array.isArray(legacy.profileTypeActions);

  const connectionLevelActions = sanitizeConnectionLevelActions(
    legacy.connectionLevelActions,
    DEFAULT_LOCAL_SETTINGS.connectionLevelActions
  );
  const profileTypeActions = sanitizeProfileTypeActions(legacy.profileTypeActions, DEFAULT_LOCAL_SETTINGS.profileTypeActions);

  if (!hasConnectionLevelActionMap && legacyConnectionLevelsAction === 'hide') {
    for (const level of legacyConnectionLevels) {
      connectionLevelActions[level] = 'hide';
    }
  }

  if (!hasProfileTypeActionMap && legacyProfileTypesAction === 'hide') {
    for (const profileType of legacyProfileTypes) {
      profileTypeActions[profileType] = 'hide';
    }
  }

  const maxAgeDaysRaw = src.ageFilter?.maxAgeDays;
  const maxAgeHoursRaw = legacy.ageFilter?.maxAgeHours;
  const legacyAgeEnabled = Boolean(legacy.ageFilter?.enabled);

  const normalizedMaxAgeDays =
    typeof maxAgeDaysRaw === 'number' && Number.isFinite(maxAgeDaysRaw) && maxAgeDaysRaw >= 1
      ? Math.floor(maxAgeDaysRaw)
      : null;

  const parsedDays =
    normalizedMaxAgeDays !== null
      ? normalizedMaxAgeDays
      : typeof maxAgeHoursRaw === 'number' && Number.isFinite(maxAgeHoursRaw) && maxAgeHoursRaw >= 0
        ? Math.max(1, Math.round(maxAgeHoursRaw / 24))
        : null;

  return {
    includeKeywords,
    includeKeywordsAction: normalizeValueFilterAction(src.includeKeywordsAction, includeKeywords.length > 0 ? 'hide' : 'off'),
    excludeKeywords,
    excludeKeywordsAction: normalizeValueFilterAction(src.excludeKeywordsAction, excludeKeywords.length > 0 ? 'hide' : 'off'),
    hiddenNames,
    hiddenNamesAction: normalizeValueFilterAction(src.hiddenNamesAction, hiddenNames.length > 0 ? 'hide' : 'off'),
    connectionLevelActions,
    profileTypeActions,
    ageFilter: {
      maxAgeDays: parsedDays,
      action: normalizeValueFilterAction(src.ageFilter?.action, legacyAgeEnabled ? 'hide' : 'off')
    },
    debug: Boolean(src.debug),
    schemaVersion: SCHEMA_VERSION
  };
}

export function migrateSyncSettings(input: Partial<FilterSettingsSync> | undefined): FilterSettingsSync {
  const src = input ?? {};
  const legacy = src as unknown as LegacySyncFields;

  const hasModernCategoryActions =
    src.categoryActions !== undefined &&
    typeof src.categoryActions === 'object' &&
    src.categoryActions !== null &&
    !Array.isArray(src.categoryActions);
  const shouldApplyLegacyCategoryMode =
    !hasModernCategoryActions && (legacy.mode !== undefined || legacy.selectedCategories !== undefined);
  const legacySelection = normalizeSelectedCategories(legacy.selectedCategories);
  const categoryFallback = shouldApplyLegacyCategoryMode
    ? createCategoryActions('show')
    : DEFAULT_SYNC_SETTINGS.categoryActions;
  const categoryActions = sanitizeCategoryActions(src.categoryActions, categoryFallback);

  if (shouldApplyLegacyCategoryMode && legacySelection && legacySelection.length > 0) {
    if (legacy.mode === 'show_only_selected') {
      for (const category of ALL_CATEGORIES) {
        categoryActions[category] = 'hide';
      }
      for (const category of legacySelection) {
        categoryActions[category] = 'show';
      }
    } else {
      for (const category of legacySelection) {
        categoryActions[category] = 'hide';
      }
    }
  }

  return {
    enabled: src.enabled ?? DEFAULT_SYNC_SETTINGS.enabled,
    categoryActions,
    showBadgeOnHidden: src.showBadgeOnHidden ?? DEFAULT_SYNC_SETTINGS.showBadgeOnHidden
  };
}

export function mergeSettings(sync: FilterSettingsSync, local: FilterSettingsLocal): FilterSettings {
  return { ...sync, ...local };
}
