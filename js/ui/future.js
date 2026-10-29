/* Budget Margin — Plan › Future: monthly check-ins against the long-term salary/CPF/savings plan,
   this month's actions, and the plan's assumptions. Numbers come from js/future/plan.js. */
import { h, icon, money, toCents, haptic, MO } from "../util.js";
import { S, save } from "../state.js";
import * as C from "../calc.js";
import * as FP from "../future/plan.js";
import { openSheet, closeSheet, toast, confirmSheet, field, options, moneyInput, toggleRow, val, checked } from "./core.js";

const E = FP.ENGINE;
let go = () => { };
let viewYM = FP.ymOf();
export const initFuture = nav => (go = nav);

const sec = (title, action, ...kids) => h("div.section", h("div.section-head", h("h2", title), action), ...kids);
const link = (label, fn) => h("button.link", { type: "button", onclick: fn }, label);
const D = c => (c || 0) / 100, Cn = d => Math.round((d || 0) * 100);
const m0 = c => money(c, false);
const signed = c => (c >= 0 ? "+" : "-") + money(Math.abs(c), false);
const tone = s => (s === "ahead" || s === "on track" ? "var(--jade)" : s === "a little behind" ? "var(--amber)" : "var(--coral)");

export function renderFuture(body) {
  const b = FP.baseline();
  if (!b.res) { body.appendChild(h("div.card", h("p.note.warn", h("b", "The plan couldn't be calculated"), b.err + ". Check the dates in the plan's assumptions."), h("button.btn.sm", { type: "button", style: { marginTop: "10px" }, onclick: () => openAssumptions("profile") }, "Edit assumptions"))); return; }
  const a = FP.anchored();
  body.append(statusCard(b, a), monthCard(), setupCard(), checkinsCard(), planCard(b, a));
}

/* ── status: latest check-in vs plan, and where you're heading ── */
function statusCard(b, a) {
  const last = FP.latestCheckin(), card = h("div.card");
  if (!last) {
    card.append(h("div.empty", h("b", "Start tracking your long-term plan"), "Each month, record your payslip, CPF balances and savings. The projection then re-runs from your real numbers and this month's actions update."),
      h("button.btn", { type: "button", onclick: () => openCheckin(FP.ymOf()) }, "Do your first check-in"));
  } else {
    const k = FP.compare(last);
    card.append(h("div.kv",
      h("div", h("span", "Total · " + FP.ymLabel(last.ym)), h("b.tab", m0(FP.ciTotal(last)))),
      h("div", h("span", "Versus plan"), k ? h("b.tab", { style: { color: tone(k.status) } }, signed(k.gap) + " · " + k.status) : h("b", "—")),
      h("div", h("span", "CPF (actual / plan)"), h("b.tab", m0(FP.ciCPF(last)) + (k ? " / " + m0(k.plan.cpf) : ""))),
      h("div", h("span", "Savings (actual / plan)"), h("b.tab", m0(FP.ciSavings(last)) + (k ? " / " + m0(k.plan.savings) : "")))));
  }
  const end = res => res && (res.age55 ? FP.rowAt(res, res.age55.month) : res.months[res.months.length - 1]);
  const eb = end(b.res), ea = a.from ? end(a.res) : null;
  if (eb) card.appendChild(h("p.hint", { style: { marginBottom: 0 } },
    ea ? ["Heading for ", h("b", m0(Cn(ea.totalAssets))), " by " + ea.label + " from your actual figures (original plan " + m0(Cn(eb.totalAssets)) + "). "] : ["Plan: ", h("b", m0(Cn(eb.totalAssets))), " by " + eb.label + ". "],
    "Nominal dollars; CPF is restricted money, not cash."));
  card.appendChild(trendChart(b));
  if (!FP.hasOwnPlan()) card.appendChild(h("p.note.warn", { style: { marginTop: "10px" } }, h("b", "Using the default plan"), "Every figure is an assumption until you set your own. Start with the Setup list below."));
  return h("div", { style: { marginTop: "4px" } }, card);
}

/* plan total (line) vs check-ins (dots), from the plan start to a year past today */
function trendChart(b) {
  const ns = "http://www.w3.org/2000/svg", svg = (t, at) => { const e = document.createElementNS(ns, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const now = FP.ymOf(), cis = FP.checkins();
  const lastYM = [FP.ymShift(now, 12), cis.length ? FP.ymShift(cis[cis.length - 1].ym, 6) : now].sort().pop();
  const rows = b.res.months.filter(r => r.ym <= lastYM).slice(0, 72);
  if (rows.length < 2) return h("div");
  const pts = rows.map(r => FP.postedCPF(r) + r.portfolioValue);
  const acts = cis.map(c => ({ i: rows.findIndex(r => r.ym === c.ym), v: D(FP.ciTotal(c)) })).filter(x => x.i >= 0);
  const W = 320, H = 110, pad = 6, max = Math.max(1, ...pts, ...acts.map(x => x.v)) * 1.08;
  const x = i => pad + (W - 2 * pad) * i / (rows.length - 1), y = v => H - (v / max) * (H - 8);
  const s = svg("svg", { viewBox: "0 0 " + W + " " + (H + 18), class: "chart", role: "img", "aria-label": "Planned total assets with your check-ins" });
  [0.5, 1].forEach(f => s.appendChild(svg("line", { x1: pad, x2: W - pad, y1: y(max * f / 1.08), y2: y(max * f / 1.08), class: "grid" })));
  s.appendChild(svg("path", { d: pts.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join(""), fill: "none", stroke: "var(--blue)", "stroke-width": 2, "stroke-dasharray": "4 3" }));
  const ti = rows.findIndex(r => r.ym === now);
  if (ti >= 0) s.appendChild(svg("line", { x1: x(ti), x2: x(ti), y1: 4, y2: H, stroke: "var(--faint)", "stroke-width": 1 }));
  acts.forEach(p => s.appendChild(svg("circle", { cx: x(p.i), cy: y(p.v), r: 4.5, fill: "var(--jade)", stroke: "var(--panel)", "stroke-width": 2 })));
  [0, rows.length - 1].forEach(i => { const t = svg("text", { x: x(i), y: H + 14, "text-anchor": i ? "end" : "start", class: "lbl" }); t.textContent = rows[i].label; s.appendChild(t); });
  return h("div", { style: { marginTop: "12px" } }, s, h("div.legend-inline.small.dim", { style: { marginTop: "4px" } }, "Dashed: plan · Dots: your check-ins · Line: today"));
}

/* ── this month's actions ── */
function monthCard() {
  const acts = FP.actionsFor(viewYM), open = acts.filter(x => !x.done).length;
  const nav = h("div.btn-row", { style: { alignItems: "center", gap: "4px" } },
    h("button.icon-btn", { type: "button", "aria-label": "Previous month", html: icon("chevL"), onclick: () => { viewYM = FP.ymShift(viewYM, -1); rerender(); } }),
    h("b", { style: { minWidth: "84px", textAlign: "center" } }, FP.ymLabel(viewYM)),
    h("button.icon-btn", { type: "button", "aria-label": "Next month", html: icon("chevR"), onclick: () => { viewYM = FP.ymShift(viewYM, 1); rerender(); } }));
  const list = h("div.card.flush.rows");
  acts.forEach(t => list.appendChild(actionRow(t)));
  list.appendChild(h("div.row", { style: { minHeight: 0 } },
    h("button.link", { type: "button", onclick: () => addTask(viewYM) }, "+ Add your own action"),
    h("span", { style: { flex: 1 } }),
    h("button.link", { type: "button", onclick: () => go("ask", "Review my " + FP.ymLabel(viewYM) + " for my long-term plan. What are the three most important things to do, and am I on track?") }, "Ask for a review")));
  return sec(viewYM === FP.ymOf() ? "This month" + (open ? " · " + open + " open" : " · all done") : "Actions", nav, list);
}
function actionRow(t) {
  if (t.kind === "checkin") return h("button.row", { type: "button", onclick: () => openCheckin(viewYM) },
    h("span", { style: { color: t.done ? "var(--jade)" : "var(--amber)" }, html: icon(t.done ? "check" : "clip") }),
    h("div.txt", h("div.t1", t.done ? "Check-in recorded" : t.text), h("div.t2", t.done ? "Tap to review or correct" : t.sub)), h("span.chev", { html: icon("chevR") }));
  const id = "act-" + viewYM + "-" + t.id;
  return h("label.row", { for: id, style: { alignItems: "flex-start" } },
    h("input", { id, type: "checkbox", checked: t.done, style: { marginTop: "2px" }, onchange: e => { FP.setDone(viewYM, t.id, e.target.checked); haptic(5); save(); } }),
    h("div.txt", h("div.t1", { style: { whiteSpace: "normal", textDecoration: t.done ? "line-through" : "", color: t.done ? "var(--dim)" : "" } }, t.text), t.sub ? h("div.t2", { style: { whiteSpace: "normal" } }, t.sub) : null),
    t.kind === "custom" ? h("button.icon-btn", { type: "button", "aria-label": "Remove action", html: icon("trash"), onclick: e => { e.preventDefault(); S.future.custom = S.future.custom.filter(x => x.id !== t.id); save(); } }) : null);
}
function addTask(ym) {
  openSheet("New action · " + FP.ymLabel(ym),
    field("What to do", h("input", { id: "ftT", placeholder: "e.g. Top up MediSave by S$500", autocomplete: "off" })),
    h("button.btn", { type: "button", onclick: () => { const t = val("ftT").trim(); if (!t) { toast("Describe the action"); return; } S.future.custom.push({ id: "ft" + Date.now().toString(36), ym, text: t.slice(0, 140), from: "you" }); closeSheet(); save(); toast("Action added"); } }, "Add"));
}

/* ── setup checklist ── */
function setupCard() {
  const left = FP.setupLeft();
  if (!left.length) return h("div");
  const list = h("div.card.flush.rows");
  left.forEach(t => list.appendChild(h("div.row", { style: { alignItems: "flex-start" } },
    h("input", { id: "su-" + t.id, type: "checkbox", style: { marginTop: "2px" }, "aria-label": "Mark done: " + t.text, onchange: () => { S.future.setup[t.id] = true; haptic(5); save(); toast("Marked done", () => { delete S.future.setup[t.id]; save(); }); } }),
    h("div.txt", h("div.t1", { style: { whiteSpace: "normal" } }, t.text), h("div.t2", { style: { whiteSpace: "normal" } }, t.why)),
    t.action === "start" ? h("button.btn.sm.soft", { type: "button", onclick: () => {
      if (!FP.latestCheckin()) { openCheckin(FP.ymOf()); return; }
      const before = S.future.cfg;
      try { FP.startFromCheckin(); } catch (e) { toast("Couldn't use that check-in: " + String(e.message || e).slice(0, 80)); return; }
      save(); toast("Plan now starts from " + FP.ymLabel(FP.checkins()[0].ym), () => { S.future.cfg = before; delete S.future.setup.start; save(); });
    } }, FP.latestCheckin() ? "Use first check-in" : "Check in") : null,
    t.edit ? h("button.btn.sm.soft", { type: "button", onclick: () => openAssumptions(t.edit) }, "Edit") : null)));
  return sec("Setup · " + left.length + " left", null, list);
}

/* ── check-ins ── */
function checkinsCard() {
  const cis = FP.checkins().reverse().slice(0, 12), list = h("div.card.flush.rows");
  cis.forEach(ci => { const k = FP.compare(ci); list.appendChild(h("button.row", { type: "button", onclick: () => openCheckin(ci.ym) },
    h("div.txt", h("div.t1", FP.ymLabel(ci.ym)), h("div.t2", "CPF " + m0(FP.ciCPF(ci)) + " · savings " + m0(FP.ciSavings(ci)) + (ci.note ? " · " + ci.note : ""))),
    h("div.val.tab", m0(FP.ciTotal(ci)), k ? h("small", { style: { color: tone(k.status) } }, signed(k.gap) + " vs plan") : null))); });
  if (!cis.length) list.appendChild(h("div.empty", "No check-ins yet."));
  return sec("Check-ins", link("+ Check-in", () => openCheckin(FP.ymOf())), list);
}

export function openCheckin(ym) {
  const ex = FP.checkinFor(ym), ci = ex ? { ...ex } : FP.blankCheckin(ym);
  const prevCi = FP.checkins().filter(x => x.ym < ym).pop() || null;
  const planRow = FP.rowAt(FP.baseline().res, ym);
  if (!ex) { // the app already knows what you spent that calendar month
    const y = +ym.slice(0, 4), m = +ym.slice(5);
    ci.spent = C.spent(new Date(y, m - 1, 1), new Date(y, m, 1));
  }
  const hintFor = k => {
    if (planRow) {
      const pv = { basic: planRow.basic, allowance: planRow.allowance, bonus: planRow.bonus + planRow.aws + planRow.lump, empCPF: planRow.employeeCPF, erCPF: planRow.employerCPF, spent: planRow.expenses, saved: planRow.saved }[k];
      if (pv != null) return "Plan " + m0(Cn(pv));
    }
    if (prevCi && prevCi[k]) return "Last " + m0(prevCi[k]);
    return "";
  };
  const groups = [["pay", "From your payslip"], ["cpf", "From the CPF app"], ["sav", "Savings outside CPF"], ["month", "This month"]];
  const monthIn = h("input", { id: "ciYM", type: "month", value: ym });
  openSheet(ex ? "Check-in · " + FP.ymLabel(ym) : "New check-in",
    field("Month", monthIn),
    groups.map(([g, title]) => h("div", h("div.label", { style: { marginTop: "6px" } }, title),
      h("div.two", FP.FIELDS.filter(f => f[2] === g && !(f[0] === "ra" && !(ex && ex.ra) && !(planRow && planRow.ra > 0))).map(([k, label]) => {
        const hint = hintFor(k);
        return field(label, moneyInput("ci-" + k, ci[k], hint ? hint.replace(/^Plan |^Last /, "") : "0.00"), hint || null);
      })))),
    h("p.hint", "Plan figures are shown under each box. Enter what actually happened. Spending is filled in from what you logged in Budget Margin; correct it if you spent outside the app."),
    field("Note", h("input", { id: "ciNote", value: ci.note || "", placeholder: "Anything unusual this month", autocomplete: "off" })),
    h("button.btn", { type: "button", onclick: () => {
      const m = val("ciYM"); if (!/^\d{4}-\d{2}$/.test(m)) { toast("Pick a month"); return; }
      const out = { ym: m, note: val("ciNote").trim().slice(0, 200), at: Date.now() };
      FP.FIELDS.forEach(([k]) => { const e = document.getElementById("ci-" + k); out[k] = e ? toCents(e.value) : 0; });
      if (!FP.ciTotal(out) && !out.basic) { toast("Enter at least your pay or a balance"); return; }
      const before = S.future.checkins.slice();
      S.future.checkins = S.future.checkins.filter(x => x.ym !== m && x.ym !== ym).concat([out]);
      closeSheet(); save();
      const k = FP.compare(out);
      toast(k ? FP.ymLabel(m) + ": " + signed(k.gap) + " vs plan" : "Check-in saved", () => { S.future.checkins = before; save(); });
    } }, ex ? "Save changes" : "Save check-in"),
    ex ? h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmSheet("Delete the " + FP.ymLabel(ym) + " check-in?", null, "Delete", true)) { S.future.checkins = S.future.checkins.filter(x => x.ym !== ym); save(); toast("Check-in deleted"); } } }, "Delete check-in") : null);
}

/* ── plan: assumptions, sharing with Claude ── */
function planCard(b, a) {
  const c = FP.cfg(), list = h("div.card.flush.rows");
  const row = (t1, t2, fn) => h("button.row", { type: "button", onclick: fn }, h("div.txt", h("div.t1", t1), h("div.t2", t2)), h("span.chev", { html: icon("chevR") }));
  list.append(
    row("Profile", "Born " + c.profile.birthDate + " · to age " + c.profile.endAge, () => openAssumptions("profile")),
    row("Salary and promotions", c.salary.startGrade + " · " + m0(Cn(c.salary.startBasic)) + " · +" + (c.salary.incRate * 100).toFixed(1) + "% each " + MO[c.salary.incMonth - 1], () => openAssumptions("salary")),
    row("Bonus, AWS and lump sum", c.bonus.months + " mo bonus in " + MO[c.bonus.payMonth - 1] + (c.bonus.awsEnabled ? " · AWS " + c.bonus.awsMonths + " mo" : "") + " · lump sum " + ({ blocked12: "blocked × 12", custom: "custom", none: "none" })[c.salary.lumpSum.policy], () => openAssumptions("bonus")),
    row("CPF", (c.cpf.status === "pr" ? "PR" : "Citizen") + " · OA " + (c.cpf.oaRate * 100).toFixed(1) + "% · SA/MA " + (c.cpf.smraRate * 100).toFixed(1) + "%", () => openAssumptions("cpf")),
    row("Spending and saving", m0(Cn(c.expenses.monthly)) + " spend · " + m0(Cn(c.savings.fixedMonthly)) + " saved/month · " + Math.round(c.savings.pctBonus * 100) + "% of bonus", () => openAssumptions("savings")),
  );
  const tools = h("div.card",
    toggleRow("fRebase", S.future.rebase, "Project from my latest check-in", "Re-runs the plan from your actual pay and balances. Check-ins are always compared with the original plan."),
    h("div.btn-row", { style: { marginTop: "8px", flexWrap: "wrap" } },
      h("button.btn.sm", { type: "button", onclick: () => copy(FP.futureContext(true), "Summary copied. Paste it into Claude to discuss your plan.") }, "Copy summary for Claude"),
      h("button.btn.sm.soft", { type: "button", onclick: () => copy(JSON.stringify(c, null, 1), "Plan copied as JSON") }, "Copy plan JSON"),
      h("button.btn.sm.soft", { type: "button", onclick: importPlan }, "Import plan")),
    h("p.hint", "Import accepts the scenario JSON from the Salary, CPF & Savings Projector, so you can model there and track here."));
  tools.querySelector("#fRebase").addEventListener("change", e => { S.future.rebase = e.target.checked; save(); });
  return h("div", sec("Plan assumptions", FP.hasOwnPlan() ? link("Reset", resetPlan) : null, list), sec("Plan tools", null, tools));
}
function copy(text, msg) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(msg), () => showText(text));
  else showText(text);
}
function showText(text) {
  openSheet("Copy this", h("textarea", { id: "fCopy", rows: 12, readOnly: true, value: text }), h("p.hint", "Select all and copy."));
}
async function resetPlan() {
  if (!(await confirmSheet("Reset the plan to defaults?", "Your check-ins and actions stay. Only the assumptions are reset.", "Reset", true))) return;
  const before = S.future.cfg; S.future.cfg = null; save(); toast("Plan reset", () => { S.future.cfg = before; save(); });
}
function importPlan() {
  openSheet("Import plan",
    field("Scenario JSON", h("textarea", { id: "fImp", rows: 10, placeholder: "Paste the scenario JSON here" })),
    h("button.btn", { type: "button", onclick: () => {
      try {
        const next = hydrate(JSON.parse(val("fImp")));
        E.simulate(next); // throws on bad dates
        const before = S.future.cfg; S.future.cfg = next; closeSheet(); save(); toast("Plan imported", () => { S.future.cfg = before; save(); });
      } catch (e) { toast("That isn't a valid plan: " + String(e.message || e).slice(0, 80)); }
    } }, "Import"));
}
/* fill in anything missing from an imported or older plan */
export function hydrate(x) {
  const deep = (a, b) => {
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (a && typeof a === "object") { const o = {}; for (const k of Object.keys(a)) o[k] = deep(a[k], b && b[k]); return o; }
    return b === undefined || b === null || typeof b !== typeof a ? a : b;
  };
  return deep(E.defaultConfig(), x);
}

/* ── assumption sheets ── */
const num = (id, v, step) => h("input", { id, type: "text", inputmode: "decimal", value: String(v), autocomplete: "off", step: step || "any" });
const pctIn = (id, frac) => num(id, +(frac * 100).toFixed(3));
const fnum = id => { const n = parseFloat(String(val(id)).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
const monthSel = (id, m) => h("select", { id }, options(MO.map((x, i) => ({ value: String(i + 1), label: x })), String(m)));

export function openAssumptions(section) {
  const c = E.clone(FP.cfg());
  const commit = (mutate, extra) => {
    try { mutate(c); E.simulate(c); } catch (e) { toast("Check the values: " + String(e.message || e).slice(0, 80)); return; }
    const before = S.future.cfg; S.future.cfg = c; if (extra) extra(); closeSheet(); save();
    toast("Plan updated", () => { S.future.cfg = before; save(); });
  };
  const saveBtn = fn => h("button.btn", { type: "button", style: { marginTop: "8px" }, onclick: () => commit(fn) }, "Save");
  if (section === "profile") return openSheet("Profile",
    field("Birth date", h("input", { id: "aBirth", type: "date", value: c.profile.birthDate }), "CPF rate bands change the month after a birthday; your RA forms in your 55th birthday month."),
    h("div.two", field("Plan starts", h("input", { id: "aStart", type: "month", value: c.profile.startYM })), field("Project to age", num("aEnd", c.profile.endAge))),
    field("Inflation (% a year)", pctIn("aInf", c.inflation)),
    saveBtn(x => { x.profile.birthDate = val("aBirth") || x.profile.birthDate; x.profile.startYM = val("aStart") || x.profile.startYM; x.profile.endAge = Math.max(32, Math.round(fnum("aEnd"))); x.inflation = fnum("aInf") / 100; S.future.setup.birth = true; }));
  if (section === "salary") {
    const grades = c.salary.grades.map(g => g.id);
    const promoBox = h("div");
    const drawPromos = () => promoBox.replaceChildren(...c.salary.promotions.map((p, i) => h("div.two", { style: { gridTemplateColumns: "1.2fr .8fr 1fr auto", alignItems: "end", marginBottom: "8px" } },
      field(i ? "" : "Month", h("input", { type: "month", value: p.ym, onchange: e => (p.ym = e.target.value || p.ym) })),
      field(i ? "" : "To", h("select", { onchange: e => (p.toGrade = e.target.value) }, options(grades, p.toGrade))),
      field(i ? "" : "Adds (S$)", h("input", { inputmode: "decimal", value: String(p.amount), onchange: e => (p.amount = parseFloat(e.target.value) || 0) })),
      h("button.icon-btn", { type: "button", "aria-label": "Remove promotion", style: { marginBottom: "12px" }, html: icon("trash"), onclick: () => { c.salary.promotions.splice(i, 1); drawPromos(); } }))),
      h("button.link", { type: "button", onclick: () => { c.salary.promotions.push({ id: "p" + Date.now(), ym: "2036-11", toGrade: grades[grades.length - 1], amount: 450 }); drawPromos(); } }, "+ Promotion"));
    drawPromos();
    return openSheet("Salary and promotions",
      h("div.two", field("Basic at plan start", moneyInput("aBasic", Cn(c.salary.startBasic))), field("Grade", h("select", { id: "aGrade" }, options(grades, c.salary.startGrade)))),
      h("div.two", field("Increment (% a year)", pctIn("aInc", c.salary.incRate)), field("Increment month", monthSel("aIncM", c.salary.incMonth))),
      field("First increment year", num("aIncY", c.salary.incFirstYear)),
      h("div.label", { style: { marginTop: "6px" } }, "Grade maximums (basic salary)"),
      h("div.two", c.salary.grades.map(g => field(g.id, moneyInput("aG-" + g.id, Cn(g.max))))),
      h("div.label", { style: { marginTop: "6px" } }, "Promotions"), promoBox,
      saveBtn(x => {
        x.salary.startBasic = D(toCents(val("aBasic"))); x.salary.startGrade = val("aGrade"); x.salary.incRate = fnum("aInc") / 100; x.salary.incMonth = +val("aIncM"); x.salary.incFirstYear = Math.round(fnum("aIncY"));
        x.salary.grades.forEach(g => { const v = toCents(val("aG-" + g.id)); if (v) g.max = D(v); });
        x.salary.promotions = c.salary.promotions;
      }));
  }
  if (section === "bonus") return openSheet("Bonus, AWS and lump sum",
    h("div.two", field("Bonus months", num("aBm", c.bonus.months)), field("Bonus paid in", monthSel("aBp", c.bonus.payMonth))),
    field("Bonus covers", h("select", { id: "aBr" }, options([{ value: "prior-calendar-year", label: "Previous calendar year" }, { value: "calendar-year", label: "Calendar year paid" }, { value: "trailing-12", label: "12 months to payment" }], c.bonus.reference))),
    toggleRow("aAws", c.bonus.awsEnabled, "AWS (13th month)"),
    h("div.two", field("AWS months", num("aAm", c.bonus.awsMonths)), field("AWS paid in", monthSel("aAp", c.bonus.awsPayMonth))),
    h("div.two", field("Employment start", h("input", { id: "aEmp", type: "month", value: c.bonus.employmentStart })), h("div", toggleRow("aPro", c.bonus.prorateFirstYear, "Prorate first year"))),
    field("Ceiling lump sum", h("select", { id: "aLp" }, options([{ value: "blocked12", label: "Blocked increment × 12" }, { value: "custom", label: "Custom yearly amount" }, { value: "none", label: "None" }], c.salary.lumpSum.policy)), "An assumed employer practice. Choose None unless HR has confirmed it."),
    h("div.two", field("Custom amount", moneyInput("aLc", Cn(c.salary.lumpSum.customAmount))), field("Paid in", monthSel("aLm", c.salary.lumpSum.payMonth))),
    saveBtn(x => {
      Object.assign(x.bonus, { months: fnum("aBm"), payMonth: +val("aBp"), reference: val("aBr"), awsEnabled: checked("aAws"), awsMonths: fnum("aAm"), awsPayMonth: +val("aAp"), employmentStart: val("aEmp") || x.bonus.employmentStart, prorateFirstYear: checked("aPro") });
      Object.assign(x.salary.lumpSum, { policy: val("aLp"), customAmount: D(toCents(val("aLc"))), payMonth: +val("aLm") });
    }));
  if (section === "cpf") return openSheet("CPF",
    h("div.two", field("Status", h("select", { id: "aSt" }, options([{ value: "citizen", label: "Citizen" }, { value: "pr", label: "PR" }], c.cpf.status))), field("PR granted", h("input", { id: "aPr", type: "month", value: c.cpf.prDate }))),
    h("div.label", { style: { marginTop: "6px" } }, "Balances at plan start"),
    h("div.two", field("OA", moneyInput("aOA", Cn(c.cpf.startOA))), field("SA", moneyInput("aSA", Cn(c.cpf.startSA)))),
    field("MediSave", moneyInput("aMA", Cn(c.cpf.startMA))),
    h("div.label", { style: { marginTop: "6px" } }, "Earned earlier in the start year (all employers)"),
    h("div.two", field("Ordinary wages for CPF", moneyInput("aPOW", Cn(c.cpf.preStartOW))), field("Total income", moneyInput("aPInc", Cn(c.tax.preStartIncome)))),
    field("Employee CPF already paid", moneyInput("aPCPF", Cn(c.cpf.preStartEmployeeCPF))),
    h("div.two", field("OA interest (%)", pctIn("aOAr", c.cpf.oaRate)), field("SA/MA/RA interest (%)", pctIn("aSMr", c.cpf.smraRate))),
    h("div.two", field("BHS growth (%/yr)", pctIn("aBhs", c.cpf.bhsGrowth)), field("FRS growth after 2027", pctIn("aFrs", c.cpf.frsGrowth))),
    h("p.hint", "Contribution rates, allocations and ceilings are the official 2026–2027 tables, verified " + E.VERIFIED_ON + "."),
    saveBtn(x => {
      Object.assign(x.cpf, { status: val("aSt"), prDate: val("aPr") || x.cpf.prDate, startOA: D(toCents(val("aOA"))), startSA: D(toCents(val("aSA"))), startMA: D(toCents(val("aMA"))), preStartOW: D(toCents(val("aPOW"))), preStartEmployeeCPF: D(toCents(val("aPCPF"))), oaRate: fnum("aOAr") / 100, smraRate: fnum("aSMr") / 100, bhsGrowth: fnum("aBhs") / 100, frsGrowth: fnum("aFrs") / 100 });
      x.tax.preStartIncome = D(toCents(val("aPInc"))); S.future.setup.jan2026 = true;
    }));
  if (section === "savings") return openSheet("Spending and saving",
    h("div.two", field("Living expenses / month", moneyInput("aExp", Cn(c.expenses.monthly))), h("div", toggleRow("aExpI", c.expenses.inflationLinked, "Rises with inflation"))),
    h("div.two", field("Saved each month", moneyInput("aFix", Cn(c.savings.fixedMonthly))), field("% of bonus/AWS saved", pctIn("aPb", c.savings.pctBonus))),
    h("div.two", field("% of lump sum saved", pctIn("aPl", c.savings.pctLump)), field("Savings at plan start", moneyInput("aSC", Cn(c.savings.startCash)))),
    h("div.label", { style: { marginTop: "6px" } }, "Where savings go (%)"),
    h("div.two", field("Cash", pctIn("aAc", c.savings.alloc.cash)), field("Fixed deposits", pctIn("aAf", c.savings.alloc.fd))),
    h("div.two", field("Savings Bonds", pctIn("aAs", c.savings.alloc.ssb)), field("Bond fund", pctIn("aAb", c.savings.alloc.fund))),
    h("div.two", field("Cash interest (%)", pctIn("aCr", c.savings.cash.rate)), field("FD rate now (%)", pctIn("aFr", c.savings.fd.rate))),
    h("div.two", field("FD rate on renewal (%)", pctIn("aFn", c.savings.fd.renewRate)), field("FD minimum", moneyInput("aFm", Cn(c.savings.fd.min)))),
    field("Leftover cash after saving", h("select", { id: "aLo" }, options([{ value: "spend", label: "Spent (not tracked)" }, { value: "sweep", label: "Kept in cash savings" }], c.savings.leftover))),
    saveBtn(x => {
      x.expenses.monthly = D(toCents(val("aExp"))); x.expenses.inflationLinked = checked("aExpI");
      Object.assign(x.savings, { fixedMonthly: D(toCents(val("aFix"))), pctBonus: fnum("aPb") / 100, pctLump: fnum("aPl") / 100, startCash: D(toCents(val("aSC"))), leftover: val("aLo") });
      x.savings.alloc = { cash: fnum("aAc") / 100, fd: fnum("aAf") / 100, ssb: fnum("aAs") / 100, fund: fnum("aAb") / 100 };
      x.savings.cash.rate = fnum("aCr") / 100; x.savings.fd.rate = fnum("aFr") / 100; x.savings.fd.renewRate = fnum("aFn") / 100; x.savings.fd.min = D(toCents(val("aFm")));
      S.future.setup.expenses = true;
    }));
}

let rerender = () => { };
export const setFutureRerender = fn => (rerender = fn);
