/* Budget Margin 4 — Activity: every entry (spending and money movements) by period, calendar and insights. */
import { h, icon, money, rmf, dayLabel, dateShort, iso, pIso, today, addDays, haptic, esc } from "../util.js";
import { S, save } from "../state.js";
import * as C from "../calc.js";
import { badge, options } from "./core.js";
import { openEditTxn, openLedger, deleteTxn, logSpend, ledgerLabel, openSpend } from "./entry.js";

let go = () => { };
export const initActivity = nav => (go = nav);
let aStart = null, searchOn = false, q = "", fCat = "", fAcc = "", selDay = null, focusCat = null, activeBar = -1;
export function showPeriod(start) { aStart = start; }
export function filterEnvelope(cid) { fCat = cid; searchOn = true; S.historyView = "list"; }

const SVGNS = "http://www.w3.org/2000/svg";
const svg = (n, a) => { const e = document.createElementNS(SVGNS, n); for (const k in a || {}) e.setAttribute(k, a[k]); return e; };

export function renderActivity(root) {
  if (!aStart) aStart = C.pStart(today());
  let view = S.historyView === "calendar" ? "calendar" : S.historyView === "stats" || S.historyView === "analytics" ? "stats" : "list";
  const a = aStart, b = C.pShift(a, 1), tot = C.periodTotals(a, b);
  root.replaceChildren(
    h("div.bar", h("h1", "Activity"), h("div.bar-actions",
      h("button.icon-btn", { type: "button", "aria-label": "Search and filter", "aria-pressed": searchOn ? "true" : "false", html: icon("search"), onclick: () => { searchOn = !searchOn; if (!searchOn) { q = ""; fCat = ""; fAcc = ""; } rerender(root); } }),
      h("button.icon-btn", { type: "button", "aria-label": "Settings", html: icon("gear"), onclick: () => go("settings") }))),
    h("div.monthnav",
      h("button.icon-btn", { type: "button", "aria-label": "Previous period", html: icon("chevL"), onclick: () => { aStart = C.pShift(aStart, -1); selDay = null; rerender(root); } }),
      h("b", C.pLabel(a) + ((S.startDay || 1) !== 1 && C.pShift(a, 1).getFullYear() !== today().getFullYear() ? " " + C.pShift(a, 1).getFullYear() : "")),
      h("button.icon-btn", { type: "button", "aria-label": "Next period", html: icon("chevR"), disabled: b > today() ? true : null, style: b > today() ? { opacity: .35 } : null, onclick: () => { if (b > today()) return; aStart = C.pShift(aStart, 1); selDay = null; rerender(root); } })),
    h("div.seg", { style: { marginBottom: "12px" } }, [["list", "List"], ["calendar", "Calendar"], ["stats", "Insights"]].map(([k, l]) =>
      h("button", { type: "button", "aria-pressed": view === k ? "true" : "false", onclick: () => { S.historyView = k; save({ silent: true }); rerender(root); } }, l))),
    h("div.card.flush", h("div.strip",
      h("div", h("span", "Money in"), h("b.tab.good", money(tot.inc, false))),
      h("div", h("span", "Money out"), h("b.tab", money(tot.out, false))),
      h("div", h("span", "Net"), h("b.tab" + (tot.net < 0 ? ".bad" : ""), (tot.net < 0 ? "-" : "") + money(Math.abs(tot.net), false))))));
  const body = h("div", { style: { marginTop: "12px" } });
  root.appendChild(body);
  if (view === "calendar") drawCalendar(body, a, b);
  else if (view === "stats") drawInsights(body, a, b, root);
  else drawList(body, a, b, root);
}
function rerender(root) { renderActivity(root); }

/* ── list ── */
function drawList(body, a, b, root) {
  if (searchOn) {
    const qIn = h("input", { type: "search", placeholder: "Search merchant, note or envelope", value: q, autocomplete: "off", oninput: e => { q = e.target.value; paint(); } });
    body.appendChild(h("div.searchbar", qIn, h("div.two",
      h("select", { "aria-label": "Envelope", onchange: e => { fCat = e.target.value; paint(); } }, options(S.cats.map(c => ({ value: c.id, label: c.name })), fCat, "All envelopes")),
      h("select", { "aria-label": "Account", onchange: e => { fAcc = e.target.value; paint(); } }, options([{ value: "__none", label: "Unassigned" }, ...S.accounts.map(x => ({ value: x.id, label: x.name }))], fAcc, "All accounts")))));
  }
  const listBox = h("div");
  body.appendChild(listBox);
  body.appendChild(h("button.btn.soft", { type: "button", style: { marginTop: "14px" }, onclick: () => openSpend({ date: iso(b > today() ? today() : addDays(b, -1)), title: "Add spending" }) }, "Add an entry for this period"));
  function paint() {
    const qq = q.trim().toLowerCase();
    const items = [];
    for (const t of S.txns) {
      if (!C.inR(t, a, b)) continue;
      if (fCat && t.cat !== fCat) continue;
      if (fAcc === "__none" ? t.account : fAcc && t.account !== fAcc) continue;
      if (qq && !(C.catName(t.cat) + " " + (t.note || "") + " " + t.date).toLowerCase().includes(qq)) continue;
      items.push({ kind: "t", date: t.date, at: t.createdAt || 0, x: t });
    }
    if (!fCat) for (const x of S.ledger) {
      if (!x.date || !C.inR(x, a, b)) continue;
      if (fAcc && !(fAcc === "__none" ? !x.account && !x.from && !x.to : x.account === fAcc || x.from === fAcc || x.to === fAcc)) continue;
      if (qq && !(ledgerLabel(x) + " " + (x.note || "") + " " + x.type).toLowerCase().includes(qq)) continue;
      items.push({ kind: "l", date: x.date, at: x.createdAt || 0, x });
    }
    items.sort((p, r) => r.date.localeCompare(p.date) || r.at - p.at);
    listBox.replaceChildren();
    if (!items.length) { listBox.appendChild(h("div.card", h("div.empty", qq || fCat || fAcc ? "Nothing matches this filter." : "Nothing logged in this period."))); return; }
    const byDay = {};
    items.forEach(i => (byDay[i.date] = byDay[i.date] || []).push(i));
    for (const day of Object.keys(byDay).sort().reverse()) {
      const list = byDay[day], out = list.filter(i => i.kind === "t").reduce((s, i) => s + (i.x.sgd || 0), 0);
      listBox.appendChild(h("div.dayhead", h("span", dayLabel(day)), h("span.tab", out ? money(out) : "")));
      const card = h("div.card.flush.rows");
      list.forEach(i => card.appendChild(i.kind === "t" ? txnRow(i.x) : ledgerRow(i.x)));
      listBox.appendChild(card);
    }
    const sumOut = items.filter(i => i.kind === "t").reduce((s, i) => s + (i.x.sgd || 0), 0);
    if (qq || fCat || fAcc) listBox.prepend(h("p.hint", { style: { margin: "0 4px 4px" } }, items.length + " entries · spending " + money(sumOut)));
  }
  paint();
}
function txnRow(t) {
  const c = C.catOf(t.cat);
  const row = h("button.row", { type: "button" },
    badge((c && c.icon) || "dots", C.hueOf(t.cat), true),
    h("div.txt", h("div.t1", t.note || C.catName(t.cat)), h("div.t2", [t.note ? C.catName(t.cat) : null, t.account ? C.accountName(t.account) : null, t.source === "receipt" ? "receipt" : null].filter(Boolean).join(" · ") || " ")),
    h("div.val.tab", money(t.sgd), t.cur === "MYR" ? h("small", rmf(t.orig)) : null));
  const shell = h("div.swipe", h("div.swipe-acts",
    h("button.rep", { type: "button", html: icon("repeat") + "<span>Again</span>", onclick: e => { e.stopPropagation(); shell.classList.remove("open"); logSpend(t.cat, t.cur === "MYR" ? t.orig : t.sgd, t.cur || "SGD", t.note, t.account); } }),
    h("button.del", { type: "button", html: icon("trash") + "<span>Delete</span>", onclick: e => { e.stopPropagation(); deleteTxn(t.id); } })), row);
  swipe(shell, row, () => openEditTxn(t.id));
  return shell;
}
function ledgerRow(x) {
  const inflow = x.type === "income" || x.type === "refund", neutral = x.type === "transfer" || x.type === "card_payment";
  const ic = inflow ? "arrowIn" : neutral ? "swap" : x.type === "goal" ? "target" : "wallet";
  const color = inflow ? "var(--jade)" : neutral ? "var(--blue)" : "var(--amber)";
  const amt = C.ledgerAmountSgd(x);
  return h("button.row", { type: "button", onclick: () => (x.type === "goal" ? go("plan", "goals") : openLedger(x.id)) },
    badge(ic, color, true),
    h("div.txt", h("div.t1", ledgerLabel(x)), h("div.t2", [{ income: "Income", refund: "Refund", transfer: "Transfer", card_payment: "Card payment", expense: "Outside envelopes", goal: "Goal contribution", adjustment: "Adjustment" }[x.type] || x.type, x.account ? C.accountName(x.account) : null].filter(Boolean).join(" · "))),
    h("div.val.tab" + (inflow ? ".plus" : ""), (inflow ? "+" : neutral ? "" : "-") + money(amt), x.cur === "MYR" ? h("small", rmf(x.amount)) : null));
}
/* swipe left for Again/Delete; a tap without movement opens the entry */
function swipe(shell, row, onTap) {
  let x0 = 0, y0 = 0, pid = null, moved = false, base = 0, horiz = null;
  row.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; pid = e.pointerId; moved = false; horiz = null; base = shell.classList.contains("open") ? -148 : 0; });
  row.addEventListener("pointermove", e => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (horiz == null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) { horiz = Math.abs(dx) > Math.abs(dy); if (horiz) try { row.setPointerCapture(pid); } catch (err) { } }
    if (!horiz) return;
    moved = true; row.style.transition = "none"; row.style.transform = "translateX(" + Math.max(-148, Math.min(0, base + dx)) + "px)";
  });
  const end = e => {
    if (e.pointerId !== pid) return; pid = null;
    if (horiz) { const dx = e.clientX - x0; row.style.transition = ""; row.style.transform = ""; shell.classList.toggle("open", base + dx < -60); if (base + dx < -60) haptic(5); }
  };
  row.addEventListener("pointerup", end); row.addEventListener("pointercancel", end);
  row.addEventListener("click", () => { if (moved) { moved = false; return; } if (shell.classList.contains("open")) { shell.classList.remove("open"); return; } onTap(); });
}

/* ── calendar ── */
function drawCalendar(body, a, b) {
  const sums = {}; let max = 1;
  for (let d = new Date(a); d < b; d = addDays(d, 1)) { const s = C.spent(d, addDays(d, 1)); sums[iso(d)] = s; if (s > max) max = s; }
  const grid = h("div.cal");
  const first = (a.getDay() + 6) % 7;
  for (let i = 0; i < first; i++) grid.appendChild(h("span"));
  const td = iso(today());
  if (!selDay || pIso(selDay) < a || pIso(selDay) >= b) selDay = today() >= a && today() < b ? td : iso(a);
  const detail = h("div", { style: { marginTop: "14px" } });
  for (let d = new Date(a); d < b; d = addDays(d, 1)) {
    const ds = iso(d), s = sums[ds] || 0;
    grid.appendChild(h("button" + (ds === td ? ".today" : ""), { type: "button", "aria-pressed": ds === selDay ? "true" : "false", "aria-label": dayLabel(ds) + ", " + money(s), onclick: e => { selDay = ds; grid.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); drawDay(detail, ds); } },
      h("i", { style: { height: (s ? Math.max(8, s / max * 100) : 0) + "%" } }), h("b", String(d.getDate())), h("small.tab", s ? money(s, false).replace("S$", "") : "")));
  }
  body.append(h("div.card.tight", h("div.cal-week", ["M", "T", "W", "T", "F", "S", "S"].map(x => h("span", x))), grid), detail);
  drawDay(detail, selDay);
}
function drawDay(box, ds) {
  const list = S.txns.filter(t => t.date === ds).reverse();
  box.replaceChildren(h("div.dayhead", h("span", dayLabel(ds)), h("span.tab", money(list.reduce((s, t) => s + (t.sgd || 0), 0)))));
  const card = h("div.card.flush.rows");
  list.forEach(t => card.appendChild(txnRow(t)));
  if (!list.length) card.appendChild(h("div.empty", "No spending on this day.", h("div", { style: { marginTop: "10px" } }, h("button.btn.sm.soft", { type: "button", style: { margin: "0 auto" }, onclick: () => openSpend({ date: ds, title: "Add spending" }) }, "Add spending on " + dateShort(ds)))));
  box.appendChild(card);
}

/* ── insights ── */
function drawInsights(body, a, b, root) {
  const items = C.byEnvelope(a, b), total = items.reduce((s, x) => s + x.amt, 0);
  if (!items.length) body.appendChild(h("div.card", h("div.empty", h("b", "Nothing to analyse"), "No spending in this period yet.")));
  else {
    const R = 50, CIRC = 2 * Math.PI * R;
    const s = svg("svg", { viewBox: "0 0 120 120", role: "img", "aria-label": "Spending by envelope" });
    let acc = 0;
    const focus = items.find(x => x.cid === focusCat);
    items.forEach(it => {
      const frac = it.amt / total, c = svg("circle", { cx: 60, cy: 60, r: R, stroke: C.hueOf(it.cid), "stroke-dasharray": Math.max(0, CIRC * frac - 1.5).toFixed(2) + " " + CIRC.toFixed(2), "stroke-dashoffset": (-CIRC * acc).toFixed(2), "stroke-width": focusCat === it.cid ? 26 : 20 });
      if (focusCat && focusCat !== it.cid) c.classList.add("muted");
      c.addEventListener("click", () => { focusCat = focusCat === it.cid ? null : it.cid; rerender(root); });
      s.appendChild(c); acc += frac;
    });
    const legend = h("div.legend", items.slice(0, 8).map(it => h("button", { type: "button", style: focusCat && focusCat !== it.cid ? { opacity: .4 } : null, onclick: () => { focusCat = focusCat === it.cid ? null : it.cid; rerender(root); } },
      h("i", { style: { background: C.hueOf(it.cid) } }), h("span", C.catName(it.cid)), h("b.tab", Math.round(it.amt / total * 100) + "%"))));
    const card = h("div.card",
      h("div.section-head", { style: { margin: "0 0 12px" } }, h("h2", "Where it went"), h("span.small.dim", items.length + " envelopes")),
      h("div.donut-wrap", h("div.donut", s, h("div.donut-center", h("span", focus ? C.catName(focus.cid) : "Total"), h("b.tab", money(focus ? focus.amt : total, false)))), legend));
    if (focus) card.appendChild(h("button.btn.sm.soft", { type: "button", style: { marginTop: "12px", width: "100%" }, onclick: () => { filterEnvelope(focus.cid); aStart = a; rerender(root); } }, "See " + C.catName(focus.cid) + " entries"));
    body.appendChild(card);
    // compared with the average of the previous 3 periods
    const prev = [1, 2, 3].map(n => C.pShift(a, -n));
    const rows = h("div.card.flush.rows");
    items.slice(0, 8).forEach(it => {
      const avg = Math.round(prev.reduce((s2, p) => s2 + C.spent(p, C.pShift(p, 1), it.cid), 0) / 3), diff = it.amt - avg, c = C.catOf(it.cid);
      rows.appendChild(h("div.row", badge((c && c.icon) || "dots", C.hueOf(it.cid)), h("div.txt", h("div.t1", C.catName(it.cid)), h("div.t2", avg ? (diff > 0 ? money(diff, false) + " more" : money(-diff, false) + " less") + " than your 3-period average" : "No earlier spending to compare")), h("div.val.tab", money(it.amt, false))));
    });
    body.appendChild(h("div.section", h("div.section-head", h("h2", "Versus usual")), rows));
  }
  const n = S.insightPeriods || 6, series = C.periodSeries(n);
  const W = 320, H = 150, pad = 18, bw = (W - pad * 2) / n, max = Math.max(1, ...series.map(x => Math.max(x.expense, x.income)));
  const chart = svg("svg", { viewBox: "0 0 " + W + " " + (H + 22), class: "chart", role: "img", "aria-label": "Spending and income by period" });
  [0, .5, 1].forEach(f => chart.appendChild(svg("line", { x1: pad, x2: W - pad, y1: (H - H * f + 4).toFixed(1), y2: (H - H * f + 4).toFixed(1), class: "grid" })));
  if (activeBar < 0 || activeBar >= n) activeBar = n - 1;
  const tip = h("div.chart-tip");
  const show = i => { const x = series[i]; activeBar = i; tip.innerHTML = "<b>" + esc(x.label) + "</b> · spent <b>" + money(x.expense, false) + "</b>" + (x.income ? " · income " + money(x.income, false) + " · saved <b>" + (x.saved < 0 ? "-" : "") + money(Math.abs(x.saved), false) + "</b>" : " · no income recorded"); chart.querySelectorAll(".sel").forEach(r => r.setAttribute("opacity", r.dataset.i == i ? 1 : 0)); };
  series.forEach((x, i) => {
    const x0 = pad + i * bw, inner = Math.min(14, bw * 0.28);
    const selR = svg("rect", { x: x0 + 2, y: 0, width: bw - 4, height: H + 4, rx: 6, class: "sel", opacity: 0 }); selR.dataset.i = i; chart.appendChild(selR);
    const hOut = x.expense / max * (H - 8), hIn = x.income / max * (H - 8);
    chart.appendChild(svg("rect", { x: (x0 + bw / 2 - inner - 1).toFixed(1), y: (H + 4 - hOut).toFixed(1), width: inner, height: Math.max(0, hOut).toFixed(1), rx: 3, class: "bar-out" }));
    chart.appendChild(svg("rect", { x: (x0 + bw / 2 + 1).toFixed(1), y: (H + 4 - hIn).toFixed(1), width: inner, height: Math.max(0, hIn).toFixed(1), rx: 3, class: "bar-in" }));
    const t = svg("text", { x: (x0 + bw / 2).toFixed(1), y: H + 18, "text-anchor": "middle", class: "lbl" }); t.textContent = x.label.split(" ")[0]; chart.appendChild(t);
    const hit = svg("rect", { x: x0, y: 0, width: bw, height: H + 22, class: "hit", tabindex: 0 });
    hit.addEventListener("click", () => show(i)); hit.addEventListener("focus", () => show(i));
    chart.appendChild(hit);
  });
  body.appendChild(h("div.section", h("div.section-head", h("h2", "Trend"), h("div.legend-inline", h("span", h("i", { style: { background: "var(--amber)" } }), "Spent"), h("span", h("i", { style: { background: "var(--jade)" } }), "Income"))),
    h("div.card", h("div.seg", { style: { marginBottom: "12px" } }, [3, 6, 12].map(k => h("button", { type: "button", "aria-pressed": k === n ? "true" : "false", onclick: () => { S.insightPeriods = k; activeBar = -1; save({ silent: true }); rerender(root); } }, k + " periods"))), chart, tip)));
  show(activeBar);
}
