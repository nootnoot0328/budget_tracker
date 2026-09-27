/* Budget Margin 4 — adding and editing money: the + menu, spending keypad, money in/transfers, edit. */
import { h, $, icon, money, rmf, grp, iso, today, toCents, fixed2, haptic, dateShort } from "../util.js";
import { S, save, uid } from "../state.js";
import * as C from "../calc.js";
import { openSheet, closeSheet, toast, confirmSheet, field, options, accountOptions, envelopeOptions, moneyInput, toggleRow, val, checked, badge } from "./core.js";

let go = () => { };
export const setNavigator = fn => (go = fn);
let importHooks = {};
export const setImportHooks = o => (importHooks = o);

/* ── the + menu ── */
export function openAdd() {
  const act = (ic, color, title, sub, fn) => h("button.action", { type: "button", onclick: () => { haptic(5); fn(); } }, badge(ic, color), h("span", title), sub ? h("small", sub) : null);
  openSheet("Add",
    h("div.actions-grid",
      act("wallet", "var(--coral)", "Spending", null, () => openSpend()),
      act("arrowIn", "var(--jade)", "Money in", null, () => openLedger(null, "income")),
      act("swap", "var(--blue)", "Transfer", null, () => openLedger(null, "transfer")),
      act("camera", "var(--violet)", "Scan receipt", "AI", () => importHooks.receipt && importHooks.receipt()),
      act("clip", "var(--amber)", "Paste alert", "bank SMS", () => importHooks.paste && importHooks.paste()),
      act("file", "var(--cyan)", "Statement", "PDF / CSV", () => importHooks.statement && importHooks.statement())),
    h("p.hint", { style: { textAlign: "center", marginTop: "14px" } }, "Receipts and PDFs that the built-in reader can't handle need AI assist (Settings)."));
}

/* ── spending keypad ── */
export function openSpend(opts) {
  opts = opts || {};
  if (!S.cats.length) { toast("Create an envelope first"); go("settings", "envelopes"); return; }
  let cents = opts.amount || 0, cur = opts.cur || "SGD", cid = opts.cid || S.lastCat || (S.cats.find(c => c.home !== false) || S.cats[0]).id;
  if (!C.catOf(cid)) cid = S.cats[0].id;
  const disp = h("div.amount-display.tab"), sub = h("div.amount-sub"), quick = h("div.quick-amts"), ok = h("button.btn", { type: "button" }, "Add spending");
  const chips = h("div.chips", { role: "radiogroup", "aria-label": "Envelope" });
  const curSeg = h("div.seg", { style: { width: "120px", margin: "0 auto" } });
  const paint = () => {
    disp.innerHTML = '<sup>' + (cur === "SGD" ? "S$" : "RM") + "</sup>" + grp((cents / 100).toFixed(2));
    disp.classList.toggle("zero", !cents);
    const left = C.envelopeLeftThisPeriod(cid), after = left - (cur === "MYR" ? Math.round(cents / S.rate) : cents);
    sub.textContent = (cur === "MYR" && cents ? "≈ " + money(Math.round(cents / S.rate)) + " · " : "") + C.catName(cid) + ": " + (cents ? (after < 0 ? money(-after, false) + " over after this" : money(after, false) + " left after this") : (left < 0 ? money(-left, false) + " over" : money(left, false) + " left"));
    ok.disabled = !(cents > 0);
    [...chips.children].forEach(b => b.setAttribute("aria-pressed", b.dataset.cid === cid ? "true" : "false"));
    [...curSeg.children].forEach(b => b.setAttribute("aria-pressed", b.dataset.cur === cur ? "true" : "false"));
    quick.replaceChildren(...((C.catOf(cid) || {}).quick || [500, 1000, 2000, 5000]).slice(0, 4).map(v => {
      const amt = cur === "SGD" ? v : Math.round(v * S.rate / 100) * 100;
      return h("button.qbtn", { type: "button", onclick: () => { cents = amt; paint(); } }, cur === "SGD" ? "S$" + (amt / 100).toFixed(amt % 100 ? 2 : 0) : "RM" + Math.round(amt / 100));
    }));
  };
  S.cats.forEach(c => chips.appendChild(h("button.chip", { type: "button", dataset: { cid: c.id }, onclick: () => { cid = c.id; paint(); } }, h("span", { style: { color: C.hueOf(c.id) }, html: icon(c.icon || "dots") }), c.name)));
  ["SGD", "MYR"].forEach(k => curSeg.appendChild(h("button", { type: "button", dataset: { cur: k }, onclick: () => { cur = k; cents = 0; paint(); } }, k)));
  const pad = h("div.keypad", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map(k => h("button.key", { type: "button", "aria-label": k === "⌫" ? "Delete" : k, onclick: () => {
    if (k === "⌫") cents = Math.floor(cents / 10); else if (k === "00") { if (cents * 100 < 1e8) cents *= 100; } else if (cents * 10 < 1e8) cents = cents * 10 + +k;
    haptic(3); paint();
  } }, k)));
  const date = h("input", { id: "spDate", type: "date", value: opts.date || iso(today()), max: iso(today()) });
  const note = h("input", { id: "spNote", autocomplete: "off", placeholder: "Merchant or note (optional)", value: opts.note || "", enterkeyhint: "done", "aria-label": "Merchant or note", style: { marginTop: "12px" } });
  const past = opts.date && opts.date !== iso(today());
  const details = h("details", { style: { marginTop: "12px" }, open: past || null },
    h("summary.small.dim", { style: { margin: "0 2px 10px", cursor: "pointer" } }, "Date, account, quick log"),
    h("div.two", field("Date", date), S.accounts.length ? field("Paid from", h("select", { id: "spAcc" }, accountOptions(opts.account ?? S.defaultAccount, "Unassigned"))) : h("span")),
    toggleRow("spQuick", false, "Save as a Quick log", "Shows as a one-tap button on Home."));
  ok.onclick = () => {
    if (!(cents > 0)) return;
    const aid = val("spAcc");
    const t = C.makeTxn({ amount: cents, cur, cat: cid, note: val("spNote"), account: aid, date: val("spDate") || iso(today()), source: val("spDate") && val("spDate") !== iso(today()) ? "manual_past" : undefined });
    if (aid) S.defaultAccount = aid;
    S.lastCat = cid;
    if (checked("spQuick")) addQuickLog(cid, cents, cur, t.note, aid);
    S.txns.push(t);
    closeSheet(); save(); afterLog(t);
  };
  openSheet(opts.title || "Spending", chips, h("div", { style: { marginTop: "12px" } }, curSeg), disp, sub, quick, note, pad, ok, details);
  paint();
  requestAnimationFrame(() => { const sel = chips.querySelector('[aria-pressed="true"]'); if (sel) sel.scrollIntoView({ inline: "center", block: "nearest" }); });
}
function afterLog(t) {
  const left = C.envelopeLeftThisPeriod(t.cat);
  toast((t.cur === "MYR" ? rmf(t.orig) : money(t.sgd)) + " · " + C.catName(t.cat) + " · " + (left < 0 ? money(-left, false) + " over" : money(left, false) + " left"), () => { S.txns = S.txns.filter(x => x.id !== t.id); save(); toast("Entry removed"); });
}
/* one-tap logging (quick logs, envelope +5 buttons, shortcuts) */
export function logSpend(cid, amount, cur, note, account) {
  const t = C.makeTxn({ amount, cur, cat: cid, note, account: account ?? S.defaultAccount });
  S.txns.push(t); S.lastCat = cid; save(); haptic(6); afterLog(t);
}
export function addQuickLog(cat, amt, cur, note, account) {
  if (!(amt > 0) || !cat) return;
  const key = [cat, cur, amt, account || "", String(note || "").trim().toLowerCase()].join(":");
  if (S.bookmarks.some(b => [b.cat, b.cur, b.amt, b.account || "", String(b.note || "").trim().toLowerCase()].join(":") === key)) return;
  S.bookmarks.unshift({ id: "b" + Date.now(), cat, amt, cur, note: String(note || "").trim(), account: account || "" });
  S.bookmarks = S.bookmarks.slice(0, 12);
}

/* ── edit / delete a spending entry ── */
export function deleteTxn(id) {
  const idx = S.txns.findIndex(x => x.id === id); if (idx < 0) return;
  const [t] = S.txns.splice(idx, 1);
  save(); haptic(10);
  toast("Deleted " + money(t.sgd), () => { S.txns.splice(Math.min(idx, S.txns.length), 0, t); save(); toast("Restored"); });
}
export function openEditTxn(id) {
  const t = S.txns.find(x => x.id === id); if (!t) return;
  const myr = t.cur === "MYR";
  openSheet("Edit spending",
    t.source === "receipt" && t.items && t.items.length ? h("div.items", t.items.map(i => h("div", h("span", i.name), h("span.tab", money(i.amount))))) : null,
    h("div.two",
      field(myr ? "Amount (RM)" : "Amount (S$)", moneyInput("eA", myr ? t.orig : t.sgd)),
      field("Date", h("input", { id: "eD", type: "date", value: t.date }))),
    myr ? h("p.hint", { style: { marginTop: "-6px", marginBottom: "10px" } }, "Logged at RM" + (t.rate || S.rate) + " per S$ = " + money(t.sgd)) : null,
    field("Envelope", h("select", { id: "eC" }, envelopeOptions(t.cat))),
    S.accounts.length ? field("Paid from", h("select", { id: "eAcc" }, accountOptions(t.account || "", "Unassigned"))) : null,
    field("Merchant or note", h("input", { id: "eN", value: t.note || "", autocomplete: "off" })),
    toggleRow("eAll", false, "Apply to this merchant everywhere", "Moves past entries with the same merchant to this envelope and name, and remembers it for next time."),
    h("button.btn", { type: "button", onclick: () => {
      const a = toCents(val("eA")); if (!(a > 0)) { toast("Enter an amount above zero"); return; }
      const oldNote = t.note || "", newCat = val("eC"), newNote = val("eN").trim();
      if (myr) { if (a !== t.orig) { if (!t.rate) t.rate = S.rate || 3.35; t.sgd = Math.round(a / t.rate); t.orig = a; } }
      else { t.sgd = a; t.orig = a; t.cur = "SGD"; }
      t.cat = newCat; t.date = val("eD") || t.date; t.note = newNote; if (document.getElementById("eAcc")) t.account = val("eAcc");
      let changed = 0;
      if (checked("eAll") && oldNote) {
        const mk = C.merchantKey(oldNote);
        S.txns.forEach(x => { if (x.id !== t.id && C.merchantKey(x.note || "") === mk) { x.cat = newCat; if (newNote) x.note = newNote; changed++; } });
        C.rememberRule(t.merchantRaw || oldNote, newCat, newNote);
      }
      closeSheet(); save(); toast(changed ? "Saved · " + changed + " more updated" : "Saved");
    } }, "Save"),
    h("div.btn-row", { style: { marginTop: "8px" } },
      h("button.btn.soft", { type: "button", onclick: () => { addQuickLog(t.cat, myr ? t.orig : t.sgd, t.cur || "SGD", t.note, t.account); save(); toast("Saved as a Quick log"); } }, "Save as Quick log"),
      h("button.btn.soft", { type: "button", onclick: () => { closeSheet(); logSpend(t.cat, myr ? t.orig : t.sgd, t.cur || "SGD", t.note, t.account); } }, "Log again today")),
    h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmSheet("Delete this entry?", money(t.sgd) + " · " + C.catName(t.cat), "Delete", true)) deleteTxn(t.id); } }, "Delete"));
}

/* ── money in, transfers, card payments, refunds, non-budget expenses ── */
const LEDGER_TYPES = [
  { value: "income", label: "Income" }, { value: "refund", label: "Refund" }, { value: "transfer", label: "Transfer between my accounts" },
  { value: "card_payment", label: "Credit-card payment" }, { value: "expense", label: "Expense outside envelopes" },
];
export function ledgerLabel(x) {
  if (x.type === "transfer") return "Transfer · " + C.accountName(x.from) + " → " + C.accountName(x.to);
  if (x.type === "card_payment") return "Card payment · " + C.accountName(x.to);
  if (x.type === "goal") return "Goal · " + (x.note || "");
  const base = { income: "Income", refund: "Refund", expense: "Other expense", adjustment: "Adjustment" }[x.type] || x.type;
  return (x.note || base) + (x.account ? "" : "");
}
export function openLedger(id, preset) {
  let x = id ? S.ledger.find(z => z.id === id) : null;
  const isNew = !x;
  if (!x) x = { id: "l" + Date.now(), type: preset || "income", amount: 0, cur: "SGD", date: iso(today()), note: "", account: S.defaultAccount || "", from: "", to: "", createdAt: Date.now() };
  const title = isNew ? (preset === "transfer" ? "Transfer" : "Money in") : "Edit entry";
  const acc = h("div#lAccF", field("Account", h("select", { id: "lAcc" }, accountOptions(x.account || "", S.accounts.length ? "Choose account" : "No accounts yet"))));
  const tr = h("div.two#lTrF", field("From", h("select", { id: "lFrom" }, accountOptions(x.from || "", "Choose"))), field("To", h("select", { id: "lTo" }, accountOptions(x.to || "", "Choose"))));
  const sync = () => { const t = val("lType"), multi = t === "transfer" || t === "card_payment"; acc.hidden = multi; tr.hidden = !multi; };
  openSheet(title,
    field("Type", h("select", { id: "lType", onchange: sync }, options(LEDGER_TYPES, x.type))),
    h("div.two", field("Amount", moneyInput("lAmt", x.amount)), field("Currency", h("select", { id: "lCur" }, options(["SGD", "MYR"], x.cur || "SGD")))),
    field("Date", h("input", { id: "lDate", type: "date", value: x.date || iso(today()) })),
    acc, tr,
    field("Note", h("input", { id: "lNote", value: x.note || "", placeholder: "Salary, refund, transfer…", autocomplete: "off" })),
    !S.accounts.length ? h("p.note", "Tip: add your accounts under Plan → Accounts so money in and transfers move the right balances.") : null,
    h("button.btn", { type: "button", style: { marginTop: "12px" }, onclick: () => {
      const amt = toCents(val("lAmt")); if (!amt) { toast("Enter an amount"); return; }
      const t = val("lType"), multi = t === "transfer" || t === "card_payment";
      if (multi && (!val("lFrom") || !val("lTo"))) { toast("Choose both accounts"); return; }
      if (multi && val("lFrom") === val("lTo")) { toast("Choose two different accounts"); return; }
      if (!multi && S.accounts.length && !val("lAcc")) { toast("Choose an account"); return; }
      const cur = val("lCur") === "MYR" ? "MYR" : "SGD";
      if (cur === "MYR" && (x.cur !== "MYR" || x.amount !== amt)) x.rate = S.rate || 3.35;
      if (cur !== "MYR") delete x.rate;
      Object.assign(x, { type: t, amount: amt, cur, date: val("lDate") || iso(today()), note: val("lNote").trim(), account: multi ? "" : val("lAcc"), from: multi ? val("lFrom") : "", to: multi ? val("lTo") : "" });
      if (!x.createdAt) x.createdAt = Date.now();
      if (isNew) S.ledger.push(x);
      closeSheet(); save(); toast(isNew ? "Saved" : "Updated");
    } }, "Save"),
    !isNew ? h("button.btn.danger", { type: "button", onclick: async () => {
      if (!(await confirmSheet("Delete this entry?", ledgerLabel(x) + " · " + money(C.ledgerAmountSgd(x)), "Delete", true))) return;
      const idx = S.ledger.indexOf(x); S.ledger.splice(idx, 1); save();
      toast("Deleted", () => { S.ledger.splice(idx, 0, x); save(); });
    } }, "Delete") : null);
  sync();
}
