/* Budget Margin 4 — start-up, navigation, service worker and URL entry points. */
import { $, $$, h, icon, haptic, today } from "./util.js";
import { S, onChange, onSaveFail, uid } from "./state.js";
import * as C from "./calc.js";
import { pendingCaptures } from "./imports.js";
import { initSheet, initToast, toast, applyTheme, closeSheet, sheetOpen } from "./ui/core.js";
import { renderHome, initHome } from "./ui/home.js";
import { renderActivity, initActivity } from "./ui/activity.js";
import { renderPlan, initPlan, setPlanTab } from "./ui/plan.js";
import { renderAsk, initAsk, setDraft } from "./ui/ask.js";
import { renderSettings, initSettings, setSettingsPage, setPwa, handleRestoreFile } from "./ui/settings.js";
import { openAdd, openSpend, logSpend, setNavigator, setImportHooks } from "./ui/entry.js";
import * as IU from "./ui/importui.js";

const SCREENS = { home: renderHome, activity: renderActivity, plan: renderPlan, ask: renderAsk, settings: renderSettings };
let current = "home", previous = "home";

function go(view, arg) {
  if (view === "back") view = previous && previous !== "settings" ? previous : "home";
  if (!SCREENS[view]) view = "home";
  if (view === "settings") setSettingsPage(arg || "main");
  if (view === "plan" && arg) setPlanTab(arg);
  if (view === "ask" && arg) setDraft(arg);
  if (view !== current) { if (current !== "settings") previous = current; }
  current = view;
  closeSheet();
  $$(".screen").forEach(s => s.classList.toggle("on", s.id === "s-" + view));
  $$(".tab-btn").forEach(b => b.setAttribute("aria-current", b.dataset.go === view ? "page" : "false"));
  render();
  window.scrollTo(0, 0);
}
function render() {
  const el = $("#s-" + current);
  SCREENS[current](el);
  const n = pendingCaptures().length;
  $("#tabHome").dataset.count = String(n);
}

function boot() {
  applyTheme();
  initSheet(); initToast();
  setNavigator(go); initHome(go, { inbox: IU.openInbox, monthCheck: IU.monthCheck }); initActivity(go); initPlan(go, { statement: IU.pickStatement, monthCheck: IU.monthCheck }); initAsk(go); initSettings(go); IU.initImportUI(go);
  setImportHooks({ receipt: IU.pickReceipt, paste: IU.pasteNotification, statement: IU.pickStatement });
  $$(".tab-btn").forEach(b => b.addEventListener("click", () => { haptic(4); go(b.dataset.go); }));
  $("#fab").addEventListener("click", () => { haptic(6); openAdd(); });
  $("#fileReceipt").addEventListener("change", e => IU.handleReceiptFile(e.target.files && e.target.files[0]));
  $("#fileStatement").addEventListener("change", e => IU.handleStatementFile(e.target.files && e.target.files[0]));
  $("#fileHistorical").addEventListener("change", e => IU.handleHistoricalFile(e.target.files && e.target.files[0], uid));
  $("#fileRestore").addEventListener("change", e => handleRestoreFile(e.target.files && e.target.files[0]));
  onChange(() => { applyTheme(); render(); });
  onSaveFail(() => toast("Storage is blocked, so nothing was saved"));
  // the day may roll over while the app sits in the background
  let lastDay = today().getTime();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && today().getTime() !== lastDay) { lastDay = today().getTime(); render(); } });
  go("home");
  IU.handleCaptureURL();
  handleLogURL();
  registerSW();
}

/* one-tap logging from a Home Screen shortcut: ?log=<envelope id>&amt=<cents>[&cur=MYR] */
function handleLogURL() {
  const p = new URLSearchParams(location.search);
  if (!p.get("log") || !p.get("amt")) return;
  const c = C.catOf(p.get("log")), amt = parseInt(p.get("amt"), 10);
  history.replaceState && history.replaceState({}, "", location.pathname);
  if (c && amt > 0) logSpend(c.id, amt, p.get("cur") === "MYR" ? "MYR" : "SGD", "", S.defaultAccount);
  else toast("That shortcut doesn't match an envelope");
}

function registerSW() {
  const standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  setPwa({ standalone });
  if (!("serviceWorker" in navigator) || !(location.protocol === "https:" || location.hostname === "localhost")) { setPwa({ check: () => toast("Updates work once the app is served over HTTPS") }); return; }
  let reg = null, ready = false;
  const mark = () => { ready = true; setPwa({ updateReady: true }); toast("An update is ready · Settings → Update now"); };
  setPwa({ check: () => {
    if (ready && reg && reg.waiting) { reg.waiting.postMessage({ type: "SKIP_WAITING" }); return; }
    if (!reg) { toast("Update check unavailable"); return; }
    toast("Checking…");
    reg.update().then(() => setTimeout(() => { if (!ready) toast("You have the latest version"); }, 800)).catch(() => toast("Couldn't check for updates"));
  } });
  navigator.serviceWorker.register("./sw.js").then(r => {
    reg = r;
    if (r.waiting && navigator.serviceWorker.controller) mark();
    r.addEventListener("updatefound", () => { const w = r.installing; if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) mark(); }); });
  }).catch(() => { });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (ready) location.reload(); });
}

boot();
