import {
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_SYNC_SETTINGS,
  mergeSettings,
  migrateLocalSettings,
  migrateSyncSettings,
  sanitizeKeywords
} from './schema';
import type { FilterSettings, FilterSettingsLocal, FilterSettingsSync } from './types';

const memoryStorage: { sync: Record<string, unknown>; local: Record<string, unknown> } = {
  sync: { ...DEFAULT_SYNC_SETTINGS },
  local: { ...DEFAULT_LOCAL_SETTINGS }
};

type StorageAreaName = 'sync' | 'local';
const SYNC_STORAGE_KEYS = [...Object.keys(DEFAULT_SYNC_SETTINGS), 'mode', 'selectedCategories', 'unknownPolicy'];
const LOCAL_STORAGE_KEYS = [
  ...Object.keys(DEFAULT_LOCAL_SETTINGS),
  'connectionLevels',
  'connectionLevelsAction',
  'profileTypes',
  'profileTypesAction',
  'mode',
  'selectedCategories',
  'unknownPolicy'
];
const LEGACY_SYNC_STORAGE_KEYS = ['mode', 'selectedCategories', 'unknownPolicy'];
const LEGACY_LOCAL_STORAGE_KEYS = [
  'mode',
  'selectedCategories',
  'unknownPolicy',
  'connectionLevels',
  'connectionLevelsAction',
  'profileTypes',
  'profileTypesAction'
];

type ChangeMap = Record<string, chrome.storage.StorageChange>;

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local) && Boolean(chrome.storage?.sync);
}

function chromeGet(area: StorageAreaName, keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage[area].get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(items as Record<string, unknown>);
    });
  });
}

function chromeSet(area: StorageAreaName, values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage[area].set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function chromeRemove(area: StorageAreaName, keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage[area].remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

async function getArea(area: StorageAreaName, keys: string[]): Promise<Record<string, unknown>> {
  if (!hasChromeStorage()) {
    const source = memoryStorage[area];
    return keys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = source[key];
      return acc;
    }, {});
  }

  return chromeGet(area, keys);
}

async function setArea(area: StorageAreaName, values: Record<string, unknown>): Promise<void> {
  if (!hasChromeStorage()) {
    Object.assign(memoryStorage[area], values);
    return;
  }

  await chromeSet(area, values);
}

async function removeAreaKeys(area: StorageAreaName, keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  if (!hasChromeStorage()) {
    for (const key of keys) {
      delete memoryStorage[area][key];
    }
    return;
  }

  await chromeRemove(area, keys);
}

export async function getSyncSettings(): Promise<FilterSettingsSync> {
  const raw = await getArea('sync', SYNC_STORAGE_KEYS);
  return migrateSyncSettings(raw as Partial<FilterSettingsSync>);
}

export async function getLocalSettings(): Promise<FilterSettingsLocal> {
  const raw = await getArea('local', LOCAL_STORAGE_KEYS);
  return migrateLocalSettings(raw as Partial<FilterSettingsLocal>);
}

export async function getSettings(): Promise<FilterSettings> {
  const [sync, local] = await Promise.all([getSyncSettings(), getLocalSettings()]);
  return mergeSettings(sync, local);
}

export async function initializeStorageDefaults(): Promise<void> {
  const sync = await getSyncSettings();
  const local = await getLocalSettings();

  await Promise.all([
    setArea('sync', { ...DEFAULT_SYNC_SETTINGS, ...sync }),
    setArea('local', { ...DEFAULT_LOCAL_SETTINGS, ...local }),
    removeAreaKeys('sync', LEGACY_SYNC_STORAGE_KEYS),
    removeAreaKeys('local', LEGACY_LOCAL_STORAGE_KEYS)
  ]);
}

export async function updateSyncSettings(partial: Partial<FilterSettingsSync>): Promise<void> {
  const next = migrateSyncSettings({ ...(await getSyncSettings()), ...partial });
  await Promise.all([
    setArea('sync', next as unknown as Record<string, unknown>),
    removeAreaKeys('sync', LEGACY_SYNC_STORAGE_KEYS)
  ]);
}

export async function updateLocalSettings(partial: Partial<FilterSettingsLocal>): Promise<void> {
  const current = await getLocalSettings();
  const next = migrateLocalSettings({ ...current, ...partial });

  next.includeKeywords = sanitizeKeywords(next.includeKeywords);
  next.excludeKeywords = sanitizeKeywords(next.excludeKeywords);

  await Promise.all([
    setArea('local', next as unknown as Record<string, unknown>),
    removeAreaKeys('local', LEGACY_LOCAL_STORAGE_KEYS)
  ]);
}

export function subscribeToStorageChanges(callback: (changes: ChangeMap, areaName: string) => void): () => void {
  if (!hasChromeStorage()) {
    return () => undefined;
  }

  const listener = (changes: ChangeMap, areaName: string) => {
    callback(changes, areaName);
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
