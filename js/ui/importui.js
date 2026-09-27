/* Budget Margin 4 — screens for bringing money in: pasted bank alerts, receipt photos,
   bank statements (CSV/PDF), the month-end check and the one-time historical import. */
import { h, $, icon, money, rmf, curMoney, dateShort, iso, today, toCents, esc } from "../util.js";
import { S, save } from "../state.js";
import * as C from "../calc.js";
import * as I from "../imports.js";
import * as AI from "../ai.js";
import { openSheet, closeSheet, toast, confirmSheet, field, options, accountOptions, envelopeOptions, moneyInput, toggleRow, val, checked, badge } from "./core.js";

let go = () => { };
export const initImportUI = nav => (go = nav);
const aiNeeded = what => h("div.note", h("b", "Needs AI assist"), what + " Turn it on in Settings → AI assist.", h("div", { style: { marginTop: "10px" } }, h("button.btn.sm", { type: "button", onclick: () => { closeSheet(); go("settings", "ai"); } }, "Open AI settings")));

/* ═════════ pasted bank alerts → capture inbox ═════════ */
export async function pasteNotification() {
  let raw = "";
  try { raw = await navigator.clipboard.readText(); } catch (e) { toast("Allow clipboard access, then tap Paste alert again"); return; }
  const c = I.parseClipboardCapture(raw);
  if (!c) { toast("The clipboard is empty"); return; }
  if (!(c.amount > 0) && !AI.aiOn()) { toast("No payment amount found in the copied text"); return; }
  const fp = I.captureFingerprint(c), existing = S.captures.find(x => x.fingerprint === fp && x.status === "pending");
  if (existing) { openCapture(existing.id); toast("Already waiting for confirmation"); return; }
  c.fingerprint = fp;
  if (AI.aiOn()) {
    openSheet("Reading the alert…", h("div.empty", h("div.typing", h("i"), h("i"), h("i")), h("div", { style: { marginTop: "8px" } }, "AI is reading the copied text")));
    try { I.mergeAiReading(c, await AI.readNotification(raw)); } catch (e) { c.aiFailed = AI.aiErr(e); }
  }
  const r = I.addCapture(c);
  if (r === "noamount") { closeSheet(); toast(c.aiFailed ? "No payment found (AI: " + c.aiFailed + ")" : "No payment amount found in the copied text"); return; }
  if (r === "duplicate") { closeSheet(); toast("That alert is already in the inbox"); return; }
  save(); openCapture(c.id);
}
/* from an iOS Shortcut: #capture=1&text=…&app=… */
export function handleCaptureURL() {
  const raw = (location.hash || "").replace(/^#/, "");
  if (!raw.includes("capture=")) return false;
  const p = new URLSearchParams(raw);
  if (p.get("capture") !== "1") return false;
  const c = I.parseNotificationText(p.get("text") || p.get("body") || "", { app: p.get("app") || p.get("source") || "", merchant: p.get("merchant") || "", amount: p.get("amount") || p.get("amt") || "", cur: p.get("cur") || "", timestamp: p.get("timestamp") || "" });
  history.replaceState && history.replaceState({}, "", location.pathname + location.search);
  const r = I.addCapture(c);
  if (r === "added") { save(); toast("Payment added to your inbox"); if (AI.aiOn()) AI.readNotification(c.raw).then(a => { I.mergeAiReading(c, a); save(); }).catch(() => { }); }
  else toast(r === "duplicate" ? "That alert is already in the inbox" : "No payment amount found in that alert");
  return r === "added";
}
export function openInbox() {
  const list = I.pendingCaptures();
  if (!list.length) { toast("Nothing waiting"); return; }
  openSheet("To confirm",
    h("div.card.flush.rows", list.map(c => h("button.row", { type: "button", onclick: () => openCapture(c.id) },
      h("span.badge", { style: { color: "var(--amber)", fontSize: "11px", fontWeight: 800 } }, String(c.app || "BANK").replace(/\s+.*/, "").slice(0, 4).toUpperCase()),
      h("div.txt", h("div.t1", c.merchant || "Unknown merchant"), h("div.t2", (c.account ? C.accountName(c.account) : "No account") + " · " + dateShort((c.timestamp || "").slice(0, 10) || iso(today())))),
      h("div.val.tab", c.cur === "MYR" ? rmf(c.amount) : money(c.amount))))),
    h("button.btn.ghost", { type: "button", onclick: async () => { if (await confirmSheet("Ignore all " + list.length + "?", "They'll be removed from the inbox.", "Ignore all", true)) { list.forEach(c => (c.status = "ignored")); save(); } } }, "Ignore all"));
}
const TYPE_LABEL = { refund: "a refund", transfer: "a transfer", card_payment: "a credit-card payment", income: "money coming in" };
export function openCapture(id) {
  const c = S.captures.find(x => x.id === id); if (!c) return;
  const cat = c.cat || C.ruleCategory(c.merchant || c.raw) || (S.cats[0] || {}).id || "";
  const fmt = v => (c.cur === "MYR" ? rmf(v) : money(v));
  const notes = [];
  if (c.aiFailed) notes.push(h("p.hint", "AI couldn't read this one (" + c.aiFailed + "), so this is the built-in reading."));
  if (TYPE_LABEL[c.aiType]) notes.push(h("div.note.warn", h("b", "This looks like " + TYPE_LABEL[c.aiType]), "Record it as money movement so it doesn't count as spending."));
  if (c.aiWarn) notes.push(h("div.note.warn", h("b", "Check the currency"), c.aiWarn));
  if (c.regexAmount) notes.push(h("p.hint", "AI read " + fmt(c.amount) + "; the built-in reader saw " + fmt(c.regexAmount) + ". Check against the alert."));
  const movement = TYPE_LABEL[c.aiType];
  const confirmBtn = h("button.btn" + (movement ? ".soft" : ""), { type: "button", onclick: () => {
    const aid = val("capAcc"), catid = val("capCat"), name = (val("capM") || c.merchant || "Unknown merchant").trim();
    const t = C.makeTxn({ amount: c.amount, cur: c.cur, cat: catid, note: name, account: aid, date: (c.timestamp || iso(today())).slice(0, 10), source: "notification", extra: { merchantRaw: c.rawMerchant || c.merchant, captureId: c.id } });
    S.txns.push(t);
    if (checked("capRem")) C.rememberRule(c.rawMerchant || c.merchant, catid, name);
    if (aid) S.defaultAccount = aid;
    c.status = "confirmed"; c.merchant = name;
    closeSheet(); save(); toast("Logged " + fmt(c.amount) + " · " + C.catName(catid), () => { S.txns = S.txns.filter(x => x !== t); c.status = "pending"; save(); });
  } }, "Confirm spending");
  const moveBtn = h("button.btn" + (movement ? "" : ".soft"), { type: "button", onclick: () => openCaptureMovement(c) }, c.aiType === "refund" ? "Record as refund" : c.aiType === "income" ? "Record as money in" : "Transfer or card payment");
  openSheet("Confirm payment",
    ...notes,
    h("div.big-amt.tab", { style: { textAlign: "center" } }, fmt(c.amount)),
    h("p.hint", { style: { textAlign: "center", marginTop: 0, marginBottom: "14px" } }, (c.app || "Alert") + " · " + dateShort((c.timestamp || "").slice(0, 10) || iso(today())), c.ai ? h("span", " ", h("span.pill", "Read by AI")) : null),
    field("Merchant", h("input", { id: "capM", value: c.merchant || "", autocomplete: "off" })),
    h("div.field", h("label", { for: "capCat" }, "Envelope ", c.aiCat && cat === c.cat ? h("span.pill", "AI suggestion") : null), h("select", { id: "capCat" }, envelopeOptions(cat))),
    S.accounts.length ? field("Paid from", h("select", { id: "capAcc" }, accountOptions(c.account || S.defaultAccount || "", "Unassigned"))) : null,
    toggleRow("capRem", true, "Remember this merchant", "Next time it gets this name and envelope automatically."),
    movement ? [moveBtn, confirmBtn] : [confirmBtn, moveBtn],
    h("button.btn.ghost", { type: "button", onclick: () => { c.status = "ignored"; closeSheet(); save(); toast("Ignored", () => { c.status = "pending"; save(); }); } }, "Ignore"));
}
function openCaptureMovement(c) {
  if (!S.accounts.length) { toast("Add your accounts first (Plan → Accounts)"); return; }
  const types = [["transfer", "Transfer between my accounts"], ["card_payment", "Credit-card payment"], ["refund", "Refund (money back)"], ["income", "Money in"], ["expense", "Fee / outside envelopes"]];
  const other = h("div#cmOtherF", field("Other account", h("select", { id: "cmTo" }, accountOptions("", "Choose"))));
  const sync = () => { const t = val("cmType"); other.hidden = !(t === "transfer" || t === "card_payment"); };
  openSheet("Record money movement",
    h("p.hint", { style: { marginTop: 0 } }, (c.merchant || "") + " · " + (c.cur === "MYR" ? rmf(c.amount) : money(c.amount))),
    field("Type", h("select", { id: "cmType", onchange: sync }, options(types.map(([v, l]) => ({ value: v, label: l })), TYPE_LABEL[c.aiType] ? c.aiType : "transfer"))),
    field("Account", h("select", { id: "cmFrom" }, accountOptions(c.account || S.defaultAccount || "", "Choose"))),
    other,
    h("button.btn", { type: "button", onclick: () => {
      const t = val("cmType"), from = val("cmFrom"), to = val("cmTo"), multi = t === "transfer" || t === "card_payment";
      if (!from) { toast("Choose the account"); return; }
      if (multi && !to) { toast("Choose the other account"); return; }
      const x = { id: "l" + Date.now(), type: t, amount: c.amount, cur: c.cur, date: (c.timestamp || iso(today())).slice(0, 10), note: c.merchant, createdAt: Date.now(), source: "notification", captureId: c.id, account: multi ? "" : from, from: multi ? from : "", to: multi ? to : "" };
      if (c.cur === "MYR") x.rate = S.rate || 3.35;
      S.ledger.push(x); c.status = "confirmed"; closeSheet(); save(); toast("Saved", () => { S.ledger = S.ledger.filter(z => z !== x); c.status = "pending"; save(); });
    } }, "Save"),
    h("button.btn.ghost", { type: "button", onclick: () => openCapture(c.id) }, "Back"));
  sync();
}

/* ═════════ receipt photo ═════════ */
export function pickReceipt() {
  if (!AI.aiOn()) { openSheet("Scan a receipt", h("p.hint", { style: { marginTop: 0, marginBottom: "12px" } }, "Take a photo of a receipt and Budget Margin fills in the merchant, date, total and envelope for you to check."), aiNeeded("Reading photos uses AI.")); return; }
  const input = $("#fileReceipt"); input.value = ""; input.click();
}
/* shrink to ~1280px JPEG on the phone before sending */
export function shrinkImage(file, max = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), hh = Math.round(img.naturalHeight * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = hh; cv.getContext("2d").drawImage(img, 0, 0, w, hh);
      URL.revokeObjectURL(url); resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't an image the phone can open")); };
    img.src = url;
  });
}
export async function handleReceiptFile(file) {
  if (!file) return;
  let dataUrl;
  try { dataUrl = await shrinkImage(file); } catch (e) { toast(e.message); return; }
  openSheet("Reading receipt…", h("img.receipt-img", { src: dataUrl, alt: "Receipt photo" }), h("div.empty", h("div.typing", h("i"), h("i"), h("i")), h("div", { style: { marginTop: "8px" } }, "This can take up to 30 seconds")));
  let r;
  try { r = await AI.readReceipt(dataUrl); } catch (e) { openSheet("Couldn't read the receipt", h("img.receipt-img", { src: dataUrl, alt: "" }), h("p.note.warn", "AI error: " + AI.aiErr(e)), h("button.btn", { type: "button", onclick: pickReceipt }, "Try another photo"), h("button.btn.soft", { type: "button", onclick: () => { closeSheet(); } }, "Close")); return; }
  if (r.notReceipt) { openSheet("That doesn't look like a receipt", h("img.receipt-img", { src: dataUrl, alt: "" }), h("button.btn", { type: "button", onclick: pickReceipt }, "Try another photo")); return; }
  confirmReceipt(r, dataUrl);
}
function confirmReceipt(r, dataUrl) {
  const cat = C.ruleCategory(r.merchant) || r.cat || S.lastCat || (S.cats[0] || {}).id;
  const dup = S.txns.find(t => t.date === r.date && Math.abs((t.cur === r.cur ? t.orig : t.sgd) - r.total) <= 1);
  openSheet("Check and save",
    h("img.receipt-img", { src: dataUrl, alt: "Receipt photo" }),
    r.foreign ? h("div.note.warn", h("b", "Receipt is in " + r.foreign), "Enter what you were actually charged in SGD or MYR.") : null,
    dup ? h("div.note.warn", h("b", "Possible duplicate"), "You already logged " + money(dup.sgd) + " on " + dateShort(dup.date) + (dup.note ? " (" + dup.note + ")" : "") + ".") : null,
    r.itemsTieOut === false ? h("p.note.warn", "The items don't add up to the total. Check the total against the photo.") : null,
    h("p.hint", { style: { marginTop: 0 } }, h("span.pill" + (r.confidence === "low" ? ".warn" : ""), "Read by AI · " + r.confidence + " confidence"), " Check the total before saving."),
    h("div.two", field("Total", moneyInput("rcA", r.total)), field("Currency", h("select", { id: "rcC" }, options(["SGD", "MYR"], r.cur)))),
    h("div.two", field("Date", h("input", { id: "rcD", type: "date", value: r.date || iso(today()), max: iso(today()) })), S.accounts.length ? field("Paid from", h("select", { id: "rcAcc" }, accountOptions(S.defaultAccount, "Unassigned"))) : h("span")),
    field("Merchant", h("input", { id: "rcM", value: r.merchant, autocomplete: "off" })),
    h("div.field", h("label", { for: "rcCat" }, "Envelope ", r.cat && cat === r.cat && !C.ruleCategory(r.merchant) ? h("span.pill", "AI suggestion") : null), h("select", { id: "rcCat" }, envelopeOptions(cat))),
    r.items.length ? h("details", h("summary.small.dim", { style: { margin: "0 2px 8px", cursor: "pointer" } }, r.items.length + " items read"), h("div.items", r.items.map(i => h("div", h("span", i.name), h("span.tab", curMoney(i.amount, r.cur)))))) : null,
    toggleRow("rcRem", true, "Remember this merchant's envelope"),
    h("button.btn", { type: "button", onclick: () => {
      const amt = toCents(val("rcA")); if (!(amt > 0)) { toast("Enter the total"); return; }
      const name = val("rcM").trim(), cid = val("rcCat"), aid = val("rcAcc");
      const t = C.makeTxn({ amount: amt, cur: val("rcC"), cat: cid, note: name, account: aid, date: val("rcD") || iso(today()), source: "receipt", extra: r.items.length ? { items: r.items.slice(0, 30) } : null });
      S.txns.push(t); S.lastCat = cid; if (aid) S.defaultAccount = aid;
      if (checked("rcRem") && name) C.rememberRule(name, cid);
      closeSheet(); save(); toast("Saved " + money(t.sgd) + " · " + C.catName(cid), () => { S.txns = S.txns.filter(x => x !== t); save(); });
    } }, "Save spending"),
    h("button.btn.ghost", { type: "button", onclick: pickReceipt }, "Retake"));
}

/* ═════════ statements ═════════ */
let stage = null;
export function pickStatement() { const input = $("#fileStatement"); input.value = ""; input.click(); }
export async function handleStatementFile(file) {
  if (!file) return;
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    openSheet("Reading PDF…", h("div.empty", h("div.typing", h("i"), h("i"), h("i")), h("div", { style: { marginTop: "8px" } }, file.name)));
    let lines;
    try { lines = await I.extractPdfLines(file); } catch (e) { openSheet("Couldn't open the PDF", h("p.note.warn", String(e.message || e)), h("p.hint", "CSV exports work fully offline.")); return; }
    const rows = I.pdfLinesToRows(lines);
    if (rows.length) pdfConfirm(file.name, rows, lines, false);
    else if (AI.aiOn()) aiPdf(file.name, lines);
    else openSheet("This PDF needs AI", h("p.hint", { style: { marginTop: 0, marginBottom: "12px" } }, lines.length ? "Text was found, but the built-in reader doesn't recognise this bank's layout." : "No text was found. Scanned (photo) PDFs can't be read."), lines.length ? aiNeeded("AI can read most statement layouts.") : null);
    return;
  }
  const text = await file.text();
  let rows; try { rows = I.parseCsv(text); } catch (e) { toast("Couldn't read that file"); return; }
  if (rows.length < 2) { toast("That file has no transaction rows"); return; }
  csvMapping(file.name, I.prepareStatement(rows));
}
async function aiPdf(name, lines) {
  openSheet("AI is reading the statement…", h("div.empty", h("div.typing", h("i"), h("i"), h("i")), h("div", { style: { marginTop: "8px" } }, "Long statements can take up to a minute")));
  try {
    const rows = await AI.readStatement(lines);
    if (!rows.length) { openSheet("No transactions found", h("p.hint", "AI couldn't find transactions in this PDF.")); return; }
    pdfConfirm(name, rows, lines, true);
  } catch (e) { openSheet("AI couldn't read it", h("p.note.warn", AI.aiErr(e))); }
}
function pdfConfirm(name, rows, lines, viaAI) {
  const cur = rows.cur || "", fmt = v => (cur === "MYR" ? rmf(v) : money(v)), chk = rows.check || {};
  const out = rows.reduce((s, r) => s + (r.out || 0), 0), inc = rows.reduce((s, r) => s + (r.inc || 0), 0);
  const tie = chk.out != null || chk.inc != null ? (chk.out == null || chk.out === out) && (chk.inc == null || chk.inc === inc) : null;
  openSheet("Statement found",
    h("p.hint", { style: { marginTop: 0 } }, name + " · " + rows.length + " transactions" + (viaAI ? " read by AI" : "") + (chk.dropped ? " · " + chk.dropped + " discarded because their amounts aren't in the PDF" : "")),
    tie === true ? h("p.note.good", "The rows add up to the statement's own totals.") : tie === false ? h("div.note.warn", h("b", "Totals don't match the statement"), "Some rows may be missing or misread. Review carefully.") : null,
    h("div.card.tight", { style: { margin: "12px 0" } }, h("div.kv",
      h("div", h("span", "Money out"), h("b.tab", fmt(out)), chk.out != null ? h("span", "statement says " + fmt(chk.out)) : null),
      h("div", h("span", "Money in"), h("b.tab", fmt(inc)), chk.inc != null ? h("span", "statement says " + fmt(chk.inc)) : null))),
    field("Which account is this?", h("select", { id: "pdfAcc" }, accountOptions(S.defaultAccount || "", S.accounts.length ? "Choose" : "Add an account first"))),
    h("button.btn", { type: "button", onclick: () => { const a = val("pdfAcc"); if (!a) { toast(S.accounts.length ? "Choose the account" : "Add an account under Plan → Accounts first"); return; } startReview(I.analyzeStatement(name, a, rows, viaAI ? "pdf-ai" : "pdf", cur)); } }, "Compare with Budget Margin"),
    !viaAI && AI.aiOn() ? h("button.btn.soft", { type: "button", onclick: () => aiPdf(name, lines) }, "Rows look wrong? Read with AI") : null);
}
function csvMapping(name, prep) {
  const hs = prep.headers.map((x, i) => ({ value: String(i), label: x || "Column " + (i + 1) }));
  const sel = (id, v, none) => h("select", { id }, options(hs, String(v), none));
  openSheet("Import statement",
    h("p.hint", { style: { marginTop: 0 } }, name + " · " + (prep.rows.length - 1) + " rows" + (prep.meta.currency ? " · " + prep.meta.currency : "") + ". Check the columns once."),
    field("Account", h("select", { id: "siAcc" }, accountOptions(prep.suggested, S.accounts.length ? "Choose" : "Add an account first"))),
    h("div.two", field("Date", sel("siDate", prep.guess.date, "Choose")), field("Description", sel("siDesc", prep.guess.desc, "None"))),
    field("Date format", h("select", { id: "siFmt" }, options([{ value: "auto", label: "Auto (day first)" }, { value: "dmy", label: "DD-MM-YYYY" }, { value: "mdy", label: "MM-DD-YYYY" }], "auto"))),
    h("div.two", field("Money out", sel("siDebit", prep.guess.debit, "Not used")), field("Money in", sel("siCredit", prep.guess.credit, "Not used"))),
    h("details", h("summary.small.dim", { style: { margin: "0 2px 10px", cursor: "pointer" } }, "Single +/- amount column instead"),
      h("div.two", field("Amount", sel("siAmt", prep.guess.debit >= 0 || prep.guess.credit >= 0 ? -1 : prep.guess.amount, "Not used")), field("Negative means", h("select", { id: "siSign" }, options([{ value: "negative", label: "Money out" }, { value: "positive", label: "Money in" }], "negative"))))),
    h("button.btn", { type: "button", onclick: () => {
      const n = id => (val(id) === "" ? -1 : +val(id));
      const map = { date: n("siDate"), desc: n("siDesc"), amount: n("siAmt"), debit: n("siDebit"), credit: n("siCredit"), fmt: val("siFmt"), sign: val("siSign") };
      const aid = val("siAcc");
      if (!aid) { toast(S.accounts.length ? "Choose the account" : "Add an account under Plan → Accounts first"); return; }
      if (map.date < 0) { toast("Choose the date column"); return; }
      if (map.amount < 0 && map.debit < 0) { toast("Choose a money-out or amount column"); return; }
      const rows = I.mapStatementRows(prep.rows, map);
      if (!rows.length) { toast("No usable rows with those columns"); return; }
      startReview(I.analyzeStatement(name, aid, rows, "csv", prep.meta.currency));
    } }, "Compare with Budget Margin"));
}
async function startReview(st) {
  stage = st;
  const needs = st.unmatched.filter(u => u.out && !u.suggested && u.desc);
  if (AI.aiOn() && needs.length) {
    openSheet("Suggesting envelopes…", h("div.empty", h("div.typing", h("i"), h("i"), h("i")), h("div", { style: { marginTop: "8px" } }, "Only merchant names are sent")));
    try { const map = await AI.suggestEnvelopes(needs.map(u => u.desc)); needs.forEach(u => { if (map[u.desc]) { u.suggested = map[u.desc]; u.aiSuggested = true; } }); }
    catch (e) { toast("Envelope suggestions skipped: " + AI.aiErr(e)); }
  }
  reviewSummary();
}
const pendingRows = () => (stage ? stage.unmatched.filter(r => r.status === "pending") : []);
function reviewSummary() {
  const st = stage; if (!st) return;
  const fmt = v => (st.cur === "MYR" ? rmf(v) : money(v, false)), gap = st.outflow - st.logged, pend = pendingRows();
  const c = st.check, tie = c && (c.out != null || c.inc != null) ? (c.out == null || c.out === st.outflow) && (c.inc == null || c.inc === st.inflow) : null;
  openSheet("Statement check",
    h("p.hint", { style: { marginTop: 0 } }, C.accountName(st.account) + " · " + dateShort(st.first) + " – " + dateShort(st.last) + (st.cur === "MYR" ? " · in ringgit" : "") + (st.source === "pdf-ai" ? " · read by AI" : "")),
    h("div.score", h("div.metric", h("span", "Matched"), h("b", String(st.matched.length))), h("div.metric", h("span", "To review"), h("b", String(pend.length))), h("div.metric", h("span", "Difference"), h("b.tab" + (gap ? ".bad" : ""), (gap < 0 ? "-" : "") + fmt(Math.abs(gap))))),
    tie === false ? h("div.note.warn", h("b", "Totals don't tie out"), "The rows don't add up to the statement's printed totals, so some may be missing or misread.") : null,
    h("div.card.tight", { style: { margin: "12px 0" } }, h("div.kv",
      h("div", h("span", "Statement money out"), h("b.tab", fmt(st.outflow))), h("div", h("span", "Logged in Budget Margin"), h("b.tab", fmt(st.logged))),
      h("div", h("span", "Statement money in"), h("b.tab", fmt(st.inflow))), h("div", h("span", "Added / ignored"), h("b", (st.added || 0) + " / " + (st.ignored || 0))))),
    pend.length ? [h("p.hint", pend.length + " statement rows aren't in Budget Margin yet. Nothing is added until you approve it."), h("button.btn", { type: "button", onclick: reviewNext }, "Review " + pend.length + " rows")] : h("p.note.good", "Every row is accounted for."),
    h("button.btn.soft", { type: "button", onclick: () => {
      const label = dateShort(st.first) + " – " + dateShort(st.last), left = pendingRows().length;
      S.recs.push({ p: st.first, label, logged: st.logged, actual: st.outflow, cur: st.cur, source: st.source, account: st.account, matched: st.matched.length, missing: left, file: st.name });
      S.imports.push({ id: "i" + Date.now(), date: iso(today()), label, account: st.account, cur: st.cur, matched: st.matched.length, missing: left, difference: st.outflow - st.logged, file: st.name, source: st.source, added: st.added || 0, ignored: st.ignored || 0 });
      stage = null; closeSheet(); save(); toast("Check saved");
    } }, "Save this check"),
    h("button.btn.ghost", { type: "button", onclick: () => { stage = null; closeSheet(); } }, "Close without saving"));
}
function reviewNext() {
  const st = stage, p = pendingRows(); if (!st || !p.length) { reviewSummary(); return; }
  const r = p[0], out = !!r.out, amt = r.out || r.inc, cat = r.suggested || S.lastCat || (S.cats[0] || {}).id;
  const next = () => { save({ silent: true }); pendingRows().length ? reviewNext() : reviewSummary(); };
  openSheet("Review " + (st.unmatched.length - p.length + 1) + " of " + st.unmatched.length,
    h("div", { style: { textAlign: "center", marginBottom: "14px" } }, h("div.t1", { style: { fontWeight: 650 } }, r.desc || "No description"), h("div.big-amt.tab" + (out ? "" : ".good"), (out ? "-" : "+") + (st.cur === "MYR" ? rmf(amt) : money(amt))), h("div.small.dim", dateShort(r.date) + " · " + C.accountName(st.account))),
    out ? [h("div.field", h("label", { for: "rvCat" }, "Envelope ", r.aiSuggested ? h("span.pill", "AI suggestion") : null), h("select", { id: "rvCat" }, envelopeOptions(cat))),
      toggleRow("rvRem", true, "Remember this merchant"),
      h("button.btn", { type: "button", onclick: () => { const c = val("rvCat"); S.txns.push(I.statementTxn(st, r, c)); if (checked("rvRem")) C.rememberRule(r.desc, c); r.status = "added"; st.added++; st.logged += r.out; next(); } }, "Add as spending")]
      : h("button.btn", { type: "button", onclick: () => { const x = I.statementLedger(st, "income", r.inc, r); x.account = st.account; S.ledger.push(x); r.status = "added"; st.added++; next(); } }, "Add as money in"),
    h("button.btn.soft", { type: "button", onclick: () => reviewMovement(r) }, "Transfer, card payment or refund"),
    h("div.btn-row", { style: { marginTop: "8px" } }, h("button.btn.ghost", { type: "button", onclick: () => { r.status = "ignored"; st.ignored++; next(); } }, "Ignore"), h("button.btn.ghost", { type: "button", onclick: reviewSummary }, "Summary")));
}
function reviewMovement(r) {
  const st = stage, aid = st.account;
  openSheet("Classify",
    h("p.hint", { style: { marginTop: 0 } }, (r.desc || "") + " · " + (st.cur === "MYR" ? rmf(r.out || r.inc) : money(r.out || r.inc))),
    field("Type", h("select", { id: "rvtT" }, options([{ value: "transfer", label: "Transfer between my accounts" }, { value: "card_payment", label: "Credit-card payment" }, { value: "refund", label: "Refund" }, { value: "expense", label: "Bank fee / outside envelopes" }], r.out ? "transfer" : "refund"))),
    field("Other account (transfers and card payments)", h("select", { id: "rvtO" }, accountOptions("", "Choose"))),
    h("button.btn", { type: "button", onclick: () => {
      const t = val("rvtT"), o = val("rvtO"), x = I.statementLedger(st, t, r.out || r.inc, r);
      if (t === "transfer" || t === "card_payment") { if (!o) { toast("Choose the other account"); return; } if (r.out) { x.from = aid; x.to = o; } else { x.from = o; x.to = aid; } } else x.account = aid;
      S.ledger.push(x); r.status = "added"; st.added++; if (r.out && t === "expense") st.logged += r.out;
      save({ silent: true }); pendingRows().length ? reviewNext() : reviewSummary();
    } }, "Save"),
    h("button.btn.ghost", { type: "button", onclick: reviewNext }, "Back"));
}

/* ═════════ month-end check (manual total) ═════════ */
export function monthCheck(lp) {
  const k = iso(lp), next = C.pShift(lp, 1), logged = C.spent(lp, next);
  openSheet("Check " + C.pLabel(lp),
    h("p.hint", { style: { marginTop: 0 } }, "Importing a statement matches entries one by one (Plan → Overview). Or just enter the total spending your accounts show for this period, leaving out loans, allowances and insurance."),
    h("div.card.tight", { style: { margin: "12px 0" } }, h("div.kv", h("div", h("span", "You logged"), h("b.tab", money(logged, false))))),
    field("Your accounts show", moneyInput("mcA", 0)),
    h("button.btn", { type: "button", onclick: () => {
      const a = toCents(val("mcA")); if (!(a > 0)) { toast("Enter the total your accounts show"); return; }
      S.recs.push({ p: k, logged, actual: a }); closeSheet(); save();
      const gap = a - logged; toast(gap > 0 ? money(gap, false) + " never got logged" : gap < 0 ? "You logged " + money(-gap, false) + " more than you spent" : "Spot on");
    } }, "Save"),
    h("button.btn.soft", { type: "button", onclick: pickStatement }, "Import a statement instead"),
    h("button.btn.ghost", { type: "button", onclick: () => { S.recs.push({ p: k, logged, actual: logged, skipped: true }); closeSheet(); save(); } }, "Skip this period"));
}

/* ═════════ historical migration ═════════ */
export function pickHistorical() { const input = $("#fileHistorical"); input.value = ""; input.click(); }
export async function handleHistoricalFile(file, uidFn) {
  if (!file) return;
  const p = I.previewHistorical(await file.text());
  if (p.error) { toast(p.error); return; }
  openSheet("Historical import",
    h("p.hint", { style: { marginTop: 0 } }, file.name + " will be added as history. It's meant as a one-time migration."),
    h("div.score", h("div.metric", h("span", "Rows"), h("b", String(p.data.length))), h("div.metric", h("span", "Accounts"), h("b", String(p.accounts))), h("div.metric", h("span", "Mode"), h("b", "Merge"))),
    h("p.note", "Your existing entries are kept. History fills Activity and Insights but doesn't change today's account balances. Importing the same file twice is blocked."),
    h("button.btn", { type: "button", style: { marginTop: "12px" }, onclick: () => { const r = I.importHistorical(p.data, p.idx, file.name, uidFn); if (r.error) { toast(r.error); return; } closeSheet(); save(); toast(r.spending + r.ledger + " records imported"); } }, "Import history"));
}
