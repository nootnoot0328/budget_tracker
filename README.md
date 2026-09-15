# Margin 1.6 — GitHub Pages build

Margin 1.6 is a static, local-first personal budgeting PWA. Upload **all files in this folder** to the root of one GitHub repository.

## Publish on GitHub Pages

1. Create a repository and upload every file in this folder.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your `main` branch and `/ (root)`, then save.
5. Open the HTTPS Pages URL in Safari on iPhone.
6. Use **Share → Add to Home Screen**.

Keep the same repository / Pages URL for future releases so the browser origin stays the same and your on-device Margin storage continues to be available.

## Files

- `index.html` — app structure only
- `styles.css` — visual system, motion, drag/swipe states and responsive layout
- `app.js` — budget, debt, history, gestures, backup and PWA behaviour
- `sw.js` — offline shell and update lifecycle
- `manifest.webmanifest` — Home Screen / PWA metadata
- `icon-*.png` — app icons

## New in 1.6

- Refactored out of the old single-file prototype into separate HTML, CSS and JavaScript.
- Home card now shows **Safe today**, amount spent, days to reset and actual-vs-ideal spending pace.
- Envelope cards show spent and budget amounts in addition to remaining balance.
- Recent activity appears on the Spend screen and opens directly into editing.
- History now supports live search and envelope filtering, with a filtered total.
- User-selectable UI accent colours; overspend warning colours remain independent.
- App update detection and a **Check now / Update** control in Settings.
- One-step local recovery snapshot (`margin.v2.prev`) before normal state changes.
- Existing drag-to-reorder envelopes, swipe actions, draggable sheets and motion are retained.

## Privacy

The repository contains app code only. It intentionally contains **no personal balances, debts, transactions or budget caps**.

Your live data is stored in browser storage under `margin.v2`. Do **not** commit exported Margin JSON backups to GitHub. A public repository and its GitHub Pages site can be read by other people.

## Updating Margin later

Replace the app files in the same repository. When the service worker detects a new version, Settings will show that an update is ready. Applying the update refreshes the app shell; it does not intentionally clear `margin.v2`.

Still export a backup periodically. Clearing Safari website data, changing to another repository/domain, browser storage eviction, or losing the device can remove local data.
