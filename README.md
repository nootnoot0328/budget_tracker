# Budget Margin 4.0

A rebuild of Budget Margin: same data, cleaner app, and optional AI that reads things for you and answers questions from your own numbers.

## What changed from 3.7

**Layout.** Four tabs and one + button instead of four long scrolling pages.
- **Home**: what's left (liquid gauge), safe to spend today, pace, anything that needs attention (alerts to confirm, bills set aside, last period's bank check), quick logs, envelopes, recent.
- **Activity**: every entry in one list, spending *and* money in, transfers and refunds, with money in / out / net for the period. Calendar and Insights (where it went, versus your usual, trend) sit in the same place. Search is behind the magnifier.
- **+**: spending keypad, money in, transfer, scan receipt, paste bank alert, import statement.
- **Plan**: Overview (free margin, next 30 days, month-end check), Bills, Goals, Debt, Accounts. Accounts are grouped (cash, bank, savings, prepaid, credit cards, loans, investments, other).
- **Ask**: chat about your money.
- **Settings** (gear icon): short pages instead of one long list.

**AI (optional, off by default)**, through the `/ai` route on the Setpoint Worker, so no new Worker and no key in this repo:
- **Receipt photos**: the photo is shrunk on the phone, read, and shown next to the result for you to check before saving. The items it reads are kept on the entry.
- **PDF statements**: rows whose amount isn't in the PDF text are thrown away, and the rows are checked against the statement's own printed totals.
- **Bank alerts**: picks out the merchant, amount and type, and flags refunds, transfers and foreign currency. An amount that isn't in the alert is rejected.
- **Envelope suggestions** for merchants without a rule. Only merchant names and envelope names are sent.
- **Ask**: sends a computed summary of your budget plus the last three periods of transactions. Totals, pace and debt forecasts, including "at the pace you're actually paying" and what-if budgets, are calculated on the phone first. The model explains; it doesn't calculate. Plan changes (debt budget and order, envelope caps, daily limit, goals) arrive as cards: the before and after are recomputed on the phone, nothing changes until you tap **Apply**, and every Apply can be undone.

**Also new:** debt "plan vs actual" from your recorded payments, a debt-free date at your actual pace, envelope caps versus your 3-period average, one-tap "Log" for bills, undo on almost everything.

## Data
- Same storage key and format as 3.x (`margin.v2`), so 4.0 opens your existing data as-is, and 3.7 can still open data written by 4.0 if you need to roll back. New fields are additive.
- AI settings (`margin.ai`) and the chat history (`margin.chat`) are stored separately and are never part of backups.

## Code
No build step. ES modules:
- `js/state.js`: saved data
- `js/calc.js`: every number the app shows
- `js/ai.js`: Worker client, prompts and validation
- `js/proposals.js`: chat plan changes
- `js/imports.js`: alerts, CSV/PDF, reconciliation, history import
- `js/ui/*`: screens
- `css/app.css`

Deploy every file at the repository root on GitHub Pages. Export a backup before replacing an existing deployment.

---

# Budget Margin 3.7 — AI assist + reconciliation fixes

## New in 3.7

**AI assist (optional, off by default).** Settings → AI assist. Uses the `/ai` route on your Setpoint Worker, so no new Worker and no API key in this repo. Enter the Worker address and the same `APP_KEY` Setpoint uses, then tap *Test connection*.
- **PDF statements:** if the built-in parser finds nothing, the statement text is sent to AI and comes back as rows. If the built-in parser finds rows that look wrong, tap *Re-read with AI*. Rows whose amount doesn't appear in the PDF text are thrown away, and the rows are checked against the statement's own printed totals.
- **Notifications:** *Paste payment* asks AI for merchant, amount, currency and type. It picks the transaction amount instead of an available balance, and flags refunds, transfers, card payments and foreign currency. An AI amount that isn't written in the notification is rejected and the built-in reading is kept.
- **Envelope suggestions:** for merchants with no rule yet (capture and statement review). Only merchant text and envelope names are sent. Your own rules and aliases always win, and every suggestion is marked *AI suggestion*.
- The Worker address and key live in their own storage key (`margin.ai`) and are never written into backups. AI calls count toward the Worker's `AI_DAILY_LIMIT`, which Setpoint shares.
- Scanned (image-only) PDFs still aren't supported; AI reads the PDF's text layer only.

**Reconciliation and currency fixes (no AI).**
- Ringgit statements now reconcile in ringgit. Previously every statement row was compared against the S$ value and added back as SGD, so a Malaysian account could never match.
- When two book entries share the same amount and dates, the match now prefers the one whose merchant name agrees, then the closest date.
- Ringgit entries store the exchange rate used when they were recorded. Changing the rate in Settings no longer revalues old ledger entries. Existing ringgit entries are fixed at the rate in use when you first open 3.7.
- Editing a ringgit transaction keeps it in ringgit. Previously it was silently converted to SGD.
- Confirming a captured payment no longer crashes when you have no accounts set up.

---

# Budget Margin 3.6 — Capture + History Controls

Built on Budget Margin 3.4 Liquid Margin.

Highlights:
- Clipboard capture flow for iOS 27: copy a bank notification, open the Home Screen PWA, tap **Paste payment**, and Budget Margin parses it straight into a prefilled confirmation sheet. No paste textbox.
- Existing URL capture remains as a fallback.
- Merchant alias learning: rename coded merchant names during capture and remember the clean name + envelope for future captures.
- History supports adding a transaction to any past date; existing entries can already be edited or deleted.
- Editing a transaction can optionally apply the merchant name + envelope to all matching historical merchant entries.
- Envelope rename continues to update every historical entry because transactions reference the envelope ID, not a copied name.
- New **Merge** control moves all logs, Quick Logs and merchant rules from one envelope into another and removes the old envelope.
- Per-envelope **Show on Spend home** toggle controls what appears on the home screen without deleting history or budgets.
- Envelope quick actions expand/collapse in place with a smooth animation instead of redrawing the whole list.
- Liquid Margin UI, analytics, reconciliation, historical migration, daily/weekly/period limits, goals and debt payoff forecast remain intact.

Deploy every file in this folder at the repository root on GitHub Pages. Export a backup before replacing an existing deployment.
