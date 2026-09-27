/* Budget Margin 4 — every number the app shows is computed here, on the device.
   Ported from 3.7 without changing the maths; AI never calculates anything the user relies on. */
import { S, uid } from "./state.js";
import { iso, pIso, today, days, addDays, MO, MONTHS } from "./util.js";

/* ── lookups ── */
export const catOf = id => S.cats.find(c => c.id === id) || null;
export const catName = id => (catOf(id) || {}).name || "Removed envelope";
export const accountOf = id => S.accounts.find(a => a.id === id) || null;
export const accountName = id => (accountOf(id) || {}).name || "Unassigned";
const HUES = ["--jade", "--cyan", "--amber", "--violet", "--pink", "--lime", "--blue", "--coral"];
export function hueOf(id) { const i = S.cats.findIndex(c => c.id === id); return i < 0 ? "var(--dim)" : "var(" + HUES[i % HUES.length] + ")"; }

/* ── budget periods ── */
export function pStart(d) { const k = S.startDay || 1; return d.getDate() >= k ? new Date(d.getFullYear(), d.getMonth(), k) : new Date(d.getFullYear(), d.getMonth() - 1, k); }
export const pShift = (s, n) => new Date(s.getFullYear(), s.getMonth() + n, S.startDay || 1);
export function pLabel(s) {
  if ((S.startDay || 1) === 1) return MONTHS[s.getMonth()] + (s.getFullYear() !== today().getFullYear() ? " " + s.getFullYear() : "");
  const e = addDays(pShift(s, 1), -1);
  return s.getDate() + " " + MO[s.getMonth()] + " – " + e.getDate() + " " + MO[e.getMonth()];
}
export const inR = (t, a, b) => { const d = pIso(t.date); return d >= a && d < b; };
export function spent(a, b, cid) { let s = 0; for (const t of S.txns) if (inR(t, a, b) && (!cid || t.cat === cid)) s += t.sgd || 0; return s; }
export const capAll = () => S.cats.reduce((s, c) => s + (c.cap || 0), 0);
export const tone = f => (f >= 1 ? "var(--coral)" : f >= 0.8 ? "var(--amber)" : "var(--jade)");

/* ── recurring commitments ── */
export const amountSgd = r => (r.cur === "MYR" ? Math.round((r.amount || 0) / (S.rate || 3.35)) : r.amount || 0);
function clampDate(y, m, d) { const last = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(d, last)); }
function advance(d, freq, anchor) {
  if (freq === "weekly") return addDays(d, 7);
  if (freq === "yearly") return clampDate(d.getFullYear() + 1, d.getMonth(), anchor || d.getDate());
  return clampDate(d.getFullYear(), d.getMonth() + 1, anchor || d.getDate());
}
export const occurrenceKey = (r, ds) => r.id + "@" + ds;
export function occurrencesBetween(r, a, b) {
  const out = [];
  if (!r || r.active === false || !r.start || !(r.amount > 0)) return out;
  let d = pIso(r.start), guard = 0;
  const anchor = d.getDate();
  while (d < a && guard++ < 600) d = advance(d, r.freq || "monthly", anchor);
  while (d < b && guard++ < 800) { const ds = iso(d); out.push({ rec: r, date: ds, done: !!S.recurringDone[occurrenceKey(r, ds)] }); d = advance(d, r.freq || "monthly", anchor); }
  return out;
}
export const periodOccurrences = (a, b) => S.recurring.flatMap(r => occurrencesBetween(r, a, b)).sort((x, y) => x.date.localeCompare(y.date));
export function reservedCommitments(a, b) {
  const items = periodOccurrences(a, b).filter(o => !o.done && o.rec.type !== "income" && o.rec.reserve !== false);
  return { amount: items.reduce((n, o) => n + amountSgd(o.rec), 0), count: items.length, items };
}
export function expectedIncome(a, b) {
  const items = periodOccurrences(a, b).filter(o => !o.done && o.rec.type === "income");
  return { amount: items.reduce((n, o) => n + amountSgd(o.rec), 0), count: items.length, items };
}
export function nextOccurrence(r) {
  const t = today();
  return occurrencesBetween(r, addDays(t, -31), new Date(t.getFullYear() + 2, t.getMonth(), t.getDate() + 1)).find(o => !o.done && pIso(o.date) >= t) || null;
}

/* ── accounts ── */
export const ACCOUNT_GROUPS = [
  { id: "cash", label: "Cash", icon: "cash", kind: "asset" },
  { id: "bank", label: "Bank accounts", one: "Bank account", icon: "bank", kind: "asset" },
  { id: "savings", label: "Savings", one: "Savings", icon: "piggy", kind: "asset" },
  { id: "prepaid", label: "Top-up / prepaid", one: "Prepaid", icon: "prepaid", kind: "asset" },
  { id: "credit", label: "Credit cards", one: "Credit card", icon: "card", kind: "owe" },
  { id: "loan", label: "Loans", one: "Loan", icon: "loan", kind: "owe" },
  { id: "investment", label: "Investments", one: "Investment", icon: "trend", kind: "hold" },
  { id: "other", label: "Other", one: "Other", icon: "wallet", kind: "hold" },
];
export const groupOf = type => ACCOUNT_GROUPS.find(g => g.id === type) || ACCOUNT_GROUPS[1];
export const isOwing = a => a.type === "credit" || a.type === "loan";
export const ledgerAmountSgd = x => (x.cur === "MYR" ? Math.round((x.amount || 0) / (x.rate || S.rate || 3.35)) : x.amount || 0);
export function accountCurrent(a) {
  let v = a.baseBalance != null ? a.baseBalance : a.balance || 0;
  const snap = a.snapshotAt || 0, credit = a.type === "credit";
  for (const t of S.txns) {
    if (t.account !== a.id || t.source === "historical_import" || !t.createdAt || t.createdAt <= snap) continue;
    v += credit ? t.sgd || 0 : -(t.sgd || 0);
  }
  for (const x of S.ledger) {
    if (x.source === "historical_import" || !x.createdAt || x.createdAt <= snap) continue;
    const amt = ledgerAmountSgd(x);
    if (x.type === "income" && x.account === a.id) v += credit ? -amt : amt;
    else if (x.type === "expense" && x.account === a.id) v += credit ? amt : -amt;
    else if (x.type === "refund" && x.account === a.id) v += credit ? -amt : amt;
    else if (x.type === "transfer") { if (x.from === a.id) v += credit ? 0 : -amt; if (x.to === a.id) v += credit ? 0 : amt; }
    else if (x.type === "card_payment") { if (x.from === a.id) v -= amt; if (x.to === a.id) v -= amt; }
    else if (x.type === "adjustment" && x.account === a.id) v += x.delta || 0;
    else if (x.type === "goal" && x.account === a.id) v -= amt;
  }
  return Math.round(v);
}
export function accountSgd(a) { const v = accountCurrent(a); return String(a.currency || "SGD").toUpperCase() === "MYR" ? Math.round(v / (S.rate || 3.35)) : v; }
/* liquid = cash-like accounts; credit/loans are owed; investments/other are held but not spendable */
export function liquidTotals() {
  let liquid = 0, credit = 0, loans = 0, held = 0;
  for (const a of S.accounts) {
    const v = accountSgd(a), g = groupOf(a.type);
    if (a.type === "credit") credit += Math.abs(v);
    else if (a.type === "loan") loans += Math.abs(v);
    else if (g.kind === "hold") held += v;
    else liquid += v;
  }
  return { liquid, credit, loans, held, net: liquid - credit - loans, worth: liquid + held - credit - loans };
}
export function goalReserveCurrent() {
  const ps = pStart(today()), pe = pShift(ps, 1);
  let due = 0;
  for (const g of S.goals) {
    if (g.active === false) continue;
    let paid = 0;
    for (const c of S.goalContrib) if (c.goal === g.id && pIso(c.date) >= ps && pIso(c.date) < pe) paid += c.amount || 0;
    due += Math.max(0, (g.periodContribution || 0) - paid);
  }
  return due;
}

/* ── budget windows ── */
export function dayBudget() {
  const ps = pStart(today()), pe = pShift(ps, 1), pd = Math.max(1, days(ps, pe)), periodCap = capAll();
  const a = today(), b = addDays(a, 1);
  return { ps, pe, a, b, budget: S.dailyCap > 0 ? S.dailyCap : periodCap / pd, sp: spent(a, b), periodCap, pd };
}
export function weekWin() {
  const ps = pStart(today()), pe = pShift(ps, 1), n = Math.floor(days(ps, today()) / 7);
  const ws = addDays(ps, n * 7); let we = addDays(ws, 7); if (we > pe) we = pe;
  return { ps, pe, ws, we, n };
}
export function weekBudget() {
  const w = weekWin(), perDay = capAll() / days(w.ps, w.pe);
  return { w, budget: perDay * days(w.ws, w.we) + (perDay * days(w.ps, w.ws) - spent(w.ps, w.ws)), sp: spent(w.ws, w.we) };
}
/* Everything the home gauge needs for the chosen window ("day" | "week" | "period"). */
export function gaugeData(mode) {
  let cap, sp, dl, lab, ps, pe;
  if (mode === "day") { const d = dayBudget(); cap = d.budget; sp = d.sp; dl = 1; lab = "left today"; ps = d.a; pe = d.b; }
  else if (mode === "week") { const w = weekBudget(); cap = w.budget; sp = w.sp; dl = Math.max(1, days(today(), w.w.we)); lab = "left this week"; ps = w.w.ws; pe = w.w.we; }
  else { ps = pStart(today()); pe = pShift(ps, 1); cap = capAll(); sp = spent(ps, pe); dl = Math.max(1, days(today(), pe)); lab = "left this period"; }
  const pd = Math.max(1, days(ps, pe)), elapsed = Math.max(0, Math.min(pd, days(ps, today()) + 1));
  const left = cap - sp, reserve = reservedCommitments(ps, pe), goals = goalReserveCurrent();
  const freeAfter = left - reserve.amount - goals;
  const ideal = Math.min(1, elapsed / pd), used = cap > 0 ? sp / cap : 0, paceDelta = sp - cap * ideal;
  let pace = "";
  if (cap > 0) pace = Math.abs(paceDelta) < Math.max(500, cap * 0.015) ? "Right on pace" : paceDelta > 0 ? "ahead" : "under";
  return {
    mode, cap, sp, left, dl, lab, ps, pe, pd, elapsed, ideal, used, paceDelta, pace,
    reserved: reserve.amount + goals, reservedBills: reserve.amount, reservedGoals: goals,
    safeToday: freeAfter > 0 ? freeAfter / dl : 0,
    perDay: left < 0 ? 0 : reserve.amount ? Math.max(0, left - reserve.amount) / dl : left / dl,
  };
}
/* per-envelope view for a window, scaled the same way 3.x did */
export function envelopeRows(mode) {
  let a, b, scale = 1;
  if (mode === "day") { const d = dayBudget(); a = d.a; b = d.b; scale = capAll() > 0 ? d.budget / capAll() : 1 / d.pd; }
  else if (mode === "week") { const w = weekWin(); a = w.ws; b = w.we; scale = days(w.ws, w.we) / days(w.ps, w.pe); }
  else { a = pStart(today()); b = pShift(a, 1); }
  return S.cats.map(c => { const cap = (c.cap || 0) * scale, sp = spent(a, b, c.id); return { c, cap, sp, left: cap - sp, f: cap > 0 ? sp / cap : 0 }; });
}
export function envelopeLeftThisPeriod(cid) { const ps = pStart(today()); const c = catOf(cid); return ((c && c.cap) || 0) - spent(ps, pShift(ps, 1), cid); }

/* ── plan overview ── */
export function planOverview() {
  const ps = pStart(today()), pe = pShift(ps, 1), envelopeLeft = capAll() - spent(ps, pe);
  const res = reservedCommitments(ps, pe), inc = expectedIncome(ps, pe), goals = goalReserveCurrent(), cash = liquidTotals();
  const budgetFree = envelopeLeft - res.amount - goals;
  return { ps, pe, envelopeLeft, reserved: res.amount + goals, bills: res.amount, goals, income: inc.amount, cash, free: S.accounts.length ? Math.min(cash.net, budgetFree) : budgetFree };
}

/* ── debt payoff ── */
export const debtTotals = () => S.debts.reduce((t, d) => ({ start: t.start + (d.start || 0), bal: t.bal + (d.bal || 0), cleared: t.cleared + ((d.start || 0) - (d.bal || 0)) }), { start: 0, bal: 0, cleared: 0 });
/* plan = {strategy, monthlyBudget} — defaults to the saved plan; pass another to compare "what if" */
export function debtForecast(plan) {
  plan = plan || S.debtPlan || {};
  const debts = S.debts.filter(d => (d.bal || 0) > 0).map(d => ({ id: d.id, name: d.name, bal: d.bal || 0, rate: +d.rate || 0, minPay: d.minPay || 0 }));
  if (!debts.length) return { months: 0, interest: 0, schedule: [], target: null, warning: "", budget: 0 };
  const minTotal = debts.reduce((a, d) => a + d.minPay, 0), budget = plan.monthlyBudget || minTotal;
  if (budget <= 0) return { months: null, interest: 0, schedule: [], target: null, warning: "Set a monthly debt budget or minimum payments to build a forecast.", budget: 0 };
  const order = () => debts.filter(d => d.bal > 0).sort((a, b) => plan.strategy === "snowball" ? a.bal - b.bal || b.rate - a.rate : b.rate - a.rate || a.bal - b.bal);
  let interest = 0, month = 0, warning = budget < minTotal ? "Monthly budget is below your stated minimum payments." : "";
  const schedule = [], first = order()[0] || null, cleared = {};
  while (order().length && month < 600) {
    month++;
    let available = budget;
    for (const d of order()) { const it = Math.round(d.bal * (d.rate / 100 / 12)); d.bal += it; interest += it; }
    for (const d of order()) { const pay = Math.min(d.bal, d.minPay || 0, available); d.bal -= pay; available -= pay; }
    let act = order();
    while (available > 0 && act.length) { const d = act[0], pay = Math.min(d.bal, available); d.bal -= pay; available -= pay; act = order(); }
    for (const d of debts) if (d.bal <= 0 && !cleared[d.id]) cleared[d.id] = month;
    if (month <= 12 || month % 6 === 0 || !order().length) schedule.push({ month, total: debts.reduce((a, d) => a + Math.max(0, d.bal), 0) });
  }
  if (month >= 600 && order().length) warning = "At this payment level the debt does not clear within 50 years.";
  return { months: month, interest, schedule, target: first, warning, budget, cleared };
}
export function monthNameFromNow(n) { const t = today(); const d = new Date(t.getFullYear(), t.getMonth() + n, 1); return MO[d.getMonth()] + " " + d.getFullYear(); }
export function durationText(m) { if (m == null) return "—"; const y = Math.floor(m / 12), r = m % 12; return (y ? y + (y === 1 ? " yr " : " yrs ") : "") + (r ? r + " mo" : y ? "" : "0 mo"); }
/* How actual payments compare with the plan over the last `n` full calendar months. */
export function debtDrift(n = 3) {
  const t = today(), out = [];
  for (let i = n; i >= 1; i--) {
    const a = new Date(t.getFullYear(), t.getMonth() - i, 1), b = new Date(t.getFullYear(), t.getMonth() - i + 1, 1);
    const paid = S.pays.filter(p => { const d = pIso(p.date); return d >= a && d < b; }).reduce((s, p) => s + (p.amt || 0), 0);
    out.push({ label: MO[a.getMonth()] + " " + a.getFullYear(), paid });
  }
  const avg = Math.round(out.reduce((s, x) => s + x.paid, 0) / (n || 1));
  const planned = S.debtPlan.monthlyBudget || S.debts.reduce((s, d) => s + ((d.bal || 0) > 0 ? d.minPay || 0 : 0), 0);
  const tracked = S.pays.length > 0;
  return { months: out, avg, planned, gap: avg - planned, tracked, atActual: tracked && avg > 0 ? debtForecast({ strategy: S.debtPlan.strategy, monthlyBudget: avg }) : null };
}

/* ── history / insights ── */
export function periodSeries(count) {
  const out = [], end = pShift(pStart(today()), 1);
  for (let i = count - 1; i >= 0; i--) {
    const a = pShift(end, -i - 1), b = pShift(a, 1);
    let expense = 0, income = 0;
    for (const t of S.txns) if (inR(t, a, b)) expense += t.sgd || 0;
    for (const x of S.ledger) {
      if (!x.date || !inR(x, a, b)) continue;
      const v = ledgerAmountSgd(x);
      if (x.type === "income" || x.type === "refund") income += v; else if (x.type === "expense") expense += v;
    }
    out.push({ a, b, label: MO[a.getMonth()] + " " + String(a.getFullYear()).slice(-2), expense, income, saved: income > 0 ? income - expense : null });
  }
  return out;
}
export function periodTotals(a, b) {
  let out = 0, inc = 0;
  for (const t of S.txns) if (inR(t, a, b)) out += t.sgd || 0;
  for (const x of S.ledger) {
    if (!x.date || !inR(x, a, b)) continue;
    const v = ledgerAmountSgd(x);
    if (x.type === "income" || x.type === "refund") inc += v; else if (x.type === "expense") out += v;
  }
  return { out, inc, net: inc - out };
}
export function byEnvelope(a, b) {
  const by = {};
  for (const t of S.txns) if (inR(t, a, b)) by[t.cat] = (by[t.cat] || 0) + (t.sgd || 0);
  return Object.keys(by).map(cid => ({ cid, amt: by[cid] })).sort((x, y) => y.amt - x.amt);
}

/* ── merchants ── */
export function merchantKey(s) {
  return String(s || "").toUpperCase().replace(/\b(PTE|LTD|LIMITED|SINGAPORE|SG|PAYMENT|PURCHASE|DEBIT|CARD)\b/g, " ").replace(/[^A-Z0-9]+/g, " ").trim().split(" ").slice(0, 5).join(" ");
}
function bestRule(map, desc) { const k = merchantKey(desc); let best = "", val = ""; for (const r of Object.keys(map || {})) if (r && k.indexOf(r) >= 0 && r.length > best.length) { best = r; val = map[r]; } return val; }
export const ruleCategory = desc => { const id = bestRule(S.merchantRules, desc); return id && catOf(id) ? id : ""; };
export const canonicalMerchant = desc => bestRule(S.merchantAliases, desc) || String(desc || "").trim();
export function rememberRule(desc, cat, name) {
  const k = merchantKey(desc);
  if (!k) return;
  if (cat) S.merchantRules[k] = cat;
  if (name && String(name).trim() && merchantKey(name) !== k) S.merchantAliases[k] = String(name).trim();
}
export function merchantSimilarity(a, b) {
  const A = merchantKey(a).split(" ").filter(w => w.length > 1), B = merchantKey(b).split(" ").filter(w => w.length > 1);
  if (!A.length || !B.length) return 0;
  return A.filter(w => B.includes(w)).length / Math.max(A.length, B.length);
}

/* ── currency helpers for statements ── */
export function inCur(amount, fromCur, cur, rate) { if (fromCur === cur) return amount || 0; rate = rate || S.rate || 3.35; return cur === "MYR" ? Math.round((amount || 0) * rate) : Math.round((amount || 0) / rate); }
export const txnInCur = (t, cur) => (t.cur === "MYR" ? inCur(t.orig || 0, "MYR", cur, t.rate) : inCur(t.sgd || 0, "SGD", cur, t.rate));
export const ledgerInCur = (x, cur) => inCur(x.amount || 0, x.cur === "MYR" ? "MYR" : "SGD", cur, x.rate);

/* ── new transaction objects (one place, so every entry is shaped the same) ── */
export function makeTxn({ amount, cur, cat, note, account, date, source, extra }) {
  cur = cur === "MYR" ? "MYR" : "SGD";
  const t = { id: uid(), date: date || iso(today()), cur, orig: amount, cat, note: String(note || "").trim(), account: account || "", createdAt: Date.now() };
  if (cur === "MYR") { t.rate = S.rate || 3.35; t.sgd = Math.round(amount / t.rate); } else t.sgd = amount;
  if (source) t.source = source;
  return Object.assign(t, extra || {});
}
