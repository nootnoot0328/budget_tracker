/* Budget Margin 4 — the saved data.
   Same localStorage key and schema as 3.x ("margin.v2"), so 4.0 opens existing data untouched and
   3.7 can still open anything 4.0 writes (new fields are additive and ignored by 3.7). */

export const KEY = "margin.v2", PREV_KEY = "margin.v2.prev", AI_KEY = "margin.ai", CHAT_KEY = "margin.chat";
export const APP_VERSION = "4.1";

const hasLS = (() => { try { return typeof localStorage !== "undefined" && !!localStorage; } catch (e) { return false; } })();
const lsGet = k => { try { return hasLS ? localStorage.getItem(k) : null; } catch (e) { return null; } };
const lsSet = (k, v) => { if (!hasLS) return true; try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

/* Future tab: plan assumptions (engine config, dollars; null = defaults), monthly check-ins (cents),
   ticked actions by month, your own actions, and the one-off setup list */
export const blankFuture = () => ({ cfg: null, checkins: [], done: {}, custom: [], setup: {}, rebase: true });

export function blank() {
  return {
    v: 2, rate: 3.35, startDay: 25, dailyCap: 0, debtPlan: { strategy: "avalanche", monthlyBudget: 0 }, mode: "period",
    accent: "jade", theme: "midnight", historyView: "list", lastExport: null, nextId: 100,
    cats: [
      { id: "c1", name: "Food", icon: "fork", cap: 0, quick: [500, 1000, 2000, 5000] },
      { id: "c2", name: "Groceries", icon: "cart", cap: 0, quick: [1000, 2000, 3000, 5000] },
      { id: "c3", name: "Dining out", icon: "cup", cap: 0, quick: [1500, 3000, 5000, 8000] },
      { id: "c4", name: "Transport", icon: "car", cap: 0, quick: [300, 500, 1000, 2000] },
      { id: "c5", name: "Shopping", icon: "bag", cap: 0, quick: [2000, 5000, 10000, 20000] },
      { id: "c6", name: "Fun", icon: "spark", cap: 0, quick: [1000, 2500, 5000, 10000] },
      { id: "c7", name: "Other", icon: "dots", cap: 0, quick: [500, 1000, 2000, 5000] },
    ],
    debts: [], txns: [], pays: [], recs: [], bookmarks: [], accounts: [], recurring: [], recurringDone: {}, defaultAccount: "",
    ledger: [], goals: [], goalContrib: [], imports: [], merchantRules: {}, merchantAliases: {}, captures: [], historicalImports: [],
    future: blankFuture(),
  };
}

/* Fill in anything missing so older or partial data is always safe to use. Mutates and returns p. */
export function normalize(p) {
  const d = blank();
  for (const k in d) if (!(k in p)) p[k] = d[k];
  const arr = ["cats", "txns", "debts", "pays", "recs", "bookmarks", "accounts", "recurring", "ledger", "goals", "goalContrib", "imports", "captures", "historicalImports"];
  arr.forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
  ["recurringDone", "merchantRules", "merchantAliases"].forEach(k => { if (!p[k] || typeof p[k] !== "object" || Array.isArray(p[k])) p[k] = {}; });
  const icons = ["fork", "cart", "cup", "car", "bag", "spark", "dots"];
  p.cats.forEach((c, i) => { if (!c.icon) c.icon = icons[i % icons.length]; if (c.home == null) c.home = true; if (!Array.isArray(c.quick)) c.quick = [500, 1000, 2000, 5000]; if (c.cap == null) c.cap = 0; });
  if (p.dailyCap == null) p.dailyCap = 0;
  if (!p.debtPlan || typeof p.debtPlan !== "object") p.debtPlan = { strategy: "avalanche", monthlyBudget: 0 };
  if (!p.debtPlan.strategy) p.debtPlan.strategy = "avalanche";
  if (p.debtPlan.monthlyBudget == null) p.debtPlan.monthlyBudget = 0;
  p.debts.forEach(x => { if (x.minPay == null) x.minPay = 0; if (x.start == null) x.start = x.bal || 0; });
  p.accounts.forEach(a => { if (a.baseBalance == null) a.baseBalance = a.balance || 0; if (!a.snapshotAt) a.snapshotAt = Date.now(); });
  if (!p.future || typeof p.future !== "object" || Array.isArray(p.future)) p.future = blankFuture();
  const fb = blankFuture();
  for (const k in fb) if (!(k in p.future)) p.future[k] = fb[k];
  ["checkins", "custom"].forEach(k => { if (!Array.isArray(p.future[k])) p.future[k] = []; });
  ["done", "setup"].forEach(k => { if (!p.future[k] || typeof p.future[k] !== "object" || Array.isArray(p.future[k])) p.future[k] = {}; });
  if (!p.theme) p.theme = "midnight";
  if (!p.accent) p.accent = "jade";
  if (!p.defaultAccount) p.defaultAccount = "";
  if (!(p.rate > 0)) p.rate = 3.35;
  if (!(p.startDay >= 1 && p.startDay <= 28)) p.startDay = 1;
  return p;
}
export function isBackup(p) { return !!(p && Array.isArray(p.txns) && Array.isArray(p.cats)); }

function load() {
  try {
    const r = lsGet(KEY);
    if (!r) return blank();
    const p = JSON.parse(r);
    return isBackup(p) ? normalize(p) : blank();
  } catch (e) { return blank(); }
}

export let S = load();
export function setState(next) { S = normalize(next); }

/* Ringgit entries keep the rate they were logged at, so changing the rate later doesn't rewrite history. */
function stampRates() {
  const r = S.rate || 3.35;
  S.txns.forEach(t => { if (t.cur === "MYR" && !t.rate) t.rate = r; });
  S.ledger.forEach(x => { if (x.cur === "MYR" && !x.rate) x.rate = r; });
}

const listeners = new Set();
export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
let saveFailed = null;
export const onSaveFail = fn => (saveFailed = fn);

/* save() writes and notifies every screen; pass {silent:true} to skip the redraw */
export function save(opts) {
  stampRates();
  const next = JSON.stringify(S), old = lsGet(KEY);
  if (old && old !== next) lsSet(PREV_KEY, old);
  if (!lsSet(KEY, next) && saveFailed) saveFailed();
  if (!(opts && opts.silent)) listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}
export const hasPrevious = () => !!lsGet(PREV_KEY);
export function recoverPrevious() {
  const raw = lsGet(PREV_KEY);
  if (!raw) return false;
  const p = JSON.parse(raw);
  if (!isBackup(p)) return false;
  S = normalize(p);
  lsSet(KEY, JSON.stringify(S));
  listeners.forEach(fn => fn());
  return true;
}
export function replaceAll(p) { S = normalize(p); save(); }
export function wipe() { S = blank(); save(); }
export function uid() { S.nextId = (S.nextId || 100) + 1; return "t" + S.nextId; }
export const newId = p => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

/* ── AI settings: their own key, never part of backups ── */
export const AIC = (() => { try { return JSON.parse(lsGet(AI_KEY) || "{}") || {}; } catch (e) { return {}; } })();
export const saveAIC = () => lsSet(AI_KEY, JSON.stringify(AIC));

/* ── chat history: its own key, capped, never part of backups ── */
export const CHAT = (() => { try { const c = JSON.parse(lsGet(CHAT_KEY) || "[]"); return Array.isArray(c) ? c : []; } catch (e) { return []; } })();
export function saveChat() { while (CHAT.length > 40) CHAT.shift(); lsSet(CHAT_KEY, JSON.stringify(CHAT)); }
export function clearChat() { CHAT.length = 0; saveChat(); }
