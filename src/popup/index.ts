import githubSponsorsIcon from './assets/github-sponsors.svg';
import koFiIcon from './assets/ko-fi.svg';
import { getConfiguredDonationOptions } from '../shared/donations';
import { ALL_CATEGORIES } from '../shared/schema';
import { getSettings, updateLocalSettings, updateSyncSettings } from '../shared/storage';
import type {
  CategoryActions,
  ConnectionLevel,
  ConnectionLevelActions,
  FilterAction,
  FilterSettings,
  FilterSettingsLocal,
  FilterSettingsSync,
  PostCategory,
  ProfileType,
  ProfileTypeActions,
  ValueFilterAction
} from '../shared/types';

const CATEGORY_LABELS: Record<PostCategory, string> = {
  ad: 'Ads / Promoted',
  suggested: 'Suggested',
  recommendation: 'Recommended for you',
  liked: 'Liked',
  loved: 'Loved',
  supported: 'Supported',
  celebrated: 'Celebrated',
  funny: 'Funny',
  insightful: 'Insightful',
  commented: 'Commented',
  followed: 'Followed / Following',
  shared: 'Shared/Reposted',
  video: 'Video',
  poll: 'Poll',
  image: 'Image',
  link: 'Link',
  carousel: 'Carousel/Document'
};

const CONNECTION_LEVEL_OPTIONS: Array<{ value: ConnectionLevel; label: string }> = [
  { value: 'following', label: 'Following authors' },
  { value: 'first', label: '1st' },
  { value: 'second', label: '2nd' },
  { value: 'third_plus', label: '3rd+' }
];

const PROFILE_TYPE_OPTIONS: Array<{ value: ProfileType; label: string }> = [
  { value: 'individual', label: 'Individuals' },
  { value: 'group', label: 'Groups' },
  { value: 'company', label: 'Companies' },
  { value: 'other', label: 'Other profiles' }
];

const DONATION_ICONS = {
  github_sponsors: githubSponsorsIcon,
  ko_fi: koFiIcon
} as const;

type ActionModel = 'category' | 'value';
type AnyAction = FilterAction | ValueFilterAction;

const CATEGORY_ACTION_ORDER: FilterAction[] = ['show', 'hide'];
const VALUE_ACTION_ORDER: ValueFilterAction[] = ['off', 'hide'];

const ACTION_LABELS: Record<AnyAction, string> = {
  off: 'Off',
  show: 'Show',
  hide: 'Hide'
};
const SECTION_STATE_STORAGE_KEY = 'cleanedin-popup-section-state-v1';

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element: ${id}`);
  }

  return el as T;
}

const enabled = getElement<HTMLInputElement>('enabled');
const showBadgeOnHidden = getElement<HTMLInputElement>('showBadgeOnHidden');
const categories = getElement<HTMLDivElement>('categories');

const includeKeywords = getElement<HTMLTextAreaElement>('includeKeywords');
const includeKeywordsAction = getElement<HTMLButtonElement>('includeKeywordsAction');
const excludeKeywords = getElement<HTMLTextAreaElement>('excludeKeywords');
const excludeKeywordsAction = getElement<HTMLButtonElement>('excludeKeywordsAction');

const hiddenNames = getElement<HTMLTextAreaElement>('hiddenNames');
const hiddenNamesAction = getElement<HTMLButtonElement>('hiddenNamesAction');
const connectionLevelActionsContainer = getElement<HTMLDivElement>('connectionLevelActions');
const profileTypeActionsContainer = getElement<HTMLDivElement>('profileTypeActions');

const maxAgeDays = getElement<HTMLInputElement>('maxAgeDays');
const ageAction = getElement<HTMLButtonElement>('ageAction');

const debug = getElement<HTMLInputElement>('debug');
const exportBtn = getElement<HTMLButtonElement>('exportBtn');
const importBtn = getElement<HTMLButtonElement>('importBtn');
const importFile = getElement<HTMLInputElement>('importFile');
const donationLinks = getElement<HTMLDivElement>('donationLinks');
const status = getElement<HTMLParagraphElement>('status');

let hydrating = false;

function parseList(input: string): string[] {
  const set = new Set(
    input
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return [...set];
}

function setStatus(text: string): void {
  status.textContent = text;
  window.setTimeout(() => {
    if (status.textContent === text) {
      status.textContent = '';
    }
  }, 1500);
}

function setActionSwitch(button: HTMLButtonElement, action: AnyAction): void {
  button.dataset.action = action;
  button.textContent = ACTION_LABELS[action];
  button.classList.remove('action-off', 'action-show', 'action-hide');
  button.classList.add(`action-${action}`);
}

function readSectionState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SECTION_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') {
        normalized[key] = value;
      }
    }

    return normalized;
  } catch {
    return {};
  }
}

function persistSectionState(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(SECTION_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage failures in private/incognito contexts.
  }
}

function applyPersistedSectionState(): void {
  const state = readSectionState();
  const sections = document.querySelectorAll<HTMLDetailsElement>('details.section[data-section-key]');

  for (const section of sections) {
    const key = section.dataset.sectionKey;
    if (!key || !(key in state)) {
      continue;
    }

    section.open = state[key];
  }
}

function readActionSwitch(button: HTMLButtonElement): FilterAction {
  return button.dataset.action === 'hide' ? 'hide' : 'show';
}

function readValueActionSwitch(button: HTMLButtonElement): ValueFilterAction {
  return button.dataset.action === 'hide' ? 'hide' : 'off';
}

function toggleAction(button: HTMLButtonElement): void {
  const model = (button.dataset.actionModel as ActionModel | undefined) ?? 'category';

  if (model === 'value') {
    const current = readValueActionSwitch(button);
    const index = VALUE_ACTION_ORDER.indexOf(current);
    const next = VALUE_ACTION_ORDER[(index + 1) % VALUE_ACTION_ORDER.length];
    setActionSwitch(button, next);
    return;
  }

  const current = readActionSwitch(button);
  const index = CATEGORY_ACTION_ORDER.indexOf(current);
  const next = CATEGORY_ACTION_ORDER[(index + 1) % CATEGORY_ACTION_ORDER.length];
  setActionSwitch(button, next);
}

function renderDonationLinks(): void {
  donationLinks.innerHTML = '';

  const options = getConfiguredDonationOptions();
  if (options.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'support-empty';
    empty.textContent = 'No donation links configured yet.';
    donationLinks.appendChild(empty);
    return;
  }

  for (const option of options) {
    const link = document.createElement('a');
    link.className = 'donation-link';
    link.href = option.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const icon = document.createElement('img');
    icon.className = 'donation-icon';
    icon.src = DONATION_ICONS[option.id];
    icon.alt = option.iconAlt;
    icon.loading = 'lazy';

    const textWrap = document.createElement('div');
    textWrap.className = 'donation-text';

    const label = document.createElement('span');
    label.textContent = option.label;

    const detail = document.createElement('small');
    detail.textContent = option.description;

    textWrap.append(label, detail);
    link.append(icon, textWrap);
    donationLinks.appendChild(link);
  }
}

function renderCategories(actions: CategoryActions): void {
  categories.innerHTML = '';

  for (const category of ALL_CATEGORIES) {
    const card = document.createElement('div');
    card.className = 'category-card';

    const text = document.createElement('span');
    text.className = 'category-label';
    text.textContent = CATEGORY_LABELS[category];

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-switch';
    button.dataset.actionSwitch = '1';
    button.dataset.actionModel = 'category';
    button.dataset.category = category;
    setActionSwitch(button, actions[category]);

    card.append(text, button);
    categories.appendChild(card);
  }
}

function renderConnectionLevelActions(actions: ConnectionLevelActions): void {
  connectionLevelActionsContainer.innerHTML = '';

  for (const option of CONNECTION_LEVEL_OPTIONS) {
    const card = document.createElement('div');
    card.className = 'identity-action-card';

    const text = document.createElement('span');
    text.className = 'category-label';
    text.textContent = option.label;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-switch';
    button.dataset.actionSwitch = '1';
    button.dataset.actionModel = 'category';
    button.dataset.connectionLevelAction = option.value;
    setActionSwitch(button, actions[option.value]);

    card.append(text, button);
    connectionLevelActionsContainer.appendChild(card);
  }
}

function renderProfileTypeActions(actions: ProfileTypeActions): void {
  profileTypeActionsContainer.innerHTML = '';

  for (const option of PROFILE_TYPE_OPTIONS) {
    const card = document.createElement('div');
    card.className = 'identity-action-card';

    const text = document.createElement('span');
    text.className = 'category-label';
    text.textContent = option.label;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-switch';
    button.dataset.actionSwitch = '1';
    button.dataset.actionModel = 'category';
    button.dataset.profileTypeAction = option.value;
    setActionSwitch(button, actions[option.value]);

    card.append(text, button);
    profileTypeActionsContainer.appendChild(card);
  }
}

function selectedConnectionLevelActions(): ConnectionLevelActions {
  const actions = {} as ConnectionLevelActions;
  for (const option of CONNECTION_LEVEL_OPTIONS) {
    const button = connectionLevelActionsContainer.querySelector<HTMLButtonElement>(
      `button[data-connection-level-action="${option.value}"]`
    );
    actions[option.value] = button ? readActionSwitch(button) : 'show';
  }
  return actions;
}

function selectedProfileTypeActions(): ProfileTypeActions {
  const actions = {} as ProfileTypeActions;
  for (const option of PROFILE_TYPE_OPTIONS) {
    const button = profileTypeActionsContainer.querySelector<HTMLButtonElement>(
      `button[data-profile-type-action="${option.value}"]`
    );
    actions[option.value] = button ? readActionSwitch(button) : 'show';
  }
  return actions;
}

function selectedCategoryActions(): CategoryActions {
  const actions = {} as CategoryActions;
  for (const category of ALL_CATEGORIES) {
    const button = categories.querySelector<HTMLButtonElement>(`button[data-category="${category}"]`);
    actions[category] = button ? readActionSwitch(button) : 'show';
  }
  return actions;
}

function hydrate(settings: FilterSettings): void {
  hydrating = true;

  enabled.checked = settings.enabled;
  showBadgeOnHidden.checked = settings.showBadgeOnHidden;
  renderCategories(settings.categoryActions);

  includeKeywords.value = settings.includeKeywords.join('\n');
  setActionSwitch(includeKeywordsAction, settings.includeKeywordsAction);

  excludeKeywords.value = settings.excludeKeywords.join('\n');
  setActionSwitch(excludeKeywordsAction, settings.excludeKeywordsAction);

  hiddenNames.value = settings.hiddenNames.join('\n');
  setActionSwitch(hiddenNamesAction, settings.hiddenNamesAction);

  renderConnectionLevelActions(settings.connectionLevelActions);
  renderProfileTypeActions(settings.profileTypeActions);

  maxAgeDays.value = settings.ageFilter.maxAgeDays?.toString() ?? '';
  setActionSwitch(ageAction, settings.ageFilter.action);
  maxAgeDays.disabled = settings.ageFilter.action === 'off';

  debug.checked = settings.debug;
  hydrating = false;
}

function readSyncSettings(): Partial<FilterSettingsSync> {
  return {
    enabled: enabled.checked,
    showBadgeOnHidden: showBadgeOnHidden.checked,
    categoryActions: selectedCategoryActions()
  };
}

function readLocalSettings(): Partial<FilterSettingsLocal> {
  const ageRaw = maxAgeDays.value.trim();
  const parsedAge = ageRaw ? Number(ageRaw) : null;

  return {
    includeKeywords: parseList(includeKeywords.value),
    includeKeywordsAction: readValueActionSwitch(includeKeywordsAction),
    excludeKeywords: parseList(excludeKeywords.value),
    excludeKeywordsAction: readValueActionSwitch(excludeKeywordsAction),
    hiddenNames: parseList(hiddenNames.value),
    hiddenNamesAction: readValueActionSwitch(hiddenNamesAction),
    connectionLevelActions: selectedConnectionLevelActions(),
    profileTypeActions: selectedProfileTypeActions(),
    ageFilter: {
      maxAgeDays: typeof parsedAge === 'number' && !Number.isNaN(parsedAge) && parsedAge >= 1 ? parsedAge : null,
      action: readValueActionSwitch(ageAction)
    },
    debug: debug.checked
  };
}

async function persistFromUI(): Promise<void> {
  if (hydrating) {
    return;
  }

  await Promise.all([updateSyncSettings(readSyncSettings()), updateLocalSettings(readLocalSettings())]);
  setStatus('Saved');
}

function bindUIEvents(): void {
  const sections = document.querySelectorAll<HTMLDetailsElement>('details.section[data-section-key]');
  for (const section of sections) {
    section.addEventListener('toggle', () => {
      const key = section.dataset.sectionKey;
      if (!key) {
        return;
      }

      const next = readSectionState();
      next[key] = section.open;
      persistSectionState(next);
    });
  }

  document.body.addEventListener('change', () => {
    maxAgeDays.disabled = readValueActionSwitch(ageAction) === 'off';
    void persistFromUI();
  });

  document.body.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const actionButton = target?.closest<HTMLButtonElement>('button[data-action-switch]');
    if (!actionButton) {
      return;
    }

    toggleAction(actionButton);
    maxAgeDays.disabled = readValueActionSwitch(ageAction) === 'off';
    void persistFromUI();
  });

  includeKeywords.addEventListener('blur', () => void persistFromUI());
  excludeKeywords.addEventListener('blur', () => void persistFromUI());
  hiddenNames.addEventListener('blur', () => void persistFromUI());
  maxAgeDays.addEventListener('blur', () => void persistFromUI());

  exportBtn.addEventListener('click', async () => {
    const settings = await getSettings();
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cleanedin-settings.json';
    anchor.click();

    URL.revokeObjectURL(url);
    setStatus('Exported');
  });

  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = JSON.parse(await file.text()) as Partial<FilterSettings>;

      await Promise.all([
        updateSyncSettings(raw as unknown as Partial<FilterSettingsSync>),
        updateLocalSettings(raw as unknown as Partial<FilterSettingsLocal>)
      ]);

      hydrate(await getSettings());
      setStatus('Imported');
    } catch (error) {
      if (debug.checked) {
        console.error('[cleanedin] Settings import error:', error);
      }
      setStatus('Invalid settings file');
    } finally {
      importFile.value = '';
    }
  });
}

async function boot(): Promise<void> {
  applyPersistedSectionState();
  renderDonationLinks();
  bindUIEvents();
  hydrate(await getSettings());
}

void boot();
