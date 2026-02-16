type ContentBundleResponse = { ok: true; code: string } | { ok: false; error: string };

type LoaderState =
  | 'starting'
  | 'direct-import-ok'
  | 'direct-import-failed'
  | 'fallback-request'
  | 'blob-import-ok'
  | 'failed';

let loaderMarker: HTMLMetaElement | null = null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ensureLoaderMarker(): void {
  const existing = document.getElementById('cleanedin-loader-marker');
  if (existing instanceof HTMLMetaElement) {
    loaderMarker = existing;
  } else {
    const marker = document.createElement('meta');
    marker.id = 'cleanedin-loader-marker';
    marker.setAttribute('data-cleanedin-loader', '1');
    (document.head || document.documentElement).appendChild(marker);
    loaderMarker = marker;
  }

  window.__cleanedin_loader = true;
}

function setLoaderState(state: LoaderState, error?: unknown): void {
  const errorMessage = typeof error === 'undefined' ? '' : getErrorMessage(error).slice(0, 280);
  window.__cleanedin_loader_state = state;
  window.__cleanedin_loader_error = errorMessage;

  if (loaderMarker) {
    loaderMarker.setAttribute('data-cleanedin-state', state);
    if (errorMessage) {
      loaderMarker.setAttribute('data-cleanedin-error', errorMessage);
    } else {
      loaderMarker.removeAttribute('data-cleanedin-error');
    }
  }

  document.documentElement?.setAttribute('data-cleanedin-loader-state', state);
}

function requestContentBundle(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'getContentBundle' }, (response: ContentBundleResponse | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      if (!response || !response.ok) {
        reject(new Error(response?.error ?? 'Empty getContentBundle response.'));
        return;
      }

      resolve(response.code);
    });
  });
}

async function importContentFromBlob(code: string): Promise<void> {
  const blob = new Blob([code], { type: 'text/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    await import(/* @vite-ignore */ blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function bootLoader(): Promise<void> {
  console.log('[cleanedin] loader boot');

  try {
    ensureLoaderMarker();
    setLoaderState('starting');
  } catch {
    // Best effort only, loader can still proceed without marker.
  }

  if (!chrome.runtime?.getURL) {
    setLoaderState('failed', 'chrome.runtime.getURL is unavailable');
    console.error('[cleanedin] chrome.runtime.getURL is unavailable in content loader');
    return;
  }

  const bundleUrl = chrome.runtime.getURL('content.js');

  try {
    await import(/* @vite-ignore */ bundleUrl);
    setLoaderState('direct-import-ok');
    console.log('[cleanedin] module imported via chrome-extension URL');
    return;
  } catch (directImportError) {
    setLoaderState('direct-import-failed', directImportError);
    console.warn('[cleanedin] direct module import failed, trying bundled source fallback', directImportError);
  }

  try {
    setLoaderState('fallback-request');
    const bundleCode = await requestContentBundle();
    await importContentFromBlob(bundleCode);
    setLoaderState('blob-import-ok');
    console.log('[cleanedin] module imported via blob fallback');
  } catch (fallbackError) {
    setLoaderState('failed', fallbackError);
    console.error('[cleanedin] content loader failed to import module', fallbackError);
  }
}

void bootLoader();
