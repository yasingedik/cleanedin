import { initializeStorageDefaults } from '../shared/storage';

type GetContentBundleMessage = { type: 'getContentBundle' };
type RuntimeMessage = GetContentBundleMessage;
type GetContentBundleResponse = { ok: true; code: string } | { ok: false; error: string };

function isGetContentBundleMessage(message: unknown): message is GetContentBundleMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type?: unknown }).type === 'getContentBundle'
  );
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorageDefaults();
});

// Provide the content bundle source to content scripts on request. This allows
// content scripts to import the module code via a blob URL without relying on
// chrome-extension fetches from the page context.
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage | unknown, _sender, sendResponse: (response: GetContentBundleResponse) => void) => {
    if (!isGetContentBundleMessage(message)) {
      return false;
    }

    const url = chrome.runtime.getURL('content.js');
    fetch(url)
      .then((res) => res.text())
      .then((text) => {
        try {
          // Rewrite relative chunk imports to absolute chrome-extension URLs so
          // the module loader can fetch them correctly from the page context.
          const rewritten = text.replace(/from\s+["'](\.\/chunks\/[^"']+)["']/g, (m, p) => {
            const path = p.replace('./', '');
            const abs = chrome.runtime.getURL(path);
            return `from "${abs}"`;
          });

          // Also handle dynamic import(...) calls that reference ./chunks/
          const rewritten2 = rewritten.replace(/import\(\s*["'](\.\/chunks\/[^"']+)["']\s*\)/g, (m, p) => {
            const path = p.replace('./', '');
            const abs = chrome.runtime.getURL(path);
            return `import("${abs}")`;
          });

          sendResponse({ ok: true, code: rewritten2 });
        } catch (err) {
          sendResponse({ ok: false, error: String(err) });
        }
      })
      .catch((err) => sendResponse({ ok: false, error: String(err) }));

    // Indicate we'll respond asynchronously
    return true;
  }
);
