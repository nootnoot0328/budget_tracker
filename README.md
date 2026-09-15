# Budget Margin 3.2.1

Local-first PWA for GitHub Pages. No server or API key is required.

## What is new

- Capture Inbox for iOS 27 Shortcuts notification automations.
- Private URL-fragment bridge: notification text is passed after `#`, so it is handled by the browser and is not sent as a request to GitHub Pages.
- Merchant/category memory for captured payments.
- Confirmation-first workflow with transfer/card-payment classification.
- One-time canonical historical CSV migration.
- Historical records keep `source: historical_import`.
- Statement CSV importer now scans for the real header row instead of assuming row 1, which supports DBS exports with account metadata before the transactions.
- Text/CSV files with an `.xls` filename can also be selected, useful for bank exports that are CSV in disguise.
- Date parsing supports formats such as `15 Sep 2026` and `14-Sep-2026`.

## iOS 27 notification bridge

Create a Shortcuts personal automation triggered by a notification from your bank app. Build a URL based on your Budget Margin address using this pattern:

`https://YOURNAME.github.io/YOUR-REPO/#capture=1&app=DBS&text=URL_ENCODED_NOTIFICATION_TEXT`

Then use **Open URLs**. Budget Margin will parse the merchant and amount and place the candidate transaction in **Capture inbox** for confirmation.

The exact Shortcuts variable names shown by iOS can differ by notification/app. The app only requires that the final notification body be URL-encoded into the `text` parameter. Optional parameters are `merchant`, `amount`, `cur`, and `timestamp`.

## Historical migration

Settings → Historical migration → Import canonical CSV. This is intended for the one-time `all_accounts_canonical.csv` migration. Existing records are merged, not replaced. Export a backup first.

## GitHub Pages

Publish the repository root from `main` via Settings → Pages. Keep all files in this folder at the repository root.


## 3.2.1 migration correction

- Historical migration no longer changes current account balances.
- Loan accounts remain loans instead of being mapped as bank accounts.
- Account cards display their native currency (SGD/MYR).
- MYR accounts are converted only for aggregate SGD summary totals.
- Loans are excluded from Liquid and treated separately from cash.
- Imported-history cleanup is available in Setup.
