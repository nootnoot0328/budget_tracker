/* Budget Margin 4 — Plan: free margin, bills, goals, debt payoff and accounts. */
import { h, icon, money, rmf, curMoney, dateShort, iso, pIso, today, toCents, fixed2, haptic } from "../util.js";
import { S, save, uid } from "../state.js";
import * as C from "../calc.js";
import { openSheet, closeSheet, toast, confirmSheet, field, options, accountOptions, moneyInput, toggleRow, val, checked, badge } from "./core.js";
import { logSpend } from "./entry.js";

let go = () => { }, hooks = {};
export const initPlan = (nav, hk) => { go = nav; hooks = hk || {}; };
const TABS = [["overview", "Overview"], ["bills", "Bills"], ["goals", "Goals"], ["debt", "Debt"], ["accounts", "Accounts"]];
let tab = "overview";
export const setPlanTab = t => { if (TABS.some(x => x[0] === t)) tab = t; };

export function renderPlan(root) {
  root.replaceChildren(
    h("div.bar", h("h1", "Plan"), h("div.bar-actions", h("button.icon-btn", { type: "button", "aria-label": "Settings", html: icon("gear"), onclick: () => go("settings") }))),
    h("div.seg.plan-tabs", { role: "tablist" }, TABS.map(([k, l]) => h("button", { type: "button", role: "tab", "aria-pressed": tab === k ? "true" : "false", "aria-selected": tab === k ? "true" : "false", onclick: () => { tab = k; haptic(3); renderPlan(root); } }, l))));
  const body = h("div"); root.appendChild(body);
  ({ overview, bills, goals, debt, accounts })[tab](body);
}
const sec = (title, action, ...kids) => h("div.section", h("div.section-head", h("h2", title), action), ...kids);
const addLink = (label, fn) => h("button.link", { type: "button", onclick: fn }, label);

/* ── overview ── */
function overview(body) {
  const o = C.planOverview(), capTotal = C.capAll();
  body.append(h("div.card",
    h("div.tank", h("i", { style: { width: (capTotal > 0 ? Math.max(0, Math.min(100, o.free / capTotal * 100)) : 0) + "%" } }),
      h("div", h("span", "FREE MARGIN · " + C.pLabel(o.ps).toUpperCase()), h("b.tab" + (o.free < 0 ? ".bad" : ""), (o.free < 0 ? "-" : "") + money(Math.abs(o.free), false)))),
    h("div.kv",
      h("div", h("span", "Envelope money left"), h("b.tab", money(o.envelopeLeft, false))),
      h("div", h("span", "Set aside (bills + goals)"), h("b.tab", money(o.reserved, false))),
      h("div", h("span", "Expected income"), h("b.tab.good", money(o.income, false))),
      S.accounts.length ? h("div", h("span", "Net cash (accounts)"), h("b.tab", money(o.cash.net, false))) : h("div", h("span", "Accounts"), h("button.link", { type: "button", onclick: () => { tab = "accounts"; go("plan", "accounts"); } }, "Add accounts"))),
    h("p.hint", "Free margin is envelope money left after unpaid bills and this period's goal savings" + (S.accounts.length ? ", and never more than your net cash." : ".") + " Expected income isn't counted until it arrives.")));
  const t = today(), items = C.periodOccurrences(t, new Date(t.getFullYear(), t.getMonth(), t.getDate() + 31)).filter(x => !x.done);
  let net = 0; items.forEach(x => (net += x.rec.type === "income" ? C.amountSgd(x.rec) : -C.amountSgd(x.rec)));
  const list = h("div.card.flush.rows");
  items.slice(0, 12).forEach(x => list.appendChild(occRow(x, false)));
  if (!items.length) list.appendChild(h("div.empty", "Nothing scheduled in the next 30 days.", h("div", { style: { marginTop: "8px" } }, addLink("Add a bill or income", () => openRecurring()))));
  body.appendChild(sec("Next 30 days", h("span.small.dim.tab", (net >= 0 ? "+" : "-") + money(Math.abs(net), false) + " net"), list));
  // month-end check
  const recs = S.recs.slice(-4).reverse();
  const rc = h("div.card");
  rc.appendChild(h("p.hint", { style: { marginTop: 0 } }, "Compare what you logged with what your bank shows. A statement import matches entries one by one and lets you add anything you missed."));
  rc.appendChild(h("div.btn-row", { style: { marginTop: "10px" } },
    h("button.btn.sm", { type: "button", onclick: () => hooks.statement && hooks.statement() }, "Import statement"),
    h("button.btn.sm.soft", { type: "button", onclick: () => hooks.monthCheck && hooks.monthCheck(C.pShift(C.pStart(today()), -1)) }, "Enter a total")));
  if (recs.length) rc.appendChild(h("div.rows", { style: { marginTop: "12px" } }, recs.map(r => { const gap = r.actual - r.logged; return h("div.row", { style: { padding: "10px 2px", minHeight: 0 } }, h("div.txt", h("div.t1", r.label || C.pLabel(pIso(r.p))), h("div.t2", r.matched != null ? r.matched + " matched · " + (r.missing || 0) + " not in app" : "Manual check")), h("div.val.tab" + (Math.abs(gap) > Math.max(500, r.logged * 0.15) ? ".bad" : ""), (gap < 0 ? "-" : gap > 0 ? "+" : "") + (r.cur === "MYR" ? rmf(Math.abs(gap)) : money(Math.abs(gap), false)), h("small", "difference"))); })));
  body.appendChild(sec("Month-end check", null, rc));
}
function occRow(o, withAction) {
  const r = o.rec, inc = r.type === "income", overdue = pIso(o.date) < today();
  return h("div.row", badge(inc ? "arrowIn" : "calendar", inc ? "var(--jade)" : overdue ? "var(--coral)" : "var(--blue)", true),
    h("div.txt", h("div.t1", r.name), h("div.t2", (overdue ? "Overdue · " : "") + dateShort(o.date) + (r.account ? " · " + C.accountName(r.account) : ""))),
    h("div.val.tab" + (inc ? ".plus" : ""), (inc ? "+" : "-") + (r.cur === "MYR" ? rmf(r.amount) : money(r.amount, false))),
    withAction !== false ? h("button.btn.sm.soft", { type: "button", onclick: () => completeOccurrence(o) }, inc ? "Received" : r.cat ? "Log" : "Paid") : null);
}
function completeOccurrence(o) {
  const r = o.rec, key = C.occurrenceKey(r, o.date), now = Date.now(), amt = r.amount || 0, cur = r.cur || "SGD";
  let undo = null;
  if (r.type === "income" && r.account) { const x = { id: "l" + now, type: "income", account: r.account, amount: amt, cur, date: o.date, note: r.name, createdAt: now }; S.ledger.push(x); undo = () => (S.ledger = S.ledger.filter(z => z !== x)); }
  else if (r.type !== "income" && r.cat) { const t = C.makeTxn({ amount: amt, cur, cat: r.cat, note: r.name, account: r.account || "", date: o.date }); S.txns.push(t); undo = () => (S.txns = S.txns.filter(z => z !== t)); }
  else if (r.type !== "income" && r.account) { const x = { id: "l" + now, type: "expense", account: r.account, amount: amt, cur, date: o.date, note: r.name, createdAt: now }; S.ledger.push(x); undo = () => (S.ledger = S.ledger.filter(z => z !== x)); }
  S.recurringDone[key] = true; save();
  toast(r.type === "income" ? "Income received" : r.cat ? "Logged" : "Marked paid", () => { if (undo) undo(); delete S.recurringDone[key]; save(); });
}

/* ── bills & income schedules ── */
function bills(body) {
  const t = today(), ps = C.pStart(t), start = ps > new Date(t.getFullYear(), t.getMonth(), t.getDate() - 14) ? ps : new Date(t.getFullYear(), t.getMonth(), t.getDate() - 14);
  const up = C.periodOccurrences(start, new Date(t.getFullYear(), t.getMonth(), t.getDate() + 31)).filter(o => !o.done).slice(0, 12);
  const upl = h("div.card.flush.rows"); up.forEach(o => upl.appendChild(occRow(o)));
  if (!up.length) upl.appendChild(h("div.empty", "Nothing due in the next 30 days."));
  body.appendChild(sec("Due soon", null, upl));
  const list = h("div.card.flush.rows");
  S.recurring.forEach(r => { const nx = C.nextOccurrence(r); list.appendChild(h("button.row", { type: "button", onclick: () => openRecurring(r.id) }, badge(r.type === "income" ? "arrowIn" : "calendar", r.type === "income" ? "var(--jade)" : "var(--blue)"),
    h("div.txt", h("div.t1", r.name), h("div.t2", [cap1(r.freq || "monthly"), nx ? "next " + dateShort(nx.date) : null, r.active === false ? "paused" : r.type !== "income" && r.reserve !== false ? "set aside" : null].filter(Boolean).join(" · "))),
    h("div.val.tab" + (r.type === "income" ? ".plus" : ""), (r.type === "income" ? "+" : "") + (r.cur === "MYR" ? rmf(r.amount) : money(r.amount, false))))); });
  if (!S.recurring.length) list.appendChild(h("div.empty", h("b", "No schedules yet"), "Add rent, loan instalments, insurance, subscriptions or salary. Unpaid bills are set aside from Safe today."));
  body.appendChild(sec("Schedules", addLink("+ Add", () => openRecurring()), list));
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
export function openRecurring(id) {
  let r = id ? S.recurring.find(x => x.id === id) : null; const isNew = !r;
  if (!r) r = { id: "r" + Date.now(), name: "", type: "expense", amount: 0, cur: "SGD", freq: "monthly", start: iso(today()), reserve: true, cat: "", account: "", active: true };
  openSheet(isNew ? "New schedule" : "Edit schedule",
    field("Name", h("input", { id: "rName", value: r.name, placeholder: "Rent, car loan, Netflix, salary…", autocomplete: "off" })),
    h("div.two", field("Type", h("select", { id: "rType" }, options([{ value: "expense", label: "Bill / expense" }, { value: "income", label: "Income" }], r.type))), field("Repeats", h("select", { id: "rFreq" }, options([{ value: "monthly", label: "Monthly" }, { value: "weekly", label: "Weekly" }, { value: "yearly", label: "Yearly" }], r.freq)))),
    h("div.two", field("Amount", moneyInput("rAmt", r.amount)), field("Currency", h("select", { id: "rCur" }, options(["SGD", "MYR"], r.cur || "SGD")))),
    field("Next due", h("input", { id: "rStart", type: "date", value: r.start })),
    field("When paid, log it in", h("select", { id: "rCat" }, options(S.cats.map(c => ({ value: c.id, label: c.name })), r.cat || "", "Nowhere (reminder only)"))),
    S.accounts.length ? field("Account", h("select", { id: "rAcc" }, accountOptions(r.account || "", "Unassigned"))) : null,
    toggleRow("rRes", r.reserve !== false, "Set aside until paid", "Unpaid bills this period are taken out of Safe today. Ignored for income."),
    !isNew ? toggleRow("rAct", r.active !== false, "Active", "Pause to stop reminders without deleting it.") : null,
    h("button.btn", { type: "button", onclick: () => {
      const name = val("rName").trim(), amt = toCents(val("rAmt"));
      if (!name || !amt) { toast("Enter a name and an amount"); return; }
      Object.assign(r, { name, type: val("rType"), freq: val("rFreq"), amount: amt, cur: val("rCur"), start: val("rStart") || iso(today()), cat: val("rCat"), account: document.getElementById("rAcc") ? val("rAcc") : r.account, reserve: checked("rRes") });
      if (!isNew) r.active = checked("rAct");
      if (isNew) S.recurring.push(r);
      closeSheet(); save(); toast(isNew ? "Schedule added" : "Schedule updated");
    } }, "Save"),
    !isNew ? h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmSheet("Remove " + r.name + "?", "Past entries it created stay in Activity.", "Remove", true)) { S.recurring = S.recurring.filter(x => x.id !== r.id); save(); toast("Schedule removed"); } } }, "Remove schedule") : null);
}

/* ── goals ── */
function goals(body) {
  let saved = 0, target = 0; S.goals.forEach(g => { if (g.active !== false) { saved += g.saved || 0; target += g.target || 0; } });
  if (S.goals.length) body.appendChild(h("div.card", h("div.kv",
    h("div", h("span", "Saved so far"), h("b.tab", money(saved, false))),
    h("div", h("span", "Still to go"), h("b.tab", money(Math.max(0, target - saved), false))),
    h("div", h("span", "Due this period"), h("b.tab", money(C.goalReserveCurrent(), false))),
    h("div", h("span", "Goals"), h("b", String(S.goals.length))))));
  const grid = h("div.goal-grid");
  S.goals.forEach(g => {
    const pct = g.target > 0 ? Math.min(1, (g.saved || 0) / g.target) : 0;
    grid.appendChild(h("button.goal", { type: "button", onclick: () => openGoal(g.id) }, h("b", g.name), h("div.amt.tab", money(g.saved || 0, false)), h("small", "of " + money(g.target || 0, false) + " · " + Math.round(pct * 100) + "%" + (g.targetDate ? " · by " + dateShort(g.targetDate) : "")), h("div.meter", h("i", { style: { width: pct * 100 + "%" } }))));
  });
  body.appendChild(sec("Goals & sinking funds", addLink("+ Goal", () => openGoal()), S.goals.length ? grid : h("div.card", h("div.empty", h("b", "No goals yet"), "Save towards travel, insurance, an emergency fund or anything you want ready in advance."))));
}
export function openGoal(id) {
  let g = id ? S.goals.find(x => x.id === id) : null; const isNew = !g;
  if (!g) g = { id: "g" + Date.now(), name: "", target: 0, saved: 0, targetDate: "", periodContribution: 0, active: true };
  openSheet(isNew ? "New goal" : g.name,
    field("Goal", h("input", { id: "gName", value: g.name, placeholder: "Emergency fund", autocomplete: "off" })),
    h("div.two", field("Target", moneyInput("gT", g.target)), field("Saved so far", moneyInput("gS", g.saved))),
    h("div.two", field("Set aside each period", moneyInput("gP", g.periodContribution)), field("Target date", h("input", { id: "gD", type: "date", value: g.targetDate || "" }))),
    h("button.btn", { type: "button", onclick: () => {
      const name = val("gName").trim(); if (!name) { toast("Give the goal a name"); return; }
      Object.assign(g, { name, target: toCents(val("gT")), saved: toCents(val("gS")), periodContribution: toCents(val("gP")), targetDate: val("gD") || "" });
      if (isNew) S.goals.push(g); closeSheet(); save(); toast(isNew ? "Goal added" : "Goal updated");
    } }, "Save"),
    !isNew ? h("button.btn.soft", { type: "button", onclick: () => contribute(g) }, "Add money to this goal") : null,
    !isNew ? h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmSheet("Remove " + g.name + "?", null, "Remove", true)) { S.goals = S.goals.filter(x => x.id !== g.id); save(); toast("Goal removed"); } } }, "Remove goal") : null);
}
function contribute(g) {
  openSheet("Add to " + g.name,
    field("Amount", moneyInput("gcA", 0)),
    S.accounts.length ? field("From account", h("select", { id: "gcAcc" }, accountOptions("", "No account"))) : null,
    h("button.btn", { type: "button", onclick: () => {
      const amt = toCents(val("gcA")); if (!amt) { toast("Enter an amount"); return; }
      const acc = val("gcAcc"), now = Date.now();
      g.saved = (g.saved || 0) + amt;
      S.goalContrib.push({ id: "gc" + now, goal: g.id, amount: amt, date: iso(today()), account: acc, createdAt: now });
      if (acc) S.ledger.push({ id: "l" + now, type: "goal", account: acc, amount: amt, cur: "SGD", date: iso(today()), note: g.name, createdAt: now });
      closeSheet(); save(); toast(money(amt, false) + " added to " + g.name);
    } }, "Save"));
}

/* ── debt ── */
function debt(body) {
  const active = S.debts.some(d => (d.bal || 0) > 0), f = C.debtForecast(), t = C.debtTotals();
  const plan = h("div.card");
  const strat = h("div.seg", ["avalanche", "snowball"].map(k => h("button", { type: "button", "aria-pressed": (S.debtPlan.strategy || "avalanche") === k ? "true" : "false", onclick: () => { S.debtPlan.strategy = k; save(); } }, k === "avalanche" ? "Highest rate first" : "Smallest first")));
  const budget = h("input", { id: "dBud", inputmode: "decimal", placeholder: "Minimums only", value: S.debtPlan.monthlyBudget ? (S.debtPlan.monthlyBudget / 100).toFixed(0) : "", onchange: e => { S.debtPlan.monthlyBudget = toCents(e.target.value); save(); } });
  plan.append(field("Order", strat), field("Monthly debt budget (S$)", budget, "Pays every minimum, then puts the rest on the debt at the front of the queue."));
  if (!active) plan.appendChild(h("div.empty", "Add a debt below to see when you'll be debt-free."));
  else if (f.months == null) plan.appendChild(h("p.note.warn", f.warning));
  else {
    plan.appendChild(h("div.kv", { style: { marginTop: "6px" } },
      h("div", h("span", "Debt-free"), h("b", C.monthNameFromNow(f.months))),
      h("div", h("span", "Time"), h("b", C.durationText(f.months))),
      h("div", h("span", "Projected interest"), h("b.tab", money(f.interest, false))),
      h("div", h("span", "Pay off first"), h("b", f.target ? f.target.name : "—"))));
    if (f.warning) plan.appendChild(h("p.note.warn", { style: { marginTop: "12px" } }, f.warning));
    const max = t.bal || 1, tl = h("div.timeline");
    f.schedule.filter((x, i) => i < 6 || x.month === f.months).slice(0, 8).forEach(x => tl.appendChild(h("div", h("span", x.month === f.months ? "Debt-free" : "Month " + x.month), h("div.meter", h("i", { style: { width: Math.max(0, Math.min(100, x.total / max * 100)) + "%", background: "var(--violet)" } })), h("b.tab", money(x.total, false)))));
    plan.appendChild(tl);
  }
  body.appendChild(h("div.section", { style: { marginTop: "4px" } }, h("div.section-head", h("h2", "Payoff plan"), h("button.link", { type: "button", onclick: () => go("ask", "Set a new debt plan that fits my budget") }, "Ask for a plan")), plan));
  if (active) {
    const dr = C.debtDrift(3), card = h("div.card");
    if (!dr.tracked) card.appendChild(h("p.hint", { style: { margin: 0 } }, "Record payments on each debt (tap it below) and this shows whether you're keeping to the plan."));
    else {
      const on = dr.gap >= -Math.max(1000, dr.planned * 0.05);
      card.append(h("div.kv",
        h("div", h("span", "Planned per month"), h("b.tab", money(dr.planned, false))),
        h("div", h("span", "Actually paid (3-mo avg)"), h("b.tab" + (on ? ".good" : ".bad"), money(dr.avg, false)))),
        h("p.hint", dr.months.map(m => m.label.split(" ")[0] + " " + money(m.paid, false)).join(" · ")),
        dr.atActual && dr.atActual.months != null && !on ? h("p.note.warn", { style: { marginTop: "10px" } }, h("b", "At this pace: debt-free " + C.monthNameFromNow(dr.atActual.months)), "That's " + C.durationText(Math.max(0, dr.atActual.months - (f.months || 0))) + " later than the plan, with " + money(Math.max(0, dr.atActual.interest - f.interest), false) + " more interest.") : on ? h("p.note.good", { style: { marginTop: "10px" } }, "You're keeping to the plan.") : null);
    }
    body.appendChild(sec("Plan vs actual", null, card));
  }
  const list = h("div.card.flush.rows");
  S.debts.forEach(d => { const fr = d.start > 0 ? (d.start - d.bal) / d.start : 0; list.appendChild(h("button.row", { type: "button", onclick: () => openDebt(d.id) }, badge("loan", d.bal <= 0 ? "var(--jade)" : "var(--violet)"),
    h("div.txt", h("div.t1", d.name), h("div.t2", [(d.rate || 0) + "% APR", d.minPay ? "min " + money(d.minPay, false) : null, Math.round(fr * 100) + "% cleared"].filter(Boolean).join(" · ")), h("div.meter", { style: { marginTop: "6px", height: "4px" } }, h("i", { style: { width: Math.max(0, Math.min(100, fr * 100)) + "%", background: "var(--violet)" } }))),
    h("div.val.tab", d.bal <= 0 ? "Cleared" : money(d.bal, false)))); });
  if (!S.debts.length) list.appendChild(h("div.empty", "No debts. Add loans or card balances you're paying down."));
  body.appendChild(sec("Debts" + (t.bal ? " · " + money(t.bal, false) : ""), addLink("+ Debt", () => openDebt()), list));
}
function openDebt(id) {
  let d = id ? S.debts.find(x => x.id === id) : null; const isNew = !d;
  if (!d) d = { id: "d" + Date.now(), name: "", start: 0, bal: 0, rate: 0, minPay: 0 };
  const pays = S.pays.filter(p => p.debt === d.id).slice(-3).reverse();
  openSheet(isNew ? "New debt" : d.name,
    !isNew ? h("div", h("div.label", "Record a payment"), h("div.two", moneyInput("pA", 0, "Amount paid"), h("button.btn", { type: "button", style: { minHeight: "46px" }, onclick: () => {
      const a = toCents(val("pA")); if (!(a > 0)) { toast("Enter an amount above zero"); return; }
      const before = d.bal, p = { id: uid(), date: iso(today()), debt: d.id, amt: a };
      d.bal = Math.max(0, d.bal - a); S.pays.push(p); closeSheet(); save();
      toast(d.bal <= 0 ? d.name + " is cleared" : money(a) + " paid · " + money(d.bal, false) + " to go", () => { d.bal = before; S.pays = S.pays.filter(x => x !== p); save(); });
    } }, "Record")), pays.length ? h("p.hint", "Recent: " + pays.map(p => dateShort(p.date) + " " + money(p.amt, false)).join(" · ")) : null, h("div", { style: { height: "14px" } })) : null,
    isNew ? field("Name", h("input", { id: "dN", placeholder: "Car loan, credit card…", autocomplete: "off" })) : null,
    h("div.two", field(isNew ? "Balance owed" : "Correct the balance", moneyInput("dB", d.bal)), field("Interest rate (% a year)", h("input", { id: "dR", inputmode: "decimal", value: d.rate || "" }))),
    field("Minimum monthly payment", moneyInput("dM", d.minPay)),
    h("button.btn" + (isNew ? "" : ".soft"), { type: "button", onclick: () => {
      if (isNew) { const n = val("dN").trim(); if (!n) { toast("Give it a name"); return; } d.name = n; }
      const b = toCents(val("dB")), r = parseFloat(val("dR"));
      d.bal = b; if (b > (d.start || 0)) d.start = b; d.rate = isNaN(r) ? 0 : r; d.minPay = toCents(val("dM"));
      if (isNew) S.debts.push(d); closeSheet(); save(); toast(isNew ? "Debt added" : "Saved");
    } }, isNew ? "Add debt" : "Save details"),
    !isNew ? h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmSheet("Remove " + d.name + "?", "Its payment history is removed from the plan too.", "Remove", true)) { S.debts = S.debts.filter(x => x.id !== d.id); save(); toast("Debt removed"); } } }, "Remove debt") : null);
}

/* ── accounts (grouped) ── */
function accounts(body) {
  const lt = C.liquidTotals();
  body.appendChild(h("div.card", h("div.networth",
    h("div", h("div.k.small.dim", "Cash & bank"), h("b.tab", money(lt.liquid, false))),
    h("div", h("div.k.small.dim", "Owing"), h("b.tab" + (lt.credit + lt.loans ? ".bad" : ""), money(lt.credit + lt.loans, false))),
    h("div", h("div.k.small.dim", "Net worth"), h("b.tab", money(lt.worth, false))))));
  if (!S.accounts.length) { body.appendChild(sec("Accounts", addLink("+ Add", () => openAccount()), h("div.card", h("div.empty", h("b", "No accounts yet"), "Add the accounts and cards you use. Spending and money in then move their balances automatically.")))); return; }
  body.appendChild(h("div.section-head", { style: { marginTop: "20px" } }, h("h2", "Accounts"), addLink("+ Add", () => openAccount())));
  for (const g of C.ACCOUNT_GROUPS) {
    const list = S.accounts.filter(a => (C.ACCOUNT_GROUPS.some(x => x.id === a.type) ? a.type : "bank") === g.id);
    if (!list.length) continue;
    const sum = list.reduce((s, a) => s + C.accountSgd(a), 0);
    body.appendChild(h("div.group-head", h("span", g.label), h("span.tab", (g.kind === "owe" ? "owing " : "") + money(Math.abs(sum), false))));
    const card = h("div.card.flush.rows");
    list.forEach(a => { const v = C.accountCurrent(a); card.appendChild(h("button.row", { type: "button", onclick: () => openAccount(a.id) }, badge(g.icon, g.kind === "owe" ? "var(--violet)" : "var(--cyan)"),
      h("div.txt", h("div.t1", a.name), h("div.t2", a.needsSnapshot ? "Set the current balance" : (a.currency === "MYR" ? "Ringgit · " : "") + (S.defaultAccount === a.id ? "Default for new spending" : "Updated " + dateShort(a.updated || iso(today()))))),
      h("div.val.tab", curMoney(Math.abs(v), a.currency || "SGD", false), h("small", g.kind === "owe" ? "owing" : v < 0 ? "overdrawn" : "")))); });
    body.appendChild(card);
  }
  body.appendChild(h("p.hint", { style: { margin: "12px 4px" } }, "Balances start from the figure you enter and then move with spending, money in, transfers and card payments recorded after that. Historical imports don't change them."));
}
export function openAccount(id) {
  let a = id ? S.accounts.find(x => x.id === id) : null; const isNew = !a;
  if (!a) a = { id: "a" + Date.now(), name: "", type: "bank", currency: "SGD", balance: 0, baseBalance: 0, snapshotAt: Date.now(), updated: iso(today()) };
  const typeSel = h("select", { id: "aT" }, options(C.ACCOUNT_GROUPS.map(g => ({ value: g.id, label: g.one || g.label })), C.ACCOUNT_GROUPS.some(g => g.id === a.type) ? a.type : "bank"));
  const balLabel = h("label", { for: "aB" }, C.isOwing(a) ? "Amount owing now" : "Balance now");
  typeSel.addEventListener("change", () => (balLabel.textContent = typeSel.value === "credit" || typeSel.value === "loan" ? "Amount owing now" : "Balance now"));
  openSheet(isNew ? "Add account" : a.name,
    field("Name", h("input", { id: "aN", value: a.name, placeholder: "DBS Multiplier, Maybank, Cash…", autocomplete: "off" })),
    h("div.two", field("Group", typeSel), field("Currency", h("select", { id: "aC" }, options(["SGD", "MYR"], a.currency || "SGD")))),
    h("div.field", balLabel, moneyInput("aB", isNew ? 0 : Math.abs(C.accountCurrent(a)))),
    toggleRow("aDef", S.defaultAccount === a.id || (isNew && !S.accounts.length), "Default for new spending"),
    h("p.hint", "Saving a balance takes a fresh snapshot. Anything recorded after it moves the balance automatically."),
    h("button.btn", { type: "button", style: { marginTop: "12px" }, onclick: () => {
      const name = val("aN").trim(); if (!name) { toast("Give the account a name"); return; }
      const bal = toCents(val("aB"));
      Object.assign(a, { name, type: val("aT"), currency: val("aC"), balance: bal, baseBalance: bal, snapshotAt: Date.now(), updated: iso(today()), needsSnapshot: false });
      if (isNew) S.accounts.push(a);
      if (checked("aDef")) S.defaultAccount = a.id; else if (S.defaultAccount === a.id) S.defaultAccount = "";
      closeSheet(); save(); toast(isNew ? "Account added" : "Balance updated");
    } }, "Save"),
    !isNew ? h("button.btn.danger", { type: "button", onclick: async () => {
      if (!(await confirmSheet("Remove " + a.name + "?", "Entries that used it become unassigned.", "Remove", true))) return;
      S.accounts = S.accounts.filter(x => x.id !== a.id);
      S.txns.forEach(t => { if (t.account === a.id) t.account = ""; });
      S.recurring.forEach(r => { if (r.account === a.id) r.account = ""; });
      S.ledger.forEach(x => { if (x.account === a.id) x.account = ""; if (x.from === a.id) x.from = ""; if (x.to === a.id) x.to = ""; });
      if (S.defaultAccount === a.id) S.defaultAccount = "";
      save(); toast("Account removed");
    } }, "Remove account") : null);
}
