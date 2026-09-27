/* Budget Margin 4 — small shared helpers: money, dates, DOM, icons. No app state in here. */

export const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ── money (all amounts are integer cents) ── */
export const grp = s => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export function money(c, dec) {
  const v = Math.abs(Math.round(c || 0));
  return (c < 0 ? "-" : "") + "S$" + (dec === false ? grp(Math.round(v / 100)) : grp((v / 100).toFixed(2)));
}
export const rmf = c => (c < 0 ? "-" : "") + "RM" + grp((Math.abs(c || 0) / 100).toFixed(2));
export function curMoney(c, cur, dec) {
  cur = String(cur || "SGD").toUpperCase();
  const v = Math.abs(Math.round(c || 0)), n = dec === false ? grp(Math.round(v / 100)) : grp((v / 100).toFixed(2));
  return (c < 0 ? "-" : "") + (cur === "MYR" ? "RM" : cur === "SGD" ? "S$" : cur + " ") + n;
}
export function toCents(x) {
  const n = parseFloat(String(x ?? "").replace(/[^0-9.]/g, ""));
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100);
}
export const fixed2 = c => ((c || 0) / 100).toFixed(2);

/* ── dates (local calendar days as YYYY-MM-DD) ── */
export const p2 = n => (n < 10 ? "0" + n : "" + n);
export const iso = d => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
export function pIso(s) { const a = String(s).split("-"); return new Date(+a[0], +a[1] - 1, +a[2]); }
export function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const days = (a, b) => Math.round((b - a) / 864e5);
export function dateShort(ds) { const d = pIso(ds); return d.getDate() + " " + MO[d.getMonth()]; }
export function dayLabel(ds) {
  const t = today();
  if (ds === iso(t)) return "Today";
  if (ds === iso(addDays(t, -1))) return "Yesterday";
  const d = pIso(ds);
  return WD[d.getDay()] + " " + d.getDate() + " " + MO[d.getMonth()] + (d.getFullYear() !== t.getFullYear() ? " " + d.getFullYear() : "");
}
export function monthYear(d) { return MO[d.getMonth()] + " " + d.getFullYear(); }

/* ── DOM ── */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
/* h("button.row#id", {onclick, dataset:{}, style:{}, ...attrs}, ...children) — children: string | Node | array | null */
export function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9-]+)((?:[.#][\w-]+)*)$/i) || [0, tag, ""];
  const e = document.createElement(m[1]);
  (m[2].match(/[.#][\w-]+/g) || []).forEach(t => (t[0] === "." ? e.classList.add(t.slice(1)) : (e.id = t.slice(1))));
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k === "html") e.innerHTML = v;
    else if (k === "class") e.className = v;
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else e.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return e;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export function clear(node, ...kids) { node.replaceChildren(); kids.forEach(k => k && node.appendChild(k)); return node; }
export function haptic(ms) { try { navigator.vibrate && navigator.vibrate(ms || 8); } catch (e) { } }
export const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── icons (24px stroke icons) ── */
const P = {
  fork: '<path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10v11M9.5 3v4.5A2.5 2.5 0 0 1 7 10M15 3v8c0 2 1 3 3 3V3v18"/>',
  cart: '<path d="M3 5h2l2 10h10l2-7H6.5"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
  cup: '<path d="M5 7h11v6a5 5 0 0 1-10 0V7Z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2M7 3c0 1 1 1.5 1 2.5M11 3c0 1 1 1.5 1 2.5"/>',
  car: '<path d="M5 16h14l-1-6-2-3H8l-2 3-1 6Z"/><path d="M4 13h16M7 16v2M17 16v2"/><circle cx="8" cy="13" r="1"/><circle cx="16" cy="13" r="1"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  spark: '<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z"/>',
  home: '<path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z"/>',
  heart: '<path d="M20 8.5C20 14 12 20 12 20S4 14 4 8.5A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5Z"/>',
  plane: '<path d="m3 13 18-8-7 15-2-6-9-1Z"/><path d="m12 14 5-5"/>',
  game: '<path d="M7 9h10l3 7a3 3 0 0 1-5 3l-2-2h-2l-2 2a3 3 0 0 1-5-3l3-7Z"/><path d="M8 12v4M6 14h4M16 13h.01M18 15h.01"/>',
  gift: '<path d="M4 10h16v11H4V10ZM3 7h18v4H3V7ZM12 7v14"/><path d="M12 7c-4 0-5-1.5-5-3 0-1 1-2 2.2-2C11 2 12 4.5 12 7Zm0 0c4 0 5-1.5 5-3 0-1-1-2-2.2-2C13 2 12 4.5 12 7Z"/>',
  paw: '<circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="5" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/><path d="M8 18c0-3 1.8-5 4-5s4 2 4 5c0 2-1.7 3-4 3s-4-1-4-3Z"/>',
  dots: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  bank: '<path d="M3 9h18L12 4 3 9Zm2 2h14M6 11v7M10 11v7M14 11v7M18 11v7M3 20h18"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>',
  piggy: '<path d="M5 11a7 6 0 0 1 12-3l3-1-1 4a6 6 0 0 1-2 6v3h-3v-2h-4v2H7v-3a6 6 0 0 1-2-6Z"/><path d="M15 11h.01"/>',
  prepaid: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M12 14v4M10 16h4"/>',
  trend: '<path d="M4 17 10 11l4 4 6-7"/><path d="M15 8h5v5"/>',
  loan: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6M12 9v2"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>',
  clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  file: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  arrowIn: '<path d="M12 4v12M6 10l6 6 6-6M5 20h14"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4V7Z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3M16 13h.01"/>',
  chat: '<path d="M5 5h14v10H9l-4 4V5Z"/><path d="M9 9h6M9 12h4"/>',
  list: '<path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
  send: '<path d="m4 12 16-8-6 16-2-6-8-2Z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M8 10v8M12 10v8M16 10v8M6 7l1 14h10l1-14"/>',
  repeat: '<path d="M8 8H4V4"/><path d="M4.5 8.5A8 8 0 1 1 5 17"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
};
export const ICON_CHOICES = ["fork", "cart", "cup", "car", "bag", "spark", "home", "heart", "plane", "game", "gift", "paw", "dots"];
export const ICON_LABELS = { fork: "Food", cart: "Groceries", cup: "Dining", car: "Transport", bag: "Shopping", spark: "Fun", home: "Home", heart: "Health", plane: "Travel", game: "Games", gift: "Gift", paw: "Pets", dots: "Other" };
export function icon(name, cls) {
  return '<svg class="' + (cls || "ico") + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || P.dots) + "</svg>";
}
export function iconEl(name, cls) { const s = document.createElement("span"); s.className = "ico-wrap"; s.innerHTML = icon(name, cls); return s.firstChild; }

/* safe minimal markdown for chat: **bold**, line breaks, "- " bullets, "1. " lists */
export function miniMarkdown(text) {
  const lines = esc(String(text || "")).split(/\r?\n/);
  let out = "", list = null;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const close = () => { if (list) { out += "</" + list + ">"; list = null; } };
  for (const raw of lines) {
    const l = raw.trim();
    let m;
    if ((m = l.match(/^[-*•]\s+(.*)$/))) { if (list !== "ul") { close(); out += "<ul>"; list = "ul"; } out += "<li>" + inline(m[1]) + "</li>"; }
    else if ((m = l.match(/^\d+[.)]\s+(.*)$/))) { if (list !== "ol") { close(); out += "<ol>"; list = "ol"; } out += "<li>" + inline(m[1]) + "</li>"; }
    else if (!l) { close(); }
    else if ((m = l.match(/^#{1,4}\s+(.*)$/))) { close(); out += "<p><b>" + inline(m[1]) + "</b></p>"; }
    else { close(); out += "<p>" + inline(l) + "</p>"; }
  }
  close();
  return out;
}
