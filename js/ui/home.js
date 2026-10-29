/* Budget Margin 4 — Home: what's left, what's safe today, and the envelopes. */
import { h, $, icon, money, rmf, grp, dayLabel, haptic, reduceMotion, pIso, today } from "../util.js";
import { S, save } from "../state.js";
import * as C from "../calc.js";
import { pendingCaptures } from "../imports.js";
import { badge } from "./core.js";
import { openSpend, logSpend, openEditTxn } from "./entry.js";
import { actionsFor, ymOf, ymLabel } from "../future/plan.js";

let go = () => { }, hooks = {};
export function initHome(nav, h2) { go = nav; hooks = h2 || {}; }

const WAVE = "M0 12C20 3 40 3 60 12S100 21 120 12 160 3 180 12s40 9 60 0V24H0Z";
function vessel() {
  const wave = cls => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 240 24"); s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("class", "lq-wave " + cls); s.innerHTML = '<path d="' + WAVE + '"/>'; return s; };
  const fill = h("div.lq-fill"); fill.append(wave("back"), wave("front"));
  return h("div.vessel#vessel", { role: "img" }, fill, h("div.vessel-face", h("div.amt.tab#vAmt"), h("small#vCap")));
}
let lastAmt = null;
function countTo(el, to) {
  const from = lastAmt == null ? to : lastAmt; lastAmt = to;
  if (reduceMotion || from === to) { el.innerHTML = "<sup>S$</sup>" + grp(Math.round(Math.abs(to) / 100)); return; }
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - k, 3); el.innerHTML = "<sup>S$</sup>" + grp(Math.round(Math.abs(from + (to - from) * e) / 100)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

export function renderHome(root) {
  const mode = S.mode === "day" || S.mode === "week" ? S.mode : "period";
  const g = C.gaugeData(mode), ps = C.pStart(today());
  root.replaceChildren();
  root.appendChild(h("div.bar",
    h("div", h("h1", "Budget Margin"), h("span.sub", C.pLabel(ps) + " · " + g.dl + (g.dl === 1 ? " day" : " days") + " left")),
    h("div.bar-actions", h("button.icon-btn", { type: "button", "aria-label": "Settings", html: icon("gear"), onclick: () => go("settings") }))));

  /* hero */
  const seg = h("div.seg", { role: "tablist", "aria-label": "Budget window" }, [["day", "Today"], ["week", "Week"], ["period", "Period"]].map(([k, l]) =>
    h("button", { type: "button", "aria-pressed": mode === k ? "true" : "false", onclick: () => { S.mode = k; save(); haptic(4); } }, l)));
  const v = vessel();
  const hero = h("section.card.hero", h("div.hero-top", h("div", { style: { flex: 1 } }, seg)), h("div.vessel-wrap", v, h("div.hero-side",
    h("div", h("div.k", "Safe to spend today"), h("div.v.big.tab", g.cap > 0 ? money(g.safeToday, false) : "—"), g.cap > 0 && g.safeToday <= 0 && g.left > 0 ? h("div.tiny.warn", "Bills and goals still due exceed what’s left") : null),
    h("div", h("div.k", "Spent " + (mode === "day" ? "today" : mode === "week" ? "this week" : "this period")), h("div.v.tab", money(g.sp, false))),
    h("div", h("div.k", "Budget"), h("div.v.tab", g.cap > 0 ? money(g.cap, false) : "Not set"))),
  ));
  const used = Math.max(0, Math.min(1, g.used));
  const paceTxt = g.cap <= 0 ? "Give your envelopes a cap to start" : g.pace === "ahead" ? money(g.paceDelta, false) + " ahead of pace" : g.pace === "under" ? money(-g.paceDelta, false) + " under pace" : "Right on pace";
  hero.appendChild(h("div.pace",
    h("div.meter", h("i", { style: { width: (used * 100).toFixed(1) + "%", background: C.tone(g.used) } }), g.cap > 0 ? h("span.mark", { style: { left: "calc(" + (g.ideal * 100).toFixed(1) + "% - 1px)" }, title: "Even pace" }) : null),
    h("div.pace-cap", h("span", paceTxt), h("span.tab", g.cap > 0 ? Math.round(g.used * 100) + "% used" : ""))));
  root.appendChild(hero);
  document.documentElement.style.setProperty("--sig", g.cap > 0 ? C.tone(g.used) : "var(--accent)");
  const fillEl = v.querySelector(".lq-fill"), amtEl = v.querySelector("#vAmt"), capEl = v.querySelector("#vCap");
  requestAnimationFrame(() => { fillEl.style.height = (g.cap > 0 ? Math.max(6, Math.min(100, (1 - g.used) * 100)) : 6) + "%"; });
  v.classList.toggle("over", g.cap > 0 && g.left < 0);
  countTo(amtEl, g.cap > 0 ? g.left : 0);
  capEl.textContent = g.cap <= 0 ? "no budget yet" : g.left < 0 ? "over " + (mode === "day" ? "today" : mode === "week" ? "this week" : "budget") : g.lab;
  v.setAttribute("aria-label", g.cap > 0 ? money(g.left) + " " + g.lab : "No budget set");

  /* things that need attention */
  const banners = h("div.banners");
  const pend = pendingCaptures();
  if (pend.length) banners.appendChild(banner("clip", "var(--amber)", pend.length + (pend.length === 1 ? " payment" : " payments") + " to confirm", "From copied bank alerts", () => hooks.inbox && hooks.inbox(), true));
  if (g.cap <= 0) banners.appendChild(banner("target", "var(--accent)", "Set your envelope budgets", "Settings → Envelopes", () => go("settings", "envelopes")));
  if (g.reserved > 0) banners.appendChild(banner("calendar", "var(--blue)", money(g.reserved, false) + " set aside", (g.reservedBills ? "bills" : "") + (g.reservedBills && g.reservedGoals ? " and " : "") + (g.reservedGoals ? "goals" : "") + " still due this period", () => go("plan", g.reservedBills ? "bills" : "goals")));
  const lp = C.pShift(ps, -1), logged = C.spent(lp, ps);
  if (logged > 0 && !S.recs.some(r => r.p === iso2(lp))) banners.appendChild(banner("check", "var(--jade)", "Check " + C.pLabel(lp) + " against your bank", "You logged " + money(logged, false) + ". Import a statement or enter the total.", () => hooks.monthCheck && hooks.monthCheck(lp)));
  try {
    const ym = ymOf(), open = actionsFor(ym).filter(x => !x.done);
    if (open.length) banners.appendChild(banner("target", "var(--violet)", open.length + (open.length === 1 ? " plan action" : " plan actions") + " for " + ymLabel(ym), open[0].text, () => go("plan", "future")));
  } catch (e) { console.error(e); }
  if (banners.children.length) root.appendChild(banners);

  /* quick logs */
  const quick = S.bookmarks.filter(b => C.catOf(b.cat)).slice(0, 10);
  if (quick.length) {
    root.appendChild(h("div.section", h("div.section-head", h("h2", "Quick log"), h("span.small.dim", "tap to log")),
      h("div.chips", quick.map(b => h("button.chip", { type: "button", onclick: () => logSpend(b.cat, b.amt, b.cur, b.note, b.account) },
        h("span", { style: { color: C.hueOf(b.cat) }, html: icon(C.catOf(b.cat).icon || "dots") }),
        b.note || C.catName(b.cat), h("small.tab", b.cur === "MYR" ? rmf(b.amt) : money(b.amt)))))));
  }

  /* envelopes */
  const rows = C.envelopeRows(mode).filter(r => r.c.home !== false);
  const list = h("div.card.flush.rows");
  rows.forEach(r => list.appendChild(envelopeRow(r, mode)));
  if (!rows.length) list.appendChild(h("div.empty", "No envelopes are shown on Home. Turn them on in Settings → Envelopes."));
  root.appendChild(h("div.section", h("div.section-head", h("h2", "Envelopes"), h("button.link.dim", { type: "button", onclick: () => go("settings", "envelopes") }, "Edit")), list));

  /* recent */
  const recent = S.txns.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4);
  const rl = h("div.card.flush.rows");
  recent.forEach(t => { const c = C.catOf(t.cat); rl.appendChild(h("button.row", { type: "button", onclick: () => openEditTxn(t.id) },
    badge((c && c.icon) || "dots", C.hueOf(t.cat), true),
    h("div.txt", h("div.t1", t.note || C.catName(t.cat)), h("div.t2", [t.note ? C.catName(t.cat) : null, dayLabel(t.date)].filter(Boolean).join(" · "))),
    h("div.val.tab", money(t.sgd), t.cur === "MYR" ? h("small", rmf(t.orig)) : null))); });
  if (!recent.length) rl.appendChild(h("div.empty", h("b", "Nothing logged yet"), "Tap + to add your first spending."));
  root.appendChild(h("div.section", h("div.section-head", h("h2", "Recent"), h("button.link", { type: "button", onclick: () => go("activity") }, "See all")), rl));
}
const iso2 = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function banner(ic, color, title, sub, fn, alert) {
  return h("button.banner" + (alert ? ".alert" : ""), { type: "button", onclick: fn }, badge(ic, color), h("div.txt", h("b", title), h("span", sub)), h("span.chev", { html: icon("chevR") }));
}
let openEnv = null;
function envelopeRow(r, mode) {
  const { c, cap, sp, left, f } = r, hue = C.hueOf(c.id);
  const wrap = h("div.env" + (openEnv === c.id ? ".open" : ""));
  const main = h("button.env-main", { type: "button", "aria-expanded": openEnv === c.id ? "true" : "false", onclick: () => {
    const opening = !wrap.classList.contains("open");
    wrap.parentNode.querySelectorAll(".env.open").forEach(x => { x.classList.remove("open"); x.firstChild.setAttribute("aria-expanded", "false"); });
    wrap.classList.toggle("open", opening); main.setAttribute("aria-expanded", opening ? "true" : "false"); openEnv = opening ? c.id : null; haptic(3);
  } },
    badge(c.icon || "dots", hue),
    h("div.txt",
      h("div.env-top", h("b", c.name), h("span.tab", { style: { color: cap <= 0 ? "var(--faint)" : left < 0 ? "var(--coral)" : left / cap < 0.15 ? "var(--amber)" : "" } }, cap <= 0 ? "No cap" : left < 0 ? money(-left, false) + " over" : money(left, false))),
      h("div.meter", h("i", { style: { width: (cap > 0 ? Math.min(100, f * 100) : 0) + "%", background: f >= 1 ? "var(--coral)" : hue } })),
      h("div.env-sub", h("span.tab", money(sp, false) + " spent"), h("span.tab", cap > 0 ? "of " + money(cap, false) + (mode === "period" ? "" : mode === "day" ? " today" : " this week") : ""))));
  const quick = h("div.env-quick", [5, 10, 20, 50].map(n => h("button.qbtn", { type: "button", onclick: () => logSpend(c.id, n * 100, "SGD", "", S.defaultAccount) }, "+" + n)),
    h("button.qbtn.alt", { type: "button", onclick: () => openSpend({ cid: c.id }) }, "Other…"));
  wrap.append(main, quick);
  return wrap;
}
