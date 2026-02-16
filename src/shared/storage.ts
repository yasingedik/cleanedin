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

export async function getSyncSettings(): Promise<FilterSettingsSync> {
  const raw = await getArea('sync', Object.keys(DEFAULT_SYNC_SETTINGS));
  return migrateSyncSettings(raw as Partial<FilterSettingsSync>);
}

export async function getLocalSettings(): Promise<FilterSettingsLocal> {
  const raw = await getArea('local', Object.keys(DEFAULT_LOCAL_SETTINGS));
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
    setArea('local', { ...DEFAULT_LOCAL_SETTINGS, ...local })
  ]);
}

export async function updateSyncSettings(partial: Partial<FilterSettingsSync>): Promise<void> {
  const next = migrateSyncSettings({ ...(await getSyncSettings()), ...partial });
  await setArea('sync', next as unknown as Record<string, unknown>);
}

export async function updateLocalSettings(partial: Partial<FilterSettingsLocal>): Promise<void> {
  const current = await getLocalSettings();
  const next = migrateLocalSettings({ ...current, ...partial });

  next.includeKeywords = sanitizeKeywords(next.includeKeywords);
  next.excludeKeywords = sanitizeKeywords(next.excludeKeywords);

  await setArea('local', next as unknown as Record<string, unknown>);
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
