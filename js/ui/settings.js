/* Budget Margin 4 — Settings: grouped into short pages instead of one long scroll. */
import { h, icon, money, iso, today, toCents, days, pIso, dayLabel, ICON_CHOICES, ICON_LABELS, haptic } from "../util.js";
import { S, save, AIC, saveAIC, APP_VERSION, hasPrevious, recoverPrevious, replaceAll, wipe, isBackup } from "../state.js";
import * as C from "../calc.js";
import * as AI from "../ai.js";
import { removeHistoricalImports, addCapture, parseNotificationText } from "../imports.js";
import { toast, confirmSheet, field, options, toggleRow, badge, applyTheme } from "./core.js";
import { pickStatement, pickHistorical, pasteNotification } from "./importui.js";

let go = () => { }, page = "main", pwa = { standalone: false, updateReady: false, check: null };
export const initSettings = nav => (go = nav);
export const setSettingsPage = p => (page = p || "main");
export const setPwa = o => Object.assign(pwa, o);

const PAGES = [
  ["budget", "Budget period & currency", "calendar", "var(--blue)"],
  ["envelopes", "Envelopes", "target", "var(--jade)"],
  ["import", "Import & bank alerts", "file", "var(--cyan)"],
  ["ai", "AI assist", "spark", "var(--violet)"],
  ["appearance", "Appearance", "heart", "var(--pink)"],
  ["data", "Backup & data", "shield", "var(--amber)"],
];
export function renderSettings(root) {
  const title = page === "main" ? "Settings" : (PAGES.find(p => p[0] === page) || [0, "Settings"])[1];
  root.replaceChildren(h("div.bar",
    h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
      h("button.icon-btn", { type: "button", "aria-label": "Back", html: icon("chevL"), onclick: () => { if (page === "main") go("back"); else { page = "main"; renderSettings(root); } } }),
      h("h1", { style: { fontSize: page === "main" ? "28px" : "22px" } }, title))));
  const body = h("div"); root.appendChild(body);
  const fn = { main, budget, envelopes, import: importPage, ai, appearance, data }[page] || main;
  fn(body, root);
}
function main(body, root) {
  const n = S.txns.length;
  const backupDue = n >= 10 && (!S.lastExport || days(pIso(S.lastExport), today()) >= 14);
  if (backupDue) body.appendChild(h("button.banner.alert", { type: "button", style: { marginBottom: "12px" }, onclick: () => { page = "data"; renderSettings(root); } }, badge("shield", "var(--amber)"), h("div.txt", h("b", S.lastExport ? "No backup for " + days(pIso(S.lastExport), today()) + " days" : "No backup yet"), h("span", "Your data only lives on this phone")), h("span.chev", { html: icon("chevR") })));
  body.appendChild(h("div.card.flush.rows", PAGES.map(([k, l, ic, col]) => h("button.row", { type: "button", onclick: () => { page = k; renderSettings(root); window.scrollTo(0, 0); } }, badge(ic, col), h("div.txt", h("div.t1", l), h("div.t2", sub(k))), h("span.chev", { html: icon("chevR") })))));
  body.appendChild(h("div.set-group", h("div.label", "About"), h("div.card",
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" } },
      h("div", h("b", "Budget Margin " + APP_VERSION), h("div.small.dim", pwa.standalone ? "Home Screen app · data stays on this phone" : "Browser mode · add to Home Screen for the app")),
      h("button.btn.sm.soft", { type: "button", onclick: () => pwa.check && pwa.check() }, pwa.updateReady ? "Update now" : "Check for update")),
    h("p.hint", n + (n === 1 ? " entry" : " entries") + " logged."))));
}
function sub(k) {
  if (k === "budget") return "Resets on day " + (S.startDay || 1) + " · RM" + S.rate + " per S$";
  if (k === "envelopes") return S.cats.length + " envelopes · " + money(C.capAll(), false) + " a period";
  if (k === "import") return "Statements, alerts, history";
  if (k === "ai") return AI.aiOn() ? "On · " + (AIC.provider || "connected") : "Off";
  if (k === "appearance") return (S.theme === "coral" ? "Paper Coral" : "Midnight") + " · " + S.accent;
  if (k === "data") return S.lastExport ? "Last backup " + dayLabel(S.lastExport).toLowerCase() : "Not backed up yet";
  return "";
}

/* ── budget ── */
function budget(body) {
  body.appendChild(h("div.card",
    field("Budget resets on day", h("select", { onchange: e => { S.startDay = +e.target.value || 1; save(); } }, options(Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), String(S.startDay || 1))), "Most people pick the day after payday."),
    field("Ringgit per Singapore dollar", h("input", { inputmode: "decimal", value: S.rate, onchange: e => { const r = parseFloat(e.target.value); S.rate = r > 0 ? r : 3.35; save(); toast("Rate saved · past entries keep their own rate"); } }), "New ringgit entries use this rate. Entries already logged keep the rate they were logged at."),
    field("Daily spending limit (optional)", h("input", { inputmode: "decimal", placeholder: "Automatic", value: S.dailyCap ? (S.dailyCap / 100).toFixed(0) : "", onchange: e => { S.dailyCap = toCents(e.target.value); save(); } }), "Leave blank and Today uses an even share of your period budget.")));
}

/* ── envelopes (edit, reorder, merge, show on home) ── */
let openEdit = null;
function envelopes(body, root) {
  body.appendChild(h("div.card.tight", h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("span.dim", "All envelopes, per period"), h("b.tab", money(C.capAll(), false)))));
  const list = h("div.card.flush", { style: { marginTop: "12px" } });
  S.cats.forEach(c => list.appendChild(envEditor(c, root)));
  body.appendChild(list);
  const nameIn = h("input", { placeholder: "New envelope name", autocomplete: "off" });
  body.appendChild(h("div.card", { style: { marginTop: "12px" } }, h("div", { style: { display: "flex", gap: "8px" } }, nameIn, h("button.btn.sm", { type: "button", onclick: () => {
    const v = nameIn.value.trim(); if (!v) return;
    const c = { id: "c" + Date.now(), name: v, icon: "dots", cap: 0, quick: [500, 1000, 2000, 5000], home: true };
    S.cats.push(c); openEdit = c.id; save(); renderSettings(root);
  } }, "Add"))));
  body.appendChild(h("p.hint", { style: { margin: "10px 4px" } }, "Drag the handle to reorder. Renaming updates every past entry, because entries point to the envelope rather than copying its name."));
}
function envEditor(c, root) {
  const box = h("div.editor-env", { dataset: { cid: c.id } });
  const handle = h("span.drag-handle", { html: icon("drag"), "aria-label": "Drag to reorder", role: "button" });
  const head = h("div.env-edit-head", handle, h("span", { style: { color: C.hueOf(c.id) }, html: icon(c.icon || "dots") }),
    h("input", { value: c.name, "aria-label": "Envelope name", onchange: e => { c.name = e.target.value.trim() || c.name; save({ silent: true }); } }),
    h("input.cap", { inputmode: "decimal", value: c.cap ? (c.cap / 100).toFixed(0) : "", placeholder: "Cap", "aria-label": c.name + " cap per period", onchange: e => { c.cap = toCents(e.target.value); save({ silent: true }); } }),
    h("button.icon-btn", { type: "button", "aria-label": "More options for " + c.name, "aria-expanded": openEdit === c.id ? "true" : "false", html: icon("dots"), onclick: () => { openEdit = openEdit === c.id ? null : c.id; renderSettings(root); } }));
  box.appendChild(head);
  if (openEdit === c.id) {
    box.appendChild(h("div.icon-pick", ICON_CHOICES.map(n => h("button", { type: "button", "aria-pressed": (c.icon || "dots") === n ? "true" : "false", "aria-label": ICON_LABELS[n], title: ICON_LABELS[n], html: icon(n), onclick: () => { c.icon = n; save({ silent: true }); renderSettings(root); } }))));
    box.appendChild(field("One-tap amounts", h("input", { value: (c.quick || []).map(v => (v / 100).toFixed(2).replace(/\.00$/, "")).join(", "), placeholder: "3, 5, 8, 12", onchange: e => { c.quick = e.target.value.split(",").map(toCents).filter(x => x > 0).slice(0, 4); save({ silent: true }); } })));
    const tg = toggleRow("home_" + c.id, c.home !== false, "Show on Home", "Hidden envelopes still count in Activity, Insights and imports.");
    tg.querySelector("input").addEventListener("change", e => { c.home = e.target.checked; save({ silent: true }); });
    box.appendChild(tg);
    if (S.cats.length > 1) {
      const ms = h("select", { "aria-label": "Merge into" }, options(S.cats.filter(x => x.id !== c.id).map(x => ({ value: x.id, label: x.name })), "", "Merge into…"));
      box.appendChild(h("div", { style: { display: "flex", gap: "8px", margin: "4px 0 8px" } }, ms, h("button.btn.sm.soft", { type: "button", onclick: async () => {
        const target = ms.value; if (!target) { toast("Choose an envelope to merge into"); return; }
        if (!(await confirmSheet("Merge " + c.name + " into " + C.catName(target) + "?", "Every " + c.name + " entry, quick log and merchant rule moves across, and " + c.name + " is removed.", "Merge"))) return;
        S.txns.forEach(t => { if (t.cat === c.id) t.cat = target; });
        S.bookmarks.forEach(b => { if (b.cat === c.id) b.cat = target; });
        S.recurring.forEach(r => { if (r.cat === c.id) r.cat = target; });
        Object.keys(S.merchantRules).forEach(k => { if (S.merchantRules[k] === c.id) S.merchantRules[k] = target; });
        const dst = S.cats.find(x => x.id === target); dst.cap = (dst.cap || 0);
        S.cats = S.cats.filter(x => x.id !== c.id); openEdit = null; save(); toast("Merged into " + dst.name);
      } }, "Merge")));
    }
    box.appendChild(h("button.btn.danger", { type: "button", style: { minHeight: "36px" }, onclick: async () => {
      const n = S.txns.filter(t => t.cat === c.id).length;
      if (!(await confirmSheet("Remove " + c.name + "?", n ? n + " entries use it; they'll show as \"Removed envelope\". Merging keeps them instead." : null, "Remove", true))) return;
      S.cats = S.cats.filter(x => x.id !== c.id); openEdit = null; save();
    } }, "Remove envelope"));
  }
  dragReorder(box, handle, root);
  return box;
}
function dragReorder(box, handle, root) {
  let on = false, pid = null;
  handle.addEventListener("pointerdown", e => { on = true; pid = e.pointerId; handle.setPointerCapture(pid); box.classList.add("dragging"); haptic(6); e.preventDefault(); });
  handle.addEventListener("pointermove", e => {
    if (!on || e.pointerId !== pid) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), target = el && el.closest(".editor-env");
    if (target && target !== box && target.parentNode === box.parentNode) { const r = target.getBoundingClientRect(); box.parentNode.insertBefore(box, e.clientY < r.top + r.height / 2 ? target : target.nextSibling); }
  });
  const end = () => {
    if (!on) return; on = false; box.classList.remove("dragging");
    const ids = [...box.parentNode.querySelectorAll(".editor-env")].map(x => x.dataset.cid);
    const byId = Object.fromEntries(S.cats.map(c => [c.id, c]));
    const next = ids.map(id => byId[id]).filter(Boolean);
    if (next.length === S.cats.length && next.some((c, i) => c !== S.cats[i])) { S.cats = next; save({ silent: true }); haptic(4); }
  };
  handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end);
}

/* ── import ── */
function importPage(body) {
  const last = S.imports[S.imports.length - 1];
  body.appendChild(h("div.card",
    h("b", "Bank or card statement"),
    h("p.hint", "Import a CSV or PDF, compare it with what you've logged and add anything missing. CSV works offline; PDFs need internet once for the reader." + (last ? " Last: " + last.label + ", " + last.matched + " matched, " + last.missing + " missing." : "")),
    h("button.btn.sm", { type: "button", style: { marginTop: "10px" }, onclick: pickStatement }, "Import statement")));
  const link = location.href.split("?")[0].split("#")[0];
  body.appendChild(h("div.card",
    h("b", "Bank alerts from your iPhone"),
    h("p.hint", "Set up an iOS Shortcut that copies the bank notification, then tap + → Paste alert in Budget Margin. Or have the Shortcut open this link with the alert text:"),
    h("div.code", { style: { margin: "10px 0" } }, link + "#capture=1&app=DBS&text=[URL-ENCODED ALERT TEXT]"),
    h("div.btn-row", h("button.btn.sm.soft", { type: "button", onclick: pasteNotification }, "Paste alert now"),
      h("button.btn.sm.soft", { type: "button", onclick: () => { const r = addCapture(parseNotificationText("Old Chang Kee, Singapore, SG\nSGD 4.90", { app: "DBS Bank" })); if (r === "added") save(); toast(r === "added" ? "Test payment added to your inbox" : "The test payment is already in your inbox"); } }, "Add a test alert"))));
  const shortcuts = S.cats.slice(0, 4).map(c => { const v = (c.quick && c.quick[0]) || 500; return h("div.code", { style: { marginTop: "6px" } }, c.name + " " + (v / 100).toFixed(2) + " → " + link + "?log=" + c.id + "&amt=" + v); });
  body.appendChild(h("div.card", h("b", "One-tap Home Screen shortcuts"), h("p.hint", "Open one of these links from a Shortcut to log a fixed amount instantly."), shortcuts));
  const hi = S.historicalImports;
  body.appendChild(h("div.card",
    h("b", "Historical migration"),
    h("p.hint", hi.length ? hi.reduce((a, x) => a + (x.spending || 0) + (x.ledger || 0), 0) + " records imported across " + hi.length + " file" + (hi.length === 1 ? "" : "s") + ". They don't change current account balances." : "One-time import of your canonical history CSV (account_name, account_type, currency, transaction_date, description, transaction_type, amount)."),
    h("div.btn-row", { style: { marginTop: "10px" } }, h("button.btn.sm.soft", { type: "button", onclick: pickHistorical }, "Import history CSV"),
      hi.length ? h("button.btn.sm.soft", { type: "button", style: { color: "var(--coral)" }, onclick: async () => { if (await confirmSheet("Remove imported history?", "Entries you logged yourself are kept. Accounts created only by the import are removed.", "Remove", true)) { removeHistoricalImports(); save(); toast("Imported history removed"); } } }, "Remove imported history") : null)));
}

/* ── AI assist ── */
function setpointWorker() { try { const x = JSON.parse(localStorage.getItem("setpoint.sync") || "null"); return x && x.url && x.appKey ? x : null; } catch (e) { return null; } }
function ai(body, root) {
  const status = h("small", AI.aiOn() ? "On · " + (AIC.provider || "connected") + (AIC.limit ? " · " + (AIC.used || 0) + "/" + AIC.limit + " calls used today" : "") : AIC.url && AIC.appKey ? "Off" : "Add your Worker address and app key first");
  const url = h("input", { type: "url", inputmode: "url", autocapitalize: "off", spellcheck: false, placeholder: "https://setpoint-sync.you.workers.dev", value: AIC.url || "", onchange: e => { AIC.url = e.target.value.trim().replace(/\/+$/, ""); saveAIC(); renderSettings(root); } });
  const key = h("input", { type: "password", autocomplete: "off", autocapitalize: "off", placeholder: "The same APP_KEY Setpoint uses", value: AIC.appKey || "", onchange: e => { AIC.appKey = e.target.value.trim(); saveAIC(); renderSettings(root); } });
  const onBox = h("input", { type: "checkbox", checked: AI.aiOn(), onchange: async e => {
    if (e.target.checked && !(AIC.url && AIC.appKey)) { e.target.checked = false; toast("Add the Worker address and app key first"); return; }
    AIC.on = e.target.checked; saveAIC(); renderSettings(root);
    if (AIC.on) try { await check(); toast("AI assist on · " + AIC.provider); } catch (err) { toast("Saved, but " + AI.aiErr(err)); }
  } });
  async function check() {
    const j = await AI.aiProbe(AIC.url);
    if (!j || j.service !== "setpoint-sync") throw new Error("that address isn't a Setpoint Worker");
    if (!j.ai) throw new Error("the Worker has no AI key yet (add GROQ_API_KEY or GEMINI_API_KEY)");
    AIC.provider = j.ai; saveAIC(); return j;
  }
  const sp = !(AIC.url && AIC.appKey) && setpointWorker();
  body.append(
    h("div.card",
      h("p.hint", { style: { marginTop: 0 } }, "AI reads receipts, PDF statements and bank alerts the built-in reader can't, suggests envelopes for new merchants, and answers questions in Ask. It uses the /ai route on your Setpoint Worker, so the AI key stays in Cloudflare."),
      field("Worker address", url), field("App key", key),
      h("label.toggle", onBox, h("span", h("b", "Use AI assist"), status)),
      h("div.btn-row", h("button.btn.sm.soft", { type: "button", onclick: async () => {
        if (!(AIC.url && AIC.appKey)) { toast("Add the Worker address and app key first"); return; }
        const was = AIC.on; AIC.on = true; toast("Testing…");
        try { await check(); AI.aiJson(await AI.aiCall("ping", 'Reply with this JSON only: {"ok":true}', { maxTokens: 60, timeout: 15000 })); toast("AI assist works · " + AIC.provider); }
        catch (e) { toast("Test failed: " + AI.aiErr(e)); }
        AIC.on = was; saveAIC(); renderSettings(root);
      } }, "Test connection"), sp ? h("button.btn.sm.soft", { type: "button", onclick: () => { AIC.url = sp.url.replace(/\/+$/, ""); AIC.appKey = sp.appKey; saveAIC(); renderSettings(root); toast("Copied Setpoint's Worker settings"); } }, "Use Setpoint's Worker") : null)),
    h("div.set-group", h("div.label", "What gets sent"), h("div.card.flush.rows",
      row("Bank alert", "The copied alert text"),
      row("PDF statement", "The statement's text"),
      row("Receipt", "The photo, shrunk to about 1280 px"),
      row("Envelope suggestions", "Merchant names and your envelope names"),
      row("Ask", "Your budget summary and the last three periods of transactions")),
      h("p.hint", { style: { margin: "10px 4px" } }, "Text goes to your Worker's text provider (Groq first); photos go to its vision provider (Gemini first). On Gemini's free tier, Google may use what you send to improve its products; set AI_VISION_PROVIDER on the Worker to change that. AI calls count toward the Worker's daily limit (AI_DAILY_LIMIT), which Setpoint shares. The key stays on this phone and is never in backups. Nothing AI reads is saved until you confirm it.")));
}
const row = (a, b) => h("div.row", { style: { minHeight: "48px" } }, h("div.txt", h("div.t1", { style: { fontSize: "14.5px" } }, a), h("div.t2", b)));

/* ── appearance ── */
function appearance(body, root) {
  body.appendChild(h("div.card",
    h("div.label", "Theme"),
    h("div.theme-pick", [["midnight", "Midnight", "#07141B"], ["coral", "Paper Coral", "#F6F3EF"]].map(([k, l, col]) => h("button", { type: "button", "aria-pressed": S.theme === k ? "true" : "false", onclick: () => { S.theme = k; if (k === "coral" && S.accent === "jade") S.accent = "pink"; save({ silent: true }); applyTheme(); renderSettings(root); } }, h("i", { style: { background: col, border: "1px solid var(--line)" } }), l))),
    h("div.label", { style: { marginTop: "16px" } }, "Accent"),
    h("div.swatches", ["jade", "cyan", "violet", "amber", "pink"].map(k => h("button.swatch", { type: "button", "aria-label": k, "aria-pressed": S.accent === k ? "true" : "false", style: { background: "var(--" + k + ")" }, onclick: () => { S.accent = k; save({ silent: true }); applyTheme(); renderSettings(root); } })))));
}

/* ── data ── */
function download(name, text, type) {
  const b = new Blob([text], { type }), u = URL.createObjectURL(b), a = h("a", { href: u, download: name });
  document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 400);
  S.lastExport = iso(today()); save({ silent: true });
}
function data(body, root) {
  const n = S.txns.length;
  body.append(
    h("div.card",
      h("p.hint", { style: { marginTop: 0 } }, "Your budget lives only on this phone. " + (S.lastExport ? "Last backup: " + dayLabel(S.lastExport).toLowerCase() + "." : "You haven't made a backup yet.")),
      h("div.btn-row", { style: { marginTop: "10px" } },
        h("button.btn.sm", { type: "button", onclick: () => { download("budget-margin-backup-" + iso(today()) + ".json", JSON.stringify(S), "application/json"); toast("Backup saved"); renderSettings(root); } }, "Export backup"),
        h("button.btn.sm.soft", { type: "button", onclick: () => {
          const q = s => '"' + String(s || "").replace(/"/g, '""') + '"', l = ["date,sgd,currency,original,envelope,account,notes"];
          S.txns.forEach(t => l.push([t.date, ((t.sgd || 0) / 100).toFixed(2), t.cur, ((t.orig || 0) / 100).toFixed(2), q(C.catName(t.cat)), q(t.account ? C.accountName(t.account) : ""), q(t.note)].join(",")));
          download("budget-margin-" + iso(today()) + ".csv", l.join("\n"), "text/csv"); toast("CSV saved");
        } }, "Export CSV"))),
    h("div.card",
      h("b", "Restore"),
      h("p.hint", "Replace everything on this phone with a backup file, or go back to the state before your last change."),
      h("div.btn-row", { style: { marginTop: "10px" } },
        h("button.btn.sm.soft", { type: "button", onclick: () => { const i = document.getElementById("fileRestore"); i.value = ""; i.click(); } }, "Restore backup"),
        h("button.btn.sm.soft", { type: "button", disabled: !hasPrevious(), onclick: async () => { if (await confirmSheet("Undo your last change?", "Restores the data from just before the most recent save.", "Restore")) toast(recoverPrevious() ? "Previous state restored" : "Nothing to restore"); } }, "Undo last change"))),
    h("div.card",
      h("b", "Start over"), h("p.hint", n + " entries on this phone."),
      h("button.btn.sm.soft", { type: "button", style: { marginTop: "10px", color: "var(--coral)" }, onclick: async () => {
        if (!(await confirmSheet("Erase everything?", "Every entry and setting on this phone is deleted.", "Erase", true))) return;
        if (!(await confirmSheet("Really erase?", "This can't be undone. Export a backup first if you're unsure.", "Erase everything", true))) return;
        wipe(); toast("Erased"); go("home");
      } }, "Erase everything")));
}
export async function handleRestoreFile(file) {
  if (!file) return;
  try {
    const p = JSON.parse(await file.text());
    if (!isBackup(p)) throw 0;
    if (!(await confirmSheet("Restore this backup?", "Everything on this phone is replaced with the backup's " + p.txns.length + " entries.", "Restore", true))) return;
    replaceAll(p); toast("Backup restored");
  } catch (e) { toast("That file isn't a Budget Margin backup"); }
}
