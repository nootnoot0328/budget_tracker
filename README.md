# Budget Margin 2.1

A private, local-first budgeting PWA designed for GitHub Pages and iPhone Home Screen use.

## 2.1 highlights

- App renamed to **Budget Margin**
- **Plan** tab combines accounts, recurring commitments and debt payoff
- Manual account snapshots with Bank / Cash / Credit Card types
- Spending can be tagged to an account
- Recurring income and expenses: weekly, monthly or yearly
- Upcoming expenses can be reserved from **Safe today**
- Recurring expenses can be linked to an envelope and logged from the Upcoming list
- History can be filtered by envelope and account
- Existing Margin 2.0 data migrates in place using the same local storage key

## Deploy

Upload the files in this folder to the root of your GitHub repository and enable **Settings → Pages → Deploy from a branch → main → /(root)**.

Keep the same Pages URL when upgrading so the browser can continue using the same local data. Export a backup before any major update.

## Privacy

No personal balances are hard-coded into this repository. Your live data is stored locally in the browser on your device. Never commit an exported backup JSON to a public repository.
