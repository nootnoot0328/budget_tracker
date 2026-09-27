/* Budget Margin 4 — shared UI: bottom sheet, toast with undo, confirm, theme, form helpers. */
import { h, $, icon, esc, haptic } from "../util.js";
import { S } from "../state.js";

/* ── sheet: one at a time; openSheet(title, ...content) returns the sheet box ── */
let onCloseFn = null;
export function openSheet(title, ...content) {
  const sheet = $("#sheet"), box = $("#sheetBox");
  box.replaceChildren(
    h("div.grab", { "aria-hidden": "true" }, h("i")),
    title ? h("div.sheet-head", h("h3", title), h("button.icon-btn", { type: "button", "aria-label": "Close", html: icon("close"), onclick: closeSheet })) : null,
    ...content.flat().filter(Boolean),
  );
  box.scrollTop = 0;
  sheet.style.removeProperty("--drag");
  sheet.classList.add("on");
  sheet.setAttribute("aria-hidden", "false");
  onCloseFn = null;
  return box;
}
export const onSheetClose = fn => (onCloseFn = fn);
export function closeSheet() {
  const sheet = $("#sheet");
  if (!sheet.classList.contains("on")) return;
  sheet.classList.remove("on", "dragging");
  sheet.setAttribute("aria-hidden", "true");
  const fn = onCloseFn; onCloseFn = null; if (fn) fn();
}
export const sheetOpen = () => $("#sheet").classList.contains("on");
export function initSheet() {
  const sheet = $("#sheet"), box = $("#sheetBox");
  sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
  // drag the grab bar (or pull down from the top of the content) to close
  let y0 = 0, dy = 0, t0 = 0, on = false;
  const start = y => { on = true; y0 = y; dy = 0; t0 = performance.now(); sheet.classList.add("dragging"); };
  const move = y => { if (!on) return; dy = Math.max(0, y - y0); sheet.style.setProperty("--drag", dy + "px"); };
  const end = () => { if (!on) return; on = false; sheet.classList.remove("dragging"); const v = dy / Math.max(1, performance.now() - t0); sheet.style.removeProperty("--drag"); if (dy > 90 || v > 0.6) { haptic(6); closeSheet(); } };
  box.addEventListener("touchstart", e => { if (e.touches.length !== 1) return; const g = e.target.closest(".grab"); if (g || (box.scrollTop <= 0 && e.target.closest(".sheet-head"))) start(e.touches[0].clientY); }, { passive: true });
  box.addEventListener("touchmove", e => { if (on) { move(e.touches[0].clientY); if (dy > 0) e.preventDefault(); } }, { passive: false });
  box.addEventListener("touchend", end); box.addEventListener("touchcancel", end);
  box.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.target.closest(".grab")) { start(e.clientY); box.setPointerCapture(e.pointerId); } });
  box.addEventListener("pointermove", e => { if (e.pointerType === "mouse") move(e.clientY); });
  box.addEventListener("pointerup", e => { if (e.pointerType === "mouse") end(); });
}

/* ── toast ── */
let toastTimer = null, undoFn = null;
export function toast(msg, undo) {
  const t = $("#toast");
  $("#toastMsg").textContent = msg;
  undoFn = typeof undo === "function" ? undo : null;
  $("#toastUndo").hidden = !undoFn;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove("on"); undoFn = null; }, undoFn ? 6000 : 3200);
}
export function initToast() {
  $("#toastUndo").addEventListener("click", () => { const fn = undoFn; undoFn = null; $("#toast").classList.remove("on"); if (fn) fn(); });
}

/* ── confirm as a sheet; resolves true/false ── */
export function confirmSheet(title, body, okText, danger) {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (done) return; done = true; closeSheet(); res(v); };
    openSheet(title,
      body ? h("p.hint", { style: { marginTop: 0, marginBottom: "16px", fontSize: "14.5px" } }, body) : null,
      h("button.btn", { type: "button", style: danger ? { background: "var(--coral)", color: "#fff" } : null, onclick: () => finish(true) }, okText || "OK"),
      h("button.btn.ghost", { type: "button", onclick: () => finish(false) }, "Cancel"));
    onSheetClose(() => { if (!done) { done = true; res(false); } });
  });
}

/* ── theme ── */
const ACCENTS = { jade: "--jade", cyan: "--cyan", violet: "--violet", amber: "--amber", pink: "--pink" };
export function applyTheme() {
  if (S.theme !== "coral") S.theme = "midnight";
  if (!ACCENTS[S.accent]) S.accent = "jade";
  const root = document.documentElement;
  root.dataset.theme = S.theme;
  root.style.setProperty("--accent", "var(" + ACCENTS[S.accent] + ")");
  root.style.setProperty("--on-accent", S.theme === "coral" ? "#fff" : S.accent === "violet" || S.accent === "pink" ? "#12051A" : "#04130E");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", S.theme === "coral" ? "#F6F3EF" : "#07141B");
}

/* ── form helpers ── */
export function field(label, input, hint) {
  const id = input.id || (input.id = "f" + Math.random().toString(36).slice(2, 8));
  return h("div.field", h("label", { for: id }, label), input, hint ? h("p.hint", hint) : null);
}
export function options(list, selected, none) {
  const out = [];
  if (none != null) out.push(h("option", { value: "" }, none));
  list.forEach(o => { const v = typeof o === "object" ? o.value : o, l = typeof o === "object" ? o.label : o; out.push(h("option", { value: v, selected: v === selected }, l)); });
  return out;
}
export const selectEl = (id, list, selected, none) => h("select", { id }, options(list, selected, none));
export const accountOptions = (selected, none) => options(S.accounts.map(a => ({ value: a.id, label: a.name })), selected, none == null ? "No account" : none);
export const envelopeOptions = selected => options(S.cats.map(c => ({ value: c.id, label: c.name })), selected);
export const moneyInput = (id, cents, ph) => h("input", { id, type: "text", inputmode: "decimal", placeholder: ph || "0.00", value: cents ? (cents / 100).toFixed(2) : "", autocomplete: "off" });
export function toggleRow(id, checked, title, sub) {
  return h("label.toggle", h("input", { id, type: "checkbox", checked: !!checked }), h("span", h("b", title), sub ? h("small", sub) : null));
}
export const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };
export const checked = id => { const e = document.getElementById(id); return !!(e && e.checked); };
export function badge(iconName, color, round) { return h("span.badge" + (round ? ".round" : ""), { style: { color: color || "var(--accent)" }, html: icon(iconName) }); }
export { esc };
