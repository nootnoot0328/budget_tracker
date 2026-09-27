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
