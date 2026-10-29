/* Budget Margin — Future: the long-term salary, CPF and savings plan.
   The engine (engine.js) works in dollars. Everything stored in S.future.checkins is in cents,
   like the rest of the app. Conversions happen only in this file. */
import { S } from "../state.js";
import * as E from "./engine.js";

export const ENGINE = E;
const D = c => (c || 0) / 100;           // cents → dollars
const Cn = d => Math.round((d || 0) * 100); // dollars → cents

/* "YYYY-MM" for a Date or today */
export function ymOf(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
export const ymShift = (ym, n) => E.fmtYM(E.parseYM(ym) + n);
export const ymLabel = ym => E.labelYM(E.parseYM(ym));

export function F() { return S.future; }
export function cfg() { return F().cfg || E.defaultConfig(); }
export const hasOwnPlan = () => !!F().cfg;
export function checkins() { return F().checkins.slice().sort((a, b) => a.ym.localeCompare(b.ym)); }
export const latestCheckin = () => { const c = checkins(); return c[c.length - 1] || null; };
export const checkinFor = ym => F().checkins.find(c => c.ym === ym) || null;

/* ── projections, memoised on their inputs ── */
const memo = new Map();
function run(c) {
  const key = JSON.stringify(c);
  if (memo.has(key)) return memo.get(key);
  let out;
  try { out = { res: E.simulate(c), err: "" }; } catch (e) { out = { res: null, err: String(e.message || e) }; }
  if (memo.size > 12) memo.clear();
  memo.set(key, out);
  return out;
}
/** The plan as set: what was supposed to happen. Check-ins are compared against this. */
export const baseline = () => run(cfg());

/** The plan re-run from the latest check-in's actual pay and balances: where you're heading now. */
export function anchored() {
  const last = latestCheckin(), base = baseline();
  if (!F().rebase || !last || !base.res) return { ...base, from: null };
  const c = E.clone(cfg());
  const start = E.parseYM(last.ym) + 1;
  if (start > E.parseYM(base.res.months[base.res.months.length - 1].ym)) return { ...base, from: null };
  const planRow = base.res.months.find(r => r.ym === last.ym);
  c.profile.startYM = E.fmtYM(start);
  // the latest month's wages are credited by CPF next month, so add them to the balances we start from
  const pend = splitContribution(c, last.ym, D(last.empCPF) + D(last.erCPF));
  c.cpf.startOA = D(last.oa) + pend.oa;
  c.cpf.startSA = D(last.sa) + D(last.ra) + pend.sa;
  c.cpf.startMA = D(last.ma) + pend.ma;
  c.savings.startCash = D(last.cash) + D(last.fd) + D(last.ssb) + D(last.invest);
  if (last.basic > 0) c.salary.startBasic = D(last.basic);
  if (planRow) c.salary.startGrade = planRow.grade;
  // same-year figures before the new start, so the AW ceiling and tax still see the whole year
  const yr = E.yearOf(start), sameYear = checkins().filter(x => E.yearOf(E.parseYM(x.ym)) === yr && E.parseYM(x.ym) < start);
  c.cpf.preStartOW = sameYear.reduce((s, x) => s + Math.min(D(x.basic + x.allowance), c.cpf.owCeiling), 0);
  c.cpf.preStartAW = sameYear.reduce((s, x) => s + D(x.bonus), 0);
  c.cpf.preStartEmployeeCPF = sameYear.reduce((s, x) => s + D(x.empCPF), 0);
  c.tax.preStartIncome = sameYear.reduce((s, x) => s + D(x.basic + x.allowance + x.bonus), 0);
  c.bonus.employmentStart = c.bonus.employmentStart < c.profile.startYM ? c.bonus.employmentStart : c.profile.startYM;
  return { ...run(c), from: last.ym };
}
/* split one month's total contribution with the allocation ratios in force (MA, then SA/RA, OA remainder) */
function splitContribution(c, ym, total) {
  if (!(total > 0)) return { oa: 0, sa: 0, ma: 0 };
  const b = E.parseDate(c.profile.birthDate), m = E.parseYM(ym);
  const r = E.inForce(E.ALLOCATION, ym).rows[E.allocationBand(E.bandAge(b, m))];
  const ma = total * r[0], sa = total * r[1];
  return { ma, sa, oa: total - ma - sa };
}

export const rowAt = (res, ym) => (res && res.months.find(r => r.ym === ym)) || null;
export const postedCPF = r => r.oa + r.sa + r.ma + r.ra;

/* ── check-ins ── */
export const FIELDS = [
  ["basic", "Basic salary", "pay"], ["allowance", "Allowances", "pay"], ["bonus", "Bonus, AWS or other pay", "pay"],
  ["empCPF", "Employee CPF (deducted)", "pay"], ["erCPF", "Employer CPF", "pay"],
  ["oa", "Ordinary Account", "cpf"], ["sa", "Special Account", "cpf"], ["ra", "Retirement Account", "cpf"], ["ma", "MediSave", "cpf"],
  ["cash", "Cash savings", "sav"], ["fd", "Fixed deposits", "sav"], ["ssb", "SSB and bonds", "sav"], ["invest", "Other investments", "sav"],
  ["spent", "Spent this month", "month"], ["saved", "Saved this month", "month"],
];
export const blankCheckin = ym => Object.fromEntries([["ym", ym], ["note", ""], ...FIELDS.map(f => [f[0], 0])]);
export const ciCPF = c => c.oa + c.sa + c.ra + c.ma;
export const ciSavings = c => c.cash + c.fd + c.ssb + c.invest;
export const ciTotal = c => ciCPF(c) + ciSavings(c);

/** Plan vs actual for one check-in (all cents). Plan CPF is posted balances: the CPF app shows no accrued interest. */
export function compare(ci) {
  const r = rowAt(baseline().res, ci.ym);
  if (!r) return null;
  const plan = {
    basic: Cn(r.basic), allowance: Cn(r.allowance), empCPF: Cn(r.employeeCPF), erCPF: Cn(r.employerCPF),
    cpf: Cn(postedCPF(r)), savings: Cn(r.portfolioValue), total: Cn(postedCPF(r) + r.portfolioValue),
    spent: Cn(r.expenses), saved: Cn(r.saved),
  };
  const actual = { basic: ci.basic, allowance: ci.allowance, empCPF: ci.empCPF, erCPF: ci.erCPF, cpf: ciCPF(ci), savings: ciSavings(ci), total: ciTotal(ci), spent: ci.spent, saved: ci.saved };
  const gap = actual.total - plan.total, pct = plan.total > 0 ? gap / plan.total : 0;
  const status = plan.total <= 0 ? "n/a" : pct >= -0.03 ? (pct > 0.03 ? "ahead" : "on track") : pct >= -0.1 ? "a little behind" : "behind";
  return { plan, actual, gap, pct, status };
}

/* ── monthly actions ── */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const money0 = d => "S$" + Math.round(d).toLocaleString("en-SG");
export const SETUP = [
  { id: "start", text: "Start the plan from your real balances", why: "The default plan starts from zero, so comparisons mean little until it starts from your first check-in.", action: "start" },
  { id: "birth", text: "Enter your real birth date", why: "CPF age bands and the age-55 transition depend on it.", edit: "profile" },
  { id: "bonus", text: "Confirm bonus terms with HR or your contract", why: "Month paid, period covered, first-year proration, whether allowances count, whether AWS is guaranteed.", edit: "bonus" },
  { id: "lump", text: "Ask whether the ceiling lump sum exists", why: "If not, set the policy to None. It adds about S$5,100 a year from 2043 in the default plan.", edit: "salary" },
  { id: "expenses", text: "Set your real monthly living expenses", why: "The default S$2,000 is a placeholder.", edit: "savings" },
  { id: "jan2026", text: "Enter what you earned Jan–Oct 2026 (payslips or IR8A)", why: "Feeds the AW ceiling and the 2026 tax estimate.", edit: "cpf" },
  { id: "spot", text: "Spot-check one payslip's CPF split against your CPF statement", why: "If they match, the engine is right for your case.", auto: () => F().checkins.length > 0 },
];
export const setupLeft = () => SETUP.filter(t => !(F().setup[t.id] || (t.auto && t.auto())));

/** Actions for a calendar month, built from the plan's events for that month plus your own tasks. */
export function actionsFor(ym) {
  const out = [];
  const add = (id, text, sub, kind) => out.push({ id, text, sub: sub || "", kind: kind || "plan", done: !!((F().done[ym] || {})[id]) });
  const ci = checkinFor(ym);
  out.push({ id: "checkin", text: "Do this month's check-in", sub: "Payslip, CPF app balances, savings balances", kind: "checkin", done: !!ci });
  const a = anchored().res, b = baseline().res;
  const res = a && rowAt(a, ym) ? a : b;
  const r = rowAt(res, ym), prev = rowAt(res, ymShift(ym, -1));
  const c = cfg(), P = c.savings;
  if (r) {
    if (r.incrementApplied > 0.5 || r.blockedMonthly > 0.5) add("inc", "Check your increment: plan says basic " + money0(r.basic), r.blockedMonthly > 0.5 ? "Blocked by the " + r.grade + " maximum by " + money0(r.blockedMonthly) + "/month. Ask HR how that is compensated." : "Compare with your increment letter, then record the actual basic in the check-in.");
    if (r.promotionAmount > 0.5) add("promo", "Promotion to " + r.grade + " is planned this month", "If it didn't happen, move or remove it in the plan so the projection stays honest.");
    if (r.bonus > 0.5) add("bonus", "Bonus expected ≈ " + money0(r.bonus) + ": save " + money0(r.bonus * P.pctBonus) + " of it", "That's the " + Math.round(P.pctBonus * 100) + "% of bonus your plan saves. Do it the day it lands.");
    if (r.aws > 0.5) add("aws", "AWS expected ≈ " + money0(r.aws) + ": save " + money0(r.aws * P.pctBonus), "Same " + Math.round(P.pctBonus * 100) + "% rule as the bonus.");
    if (r.lump > 0.5) add("lump", "Ceiling lump sum expected ≈ " + money0(r.lump) + ": save " + money0(r.lump * P.pctLump), "Only if HR has confirmed this payment exists.");
    if (r.events.some(e => e.startsWith("FD matured"))) add("fd", "A fixed deposit matures this month", "Compare rates before it auto-renews. The plan assumes " + (P.fd.renewRate * 100).toFixed(2) + "% on renewal.");
    if (prev && r.ssbFace > prev.ssbFace + 1) add("ssb", "Apply for this month's SSB: " + money0(r.ssbFace - prev.ssbFace), "Applications usually close around the 26th. Check the MAS issue's rates first.");
    if (r.events.some(e => e.startsWith("FD placed"))) add("fdnew", "Place a fixed deposit: about " + money0((r.fdPrincipal - (prev ? prev.fdPrincipal : 0))), "Your FD savings have reached the minimum placement.");
    if (r.shortfall > 0.5) add("short", "The plan can't fully fund savings this month", "Short by " + money0(r.shortfall) + ". Cut expenses or lower the saving target.");
    if (r.events.some(e => e.startsWith("Age 55"))) add("age55", "Age 55: your Retirement Account is formed", "Check CPF's letter on what you can withdraw before deciding anything.");
  }
  const mo = +ym.slice(5);
  if (mo === 1) add("jan", "Yearly refresh of official figures", "CPF interest rates, OW ceiling, BHS/FRS and the latest SSB rates. Update the plan if any changed.");
  if (mo === 12) add("dec", "Decide on CPF cash top-ups before 31 Dec", "Only once your emergency fund is covered. Money in CPF is locked up for decades.");
  F().custom.filter(t => t.ym === ym).forEach(t => out.push({ id: t.id, text: t.text, sub: t.from === "ai" ? "Suggested in Ask" : "", kind: "custom", done: !!((F().done[ym] || {})[t.id]) }));
  return out;
}
export function setDone(ym, id, v) { const d = F().done; d[ym] = d[ym] || {}; if (v) d[ym][id] = true; else delete d[ym][id]; }

/* ── text for the AI (Ask) and for pasting into Claude ── */
export function futureContext(full) {
  const L = [], c = cfg(), b = baseline(), a = anchored();
  if (!b.res) return "FUTURE PLAN: could not be calculated (" + b.err + ").";
  const now = ymOf(), ages = E.ageAtStart(E.parseDate(c.profile.birthDate), E.parseYM(now));
  L.push("LONG-TERM PLAN (salary, CPF, savings to age " + c.profile.endAge + "). Figures in S$. Plan assumptions are the user's own and may be wrong; say so when it matters.");
  L.push("Birth date " + c.profile.birthDate + (F().setup.birth ? "" : " (PLACEHOLDER, not confirmed)") + "; age now " + ages + ". Grade now " + (rowAt(b.res, now) || b.res.months[0]).grade + "." + (F().setup.start ? "" : " The plan still starts from default balances, not the user's real ones, so check-in gaps may be misleading."));
  L.push("Assumptions: increment " + (c.salary.incRate * 100).toFixed(1) + "% each " + MON[c.salary.incMonth - 1] + "; bonus " + c.bonus.months + " months paid " + MON[c.bonus.payMonth - 1] + (c.bonus.awsEnabled ? "; AWS " + c.bonus.awsMonths + " month" : "") + "; ceiling lump sum " + c.salary.lumpSum.policy + "; living expenses " + money0(c.expenses.monthly) + "/month; saving " + money0(c.savings.fixedMonthly) + "/month + " + Math.round(c.savings.pctBonus * 100) + "% of bonus/AWS; allocation cash " + Math.round(c.savings.alloc.cash * 100) + "% FD " + Math.round(c.savings.alloc.fd * 100) + "% SSB " + Math.round(c.savings.alloc.ssb * 100) + "% bond fund " + Math.round(c.savings.alloc.fund * 100) + "%.");
  const end55 = res => { const r = res.age55 ? rowAt(res, res.age55.month) : res.months[res.months.length - 1]; return r ? r.label + ": total " + money0(r.totalAssets) + " (CPF " + money0(r.cpfTotal) + ", savings " + money0(r.portfolioValue) + ")" : "-"; };
  L.push("Original plan at 55 → " + end55(b.res) + ".");
  if (a.from && a.res) L.push("Re-run from actual check-in " + a.from + " → " + end55(a.res) + ".");
  const cis = checkins().slice(-6);
  if (cis.length) {
    L.push("CHECK-INS vs PLAN (month | actual total | plan total | gap | basic actual/plan | employee CPF actual/plan | spent actual/plan | saved actual/plan):");
    for (const ci of cis) { const k = compare(ci); if (!k) continue; L.push("- " + ci.ym + " | " + money0(D(k.actual.total)) + " | " + money0(D(k.plan.total)) + " | " + (k.gap >= 0 ? "+" : "-") + money0(Math.abs(D(k.gap))) + " (" + k.status + ") | " + money0(D(ci.basic)) + "/" + money0(D(k.plan.basic)) + " | " + money0(D(ci.empCPF)) + "/" + money0(D(k.plan.empCPF)) + " | " + money0(D(ci.spent)) + "/" + money0(D(k.plan.spent)) + " | " + money0(D(ci.saved)) + "/" + money0(D(k.plan.saved)) + (ci.note ? " | note: " + ci.note.slice(0, 120) : "")); }
  } else L.push("No check-ins recorded yet, so actual progress is unknown.");
  for (const ym of [now, ymShift(now, 1)]) {
    const acts = actionsFor(ym);
    L.push("ACTIONS " + ym + ": " + acts.map(x => (x.done ? "[done] " : "[open] ") + x.text).join("; ") + ".");
  }
  const left = setupLeft();
  if (left.length) L.push("SETUP STILL OPEN: " + left.map(t => t.text).join("; ") + ".");
  const upcoming = (a.res || b.res).milestones.filter(m => m.ym >= now).slice(0, 6);
  if (upcoming.length) L.push("UPCOMING MILESTONES: " + upcoming.map(m => m.ym + " " + m.text).join("; ") + ".");
  if (full) {
    L.push("YEARLY PROJECTION (year | age | grade | gross cash | employee CPF | CPF total | savings | total):");
    for (const y of (a.res || b.res).years) L.push("- " + y.year + " | " + y.ageEnd + " | " + y.grade + " | " + money0(y.gross) + " | " + money0(y.employeeCPF) + " | " + money0(y.cpfTotal) + " | " + money0(y.portfolioValue) + " | " + money0(y.totalAssets));
    L.push("Official CPF figures verified " + E.VERIFIED_ON + "; FRS after 2027 and BHS after 2026 are projections.");
  }
  return L.join("\n");
}

/** Re-base the plan on the earliest check-in: its month, pay and balances become the plan's starting point. */
export function startFromCheckin() {
  const first = checkins()[0];
  if (!first) return false;
  const c = E.clone(cfg()), base = baseline().res, row = base && rowAt(base, first.ym);
  c.profile.startYM = first.ym;
  if (first.basic > 0) c.salary.startBasic = D(first.basic);
  if (row) c.salary.startGrade = row.grade;
  c.cpf.startOA = D(first.oa); c.cpf.startSA = D(first.sa + first.ra); c.cpf.startMA = D(first.ma);
  c.savings.startCash = D(ciSavings(first));
  E.simulate(c);
  F().cfg = c; F().setup.start = true;
  return true;
}

/** Change the plan's fixed monthly saving: before/after at 55 (dollars). */
export function savingWhatIf(monthlyDollars) {
  const c = E.clone(cfg()); c.savings.fixedMonthly = monthlyDollars;
  const r1 = baseline().res, r2 = run(c).res;
  const at = res => res ? (res.age55 ? rowAt(res, res.age55.month) : res.months[res.months.length - 1]) : null;
  const a = at(r1), b2 = at(r2);
  return { before: a ? a.totalAssets : 0, after: b2 ? b2.totalAssets : 0, shortBefore: r1 ? r1.months.filter(m => m.shortfall > 0.5).length : 0, shortAfter: r2 ? r2.months.filter(m => m.shortfall > 0.5).length : 0, label: a ? a.label : "" };
}
