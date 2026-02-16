# Local Browser Testing (Chrome + Edge)

This guide shows how to run CleanedIn in your own browser using an unpacked extension.

## 1. Build the extension

From the project root:

```bash
npm ci
npm run build
```

This creates the extension bundle in `dist/`.

## 2. Load unpacked extension

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `dist/` folder in this repo.

### Edge

1. Open `edge://extensions`.
2. Enable **Developer mode** (left panel).
3. Click **Load unpacked**.
4. Select the `dist/` folder in this repo.

## 3. Verify it is active

1. Pin the extension from the browser toolbar.
2. Open the CleanedIn popup.
3. Toggle a category setting (for example, Ads).
4. Open `https://www.linkedin.com/feed/` and confirm behavior changes.

## 4. Fast iteration workflow while developing

If you change code:

1. Rebuild:

```bash
npm run build
```

2. In `chrome://extensions` or `edge://extensions`, click the extension **Reload** button.
3. Reload the LinkedIn tab.

Optional watch mode:

```bash
npm run dev
```

This rebuilds on file changes, but you still need to click **Reload** in the extensions page.

## 5. Debugging tips

- Content script logs:
  - Open LinkedIn tab DevTools (`F12`) and check **Console**.
- Service worker logs:
  - On the extensions page, open the extension details and inspect the service worker.
- Popup debugging:
  - Right-click inside the popup and choose **Inspect**.

## 6. Common issues

- Extension not updating:
  - Re-run `npm run build`, then click **Reload** in extensions page.
- Popup changes saved but feed unchanged:
  - Refresh the LinkedIn feed tab after reloading extension.
- Extension not loading:
  - Ensure you selected `dist/` (not project root).
