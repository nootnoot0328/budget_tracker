/* Budget Margin 4 — plan changes proposed by the chat. Each one is validated, its effect is
   recomputed on the device (the model's own claims about the effect are ignored), and nothing
   changes until the user taps Apply. Apply returns an undo function. */
import { S, save } from "./state.js";
import { money, pIso, today } from "./util.js";
import { debtForecast, monthNameFromNow, durationText, catName } from "./calc.js";
import { aiCents, catByName, aiDate } from "./ai.js";
import { ymOf, ymShift, ymLabel, savingWhatIf, cfg as futureCfg, ENGINE } from "./future/plan.js";

const dollars = v => aiCents(v); // S$ number → cents, 0 if invalid

export function validateProposal(p) {
  if (!p || typeof p !== "object") return null;
  if (p.type === "debt_plan") {
    const b = dollars(p.monthly_budget), strat = p.strategy === "snowball" ? "snowball" : p.strategy === "avalanche" ? "avalanche" : S.debtPlan.strategy || "avalanche";
    if (!b || !S.debts.some(d => (d.bal || 0) > 0)) return null;
    return { type: "debt_plan", monthlyBudget: b, strategy: strat };
  }
  if (p.type === "envelope_cap") {
    const cid = catByName(p.envelope), zero = p.cap === 0 || p.cap === "0", cap = zero ? 0 : dollars(p.cap);
    if (!cid || (!zero && !cap)) return null;
    return { type: "envelope_cap", cid, cap };
  }
  if (p.type === "daily_cap") {
    const zero = p.amount === 0 || p.amount === "0", amt = zero ? 0 : dollars(p.amount);
    if (!zero && !amt) return null;
    return { type: "daily_cap", amount: amt };
  }
  if (p.type === "goal") {
    const name = String(p.name || "").trim().slice(0, 40), target = dollars(p.target);
    if (!name || !target) return null;
    const per = dollars(p.per_period), date = aiDate(p.target_date) || (/^\d{4}-\d{2}-\d{2}$/.test(String(p.target_date || "")) && pIso(p.target_date) > today() ? p.target_date : "");
    return { type: "goal", name, target, per, date };
  }
  if (p.type === "future_task") {
    const m = String(p.month || "").match(/^(\d{4})-(\d{2})$/), text = String(p.text || "").replace(/\s+/g, " ").trim().slice(0, 140);
    const now = ymOf();
    if (!m || +m[2] < 1 || +m[2] > 12 || !text || p.month < ymShift(now, -1) || p.month > ymShift(now, 24)) return null;
    return { type: "future_task", month: p.month, text };
  }
  if (p.type === "future_saving") {
    const zero = p.monthly === 0 || p.monthly === "0", amt = zero ? 0 : dollars(p.monthly);
    if (!zero && !amt) return null;
    return { type: "future_saving", monthly: amt };
  }
  return null;
}

/* {title, rows:[[label, before, after]], note} — all computed here */
export function describeProposal(v) {
  if (v.type === "debt_plan") {
    const now = debtForecast(), next = debtForecast({ strategy: v.strategy, monthlyBudget: v.monthlyBudget });
    const fmtF = x => (x.months == null ? "no forecast" : monthNameFromNow(x.months) + " · " + durationText(x.months));
    const saved = now.months != null && next.months != null ? now.interest - next.interest : null;
    return {
      title: "New debt plan",
      rows: [
        ["Monthly debt budget", S.debtPlan.monthlyBudget ? money(S.debtPlan.monthlyBudget, false) : "minimums only", money(v.monthlyBudget, false)],
        ["Order", cap(S.debtPlan.strategy || "avalanche"), cap(v.strategy)],
        ["Debt-free", fmtF(now), fmtF(next)],
        ["Projected interest", now.months == null ? "—" : money(now.interest, false), next.months == null ? "—" : money(next.interest, false)],
      ],
      note: next.warning || (saved > 0 ? "Saves about " + money(saved, false) + " in interest." : saved < 0 ? "Costs about " + money(-saved, false) + " more in interest." : ""),
    };
  }
  if (v.type === "envelope_cap") {
    const c = S.cats.find(x => x.id === v.cid);
    const total = S.cats.reduce((s, x) => s + (x.id === v.cid ? v.cap : x.cap || 0), 0), before = S.cats.reduce((s, x) => s + (x.cap || 0), 0);
    return { title: "Change " + catName(v.cid) + " cap", rows: [[catName(v.cid) + " per period", money(c.cap || 0, false), money(v.cap, false)], ["All envelopes", money(before, false), money(total, false)]], note: "" };
  }
  if (v.type === "daily_cap") return { title: v.amount ? "Set a daily limit" : "Remove the daily limit", rows: [["Daily limit", S.dailyCap ? money(S.dailyCap) : "auto", v.amount ? money(v.amount) : "auto"]], note: "" };
  if (v.type === "goal") {
    const ex = S.goals.find(g => g.name.toLowerCase() === v.name.toLowerCase());
    return {
      title: ex ? "Update goal: " + ex.name : "New goal: " + v.name,
      rows: [["Target", ex ? money(ex.target || 0, false) : "—", money(v.target, false)], ["Reserve each period", ex ? money(ex.periodContribution || 0, false) : "—", money(v.per, false)], ["Target date", ex && ex.targetDate || "—", v.date || "—"]],
      note: "",
    };
  }
  if (v.type === "future_task") return { title: "Add a plan action", rows: [["Month", "—", ymLabel(v.month)], ["Action", "—", v.text]], note: "Shows in Plan › Future for that month." };
  if (v.type === "future_saving") {
    const w = savingWhatIf(v.monthly / 100);
    return {
      title: "Change monthly saving",
      rows: [["Saved each month", money(Math.round(futureCfg().savings.fixedMonthly * 100), false), money(v.monthly, false)], ["Total by " + w.label, money(Math.round(w.before * 100), false), money(Math.round(w.after * 100), false)], ["Months the plan can't fund", String(w.shortBefore), String(w.shortAfter)]],
      note: "Recomputed on your phone from the long-term plan.",
    };
  }
  return { title: "Change", rows: [], note: "" };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function applyProposal(v) {
  let undo = () => { };
  if (v.type === "debt_plan") {
    const before = { ...S.debtPlan };
    S.debtPlan.monthlyBudget = v.monthlyBudget; S.debtPlan.strategy = v.strategy;
    undo = () => { S.debtPlan = before; save(); };
  } else if (v.type === "envelope_cap") {
    const c = S.cats.find(x => x.id === v.cid), before = c.cap || 0;
    c.cap = v.cap; undo = () => { c.cap = before; save(); };
  } else if (v.type === "daily_cap") {
    const before = S.dailyCap || 0; S.dailyCap = v.amount; undo = () => { S.dailyCap = before; save(); };
  } else if (v.type === "goal") {
    const ex = S.goals.find(g => g.name.toLowerCase() === v.name.toLowerCase());
    if (ex) {
      const before = { target: ex.target, periodContribution: ex.periodContribution, targetDate: ex.targetDate };
      ex.target = v.target; ex.periodContribution = v.per; if (v.date) ex.targetDate = v.date;
      undo = () => { Object.assign(ex, before); save(); };
    } else {
      const g = { id: "g" + Date.now(), name: v.name, target: v.target, saved: 0, targetDate: v.date || "", periodContribution: v.per, active: true };
      S.goals.push(g); undo = () => { S.goals = S.goals.filter(x => x.id !== g.id); save(); };
    }
  }
  if (v.type === "future_task") {
    const t = { id: "ft" + Date.now().toString(36), ym: v.month, text: v.text, from: "ai" };
    S.future.custom.push(t); undo = () => { S.future.custom = S.future.custom.filter(x => x.id !== t.id); save(); };
  } else if (v.type === "future_saving") {
    const before = S.future.cfg, next = ENGINE.clone(futureCfg()); next.savings.fixedMonthly = v.monthly / 100;
    S.future.cfg = next; undo = () => { S.future.cfg = before; save(); };
  }
  save();
  return undo;
}
