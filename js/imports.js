/* Budget Margin 4 — reading things in: bank notifications, CSV/PDF statements, the historical
   migration file and reconciliation matching. Logic only; the screens live in ui/importui.js. */
import { S } from "./state.js";
import { iso, today, pIso, days } from "./util.js";
import * as C from "./calc.js";

/* ── bank notification → capture ── */
export const captureCurrency = s => (/\b(MYR|RM)\b/.test(String(s || "").toUpperCase()) ? "MYR" : "SGD");
export function parseNotificationText(raw, meta) {
  raw = String(raw || "").replace(/\r/g, "").trim(); meta = meta || {};
  const cur = captureCurrency((meta.cur || "") + " " + raw);
  let amount = 0;
  const m = raw.match(cur === "MYR" ? /(?:MYR|RM)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i : /(?:SGD|S\$|\$)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (m) amount = Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
  if (meta.amount) { const x = parseFloat(String(meta.amount).replace(/[^0-9.]/g, "")); if (isFinite(x) && x > 0) amount = Math.round(x * 100); }
  const lines = raw.split(/\n+/).map(x => x.trim()).filter(Boolean);
  let merchant = String(meta.merchant || "").trim();
  if (!merchant) for (const ln of lines) {
    if (/^(DBS|POSB|UOB|HSBC|CIMB|OCBC)\b/i.test(ln) && ln.length < 28) continue;
    if (/(?:SGD|S\$|MYR|RM|\$)\s*[0-9]/i.test(ln)) continue;
    if (/^(payment|transaction|card|spent|charged|purchase)\b/i.test(ln) && ln.length < 35) continue;
    merchant = ln.replace(/,\s*(Singapore|SG).*$/i, "").trim();
    if (merchant) break;
  }
  if (!merchant) merchant = "Unknown merchant";
  const rawMerchant = merchant, app = String(meta.app || meta.source || "").trim();
  let account = "";
  if (app) { const ak = app.toUpperCase(); const hit = S.accounts.find(a => { const n = a.name.toUpperCase(); return n.includes(ak) || ak.includes(n.split(/\s+/)[0]); }); if (hit) account = hit.id; }
  return {
    merchant: C.canonicalMerchant(merchant), rawMerchant, amount, cur, account,
    cat: C.ruleCategory(rawMerchant) || C.ruleCategory(merchant) || C.ruleCategory(raw) || "",
    raw, app: app || "Notification", timestamp: meta.timestamp || new Date().toISOString(), tsFromMeta: !!meta.timestamp,
  };
}
export function parseClipboardCapture(raw) {
  raw = String(raw || "").trim(); if (!raw) return null;
  const meta = { app: "DBS" }; let body = raw;
  if (/^BM_CAPTURE:/i.test(raw)) body = raw.replace(/^BM_CAPTURE:\s*/i, "").trim();
  if (body.charAt(0) === "{") {
    try { const o = JSON.parse(body); meta.app = o.app || o.source || "DBS"; meta.merchant = o.merchant || ""; meta.amount = o.amount || o.amt || ""; meta.cur = o.cur || o.currency || ""; meta.timestamp = o.ts || o.timestamp || ""; body = o.text || o.body || o.message || o.raw || ""; } catch (e) { }
  }
  return parseNotificationText(body, meta);
}
export function captureFingerprint(c) {
  const t = new Date(c.timestamp || Date.now()), bucket = isNaN(t) ? String(c.timestamp || "") : t.toISOString().slice(0, 16);
  return [String(c.app || "").toUpperCase(), C.merchantKey(c.merchant || c.raw), c.cur, c.amount, bucket].join("|");
}
export const pendingCaptures = () => S.captures.filter(c => c.status === "pending");
/* adds to the inbox; returns "added" | "duplicate" | "noamount" */
export function addCapture(c) {
  if (!c || !(c.amount > 0)) return "noamount";
  c.id = c.id || "n" + Date.now(); c.status = "pending"; c.fingerprint = c.fingerprint || captureFingerprint(c); c.createdAt = Date.now();
  if (S.captures.some(x => x.fingerprint === c.fingerprint)) return "duplicate";
  S.captures.unshift(c);
  return "added";
}
/* merge an AI reading (from ai.readNotification) into a capture; the user's aliases and rules win */
export function mergeAiReading(c, a) {
  c.ai = true;
  if (a.amount && a.amount !== c.amount) { c.regexAmount = c.amount; c.amount = a.amount; }
  if (a.cur) c.cur = a.cur;
  if (a.foreign) c.aiWarn = "This notification is in " + a.foreign + ". Budget Margin records SGD or MYR only, so check the amount your bank actually charged.";
  if (a.merchant) {
    const hasAlias = C.canonicalMerchant(c.rawMerchant) !== String(c.rawMerchant || "").trim();
    if (!c.rawMerchant || c.rawMerchant === "Unknown merchant") c.rawMerchant = a.merchant;
    if (!hasAlias) c.merchant = C.canonicalMerchant(a.merchant);
  }
  if (a.type) c.aiType = a.type;
  if (a.date && !c.tsFromMeta && days(pIso(a.date), today()) <= 30) c.timestamp = a.date + "T12:00:00";
  const ruled = C.ruleCategory(c.rawMerchant) || C.ruleCategory(c.merchant);
  if (ruled) c.cat = ruled; else if (a.cat) { c.cat = a.cat; c.aiCat = true; }
  return c;
}

/* ── CSV ── */
export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) { if (c === '"' && n === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ""));
}
export function colGuess(headers, words) {
  const low = headers.map(x => String(x).trim().toLowerCase());
  for (const w of words) { const k = low.findIndex(x => x.includes(w)); if (k >= 0) return k; }
  return -1;
}
const MONS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
export function parseStatementDate(raw, fmt) {
  raw = String(raw || "").trim(); if (!raw) return null;
  let mt = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (mt) return new Date(+mt[1], +mt[2] - 1, +mt[3]);
  mt = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})/);
  if (mt) { const m = MONS[mt[2].slice(0, 3).toLowerCase()]; let y = +mt[3]; if (y < 100) y += 2000; if (m != null) return new Date(y, m, +mt[1]); }
  mt = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (mt) { const m = MONS[mt[1].slice(0, 3).toLowerCase()]; let y = +mt[3]; if (y < 100) y += 2000; if (m != null) return new Date(y, m, +mt[2]); }
  mt = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (!mt) return null;
  const a = +mt[1], b = +mt[2]; let c = +mt[3], d, m;
  if (c < 100) c += 2000;
  if (fmt === "mdy") { m = a; d = b; } else if (fmt === "dmy") { d = a; m = b; } else if (a > 12) { d = a; m = b; } else if (b > 12) { m = a; d = b; } else { d = a; m = b; }
  return new Date(c, m - 1, d);
}
export const numCell = v => { const n = parseFloat(String(v || "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
export function statementHeaderIndex(rows) {
  let best = -1, bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const low = rows[i].map(x => String(x).trim().toLowerCase());
    let score = 0;
    if (low.some(x => x.includes("date"))) score += 2;
    if (low.some(x => x.includes("description") || x.includes("details") || x.includes("narrative"))) score += 2;
    if (low.some(x => x.includes("debit") || x.includes("money out") || x === "amount")) score += 2;
    if (low.some(x => x.includes("credit") || x.includes("money in"))) score += 1;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore >= 4 ? best : 0;
}
export function statementMeta(rows, hi) {
  const meta = { account: "", currency: "" };
  for (let i = 0; i < hi; i++) {
    const a = String((rows[i] || [])[0] || "").trim().toLowerCase(), b = String((rows[i] || [])[1] || "").trim();
    if (a.includes("account details")) meta.account = b;
    if (a.includes("currency")) { const m = b.match(/\b(SGD|MYR|USD|EUR|GBP|AUD|JPY)\b/i); if (m) meta.currency = m[1].toUpperCase(); }
  }
  return meta;
}
/* prepares the mapping step: detected header row, column guesses, account suggestion */
export function prepareStatement(rows) {
  const hi = statementHeaderIndex(rows), meta = statementMeta(rows, hi), body = rows.slice(hi), headers = body[0] || [];
  let suggested = S.defaultAccount || "";
  if (meta.account) { const mk = meta.account.toUpperCase(); const hit = S.accounts.find(a => mk.includes(a.name.toUpperCase()) || a.name.toUpperCase().includes(mk.split(/\s+/)[0])); if (hit) suggested = hit.id; }
  return {
    hi, meta, rows: body, headers, suggested,
    guess: {
      date: colGuess(headers, ["transaction date", "posting date", "date"]), desc: colGuess(headers, ["description", "details", "narrative", "merchant", "reference"]),
      amount: colGuess(headers, ["amount"]), debit: colGuess(headers, ["debit", "withdrawal", "money out"]), credit: colGuess(headers, ["credit", "deposit", "money in"]),
    },
  };
}
export function mapStatementRows(rows, map) {
  const out = [];
  for (const r of rows.slice(1)) {
    const dt = parseStatementDate(r[map.date], map.fmt);
    if (!dt || isNaN(dt.getTime())) continue;
    let o = 0, inc = 0;
    if (map.debit >= 0 || map.credit >= 0) { o = Math.abs(numCell(r[map.debit])); inc = Math.abs(numCell(r[map.credit])); }
    else { const n = numCell(r[map.amount]); if (map.sign === "negative") { o = n < 0 ? -n : 0; inc = n > 0 ? n : 0; } else { o = n > 0 ? n : 0; inc = n < 0 ? -n : 0; } }
    if (!o && !inc) continue;
    out.push({ date: iso(dt), desc: map.desc >= 0 ? String(r[map.desc] || "").trim() : "", out: Math.round(o * 100), inc: Math.round(inc * 100) });
  }
  return out;
}

/* ── PDF text lines → rows (generic, no AI) ── */
function parsePdfDateToken(tok, yearHint) {
  const m = String(tok || "").match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (!m) return null;
  let y = m[3] ? +m[3] : yearHint; if (y < 100) y += 2000; if (!y) y = new Date().getFullYear();
  const dt = new Date(y, +m[2] - 1, +m[1]);
  return isNaN(dt.getTime()) ? null : dt;
}
export function pdfLinesToRows(lines) {
  const rows = []; let yearHint = new Date().getFullYear();
  for (const line of lines) {
    const yr = line.match(/\b(20\d{2})\b/); if (yr) yearHint = +yr[1];
    const dm = line.match(/^\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s+(.*)$/);
    if (!dm) continue;
    const dt = parsePdfDateToken(dm[1], yearHint); if (!dt) continue;
    const rest = dm[2], nums = rest.match(/(?:SGD|S\$|RM)?\s*-?\d[\d,]*\.\d{2}/g) || [];
    const vals = nums.map(x => parseFloat(x.replace(/[^0-9.-]/g, ""))).filter(x => !isNaN(x));
    if (!vals.length) continue;
    const amt = vals.length > 1 ? vals[vals.length - 2] : vals[0], desc = rest.replace(/(?:SGD|S\$|RM)?\s*-?\d[\d,]*\.\d{2}/g, " ").replace(/\s+/g, " ").trim();
    const low = rest.toLowerCase(), credit = /credit|deposit|salary|refund|interest paid|transfer in/.test(low), debit = /debit|withdrawal|purchase|payment|fee|transfer out/.test(low);
    let o = 0, inc = 0;
    if (amt < 0) o = -amt; else if (credit && !debit) inc = amt; else o = amt;
    rows.push({ date: iso(dt), desc, out: Math.round(o * 100), inc: Math.round(inc * 100) });
  }
  return rows;
}
/* PDF text via pdf.js inside a sandboxed iframe (the PDF never runs in the app's own page) */
export function extractPdfLines(file) {
  return new Promise((resolve, reject) => {
    if (navigator.onLine === false) return reject(new Error("PDF import needs internet once to load the reader"));
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts"); frame.style.display = "none";
    const token = "pdf" + Date.now();
    const src = '<!doctype html><meta charset="utf-8"><script type="module">import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";addEventListener("message",async e=>{if(!e.data||e.data.type!=="parse")return;try{let pdf=await pdfjsLib.getDocument({data:e.data.buf,isEvalSupported:false}).promise,lines=[];for(let n=1;n<=pdf.numPages;n++){let pg=await pdf.getPage(n),tc=await pg.getTextContent(),items=tc.items.map(x=>({s:x.str,x:x.transform[4],y:x.transform[5]})).sort((a,b)=>Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x),cur=[],lastY=null;for(let it of items){if(lastY!==null&&Math.abs(it.y-lastY)>2){if(cur.length)lines.push(cur.join(" "));cur=[];}cur.push(it.s);lastY=it.y;}if(cur.length)lines.push(cur.join(" "));}parent.postMessage({type:"pdfdone",token:e.data.token,lines},"*");}catch(err){parent.postMessage({type:"pdferr",token:e.data.token,message:String(err&&err.message||err)},"*");}});<\/script>';
    let loaded = false, buf = null;
    const timer = setTimeout(() => { cleanup(); reject(new Error("the PDF reader timed out")); }, 30000);
    function cleanup() { clearTimeout(timer); window.removeEventListener("message", onmsg); try { frame.remove(); } catch (e) { } }
    function send() { if (!loaded || !buf) return; try { frame.contentWindow.postMessage({ type: "parse", token, buf }, "*", [buf]); buf = null; } catch (e) { cleanup(); reject(e); } }
    function onmsg(e) { const d = e.data || {}; if (d.token !== token) return; cleanup(); if (d.type === "pdferr") reject(new Error("could not read this PDF")); else resolve(d.lines || []); }
    window.addEventListener("message", onmsg);
    frame.onload = () => { loaded = true; send(); };
    frame.srcdoc = src; document.body.appendChild(frame);
    file.arrayBuffer().then(b => { buf = b; send(); }).catch(err => { cleanup(); reject(err); });
  });
}

/* ── reconciliation ── */
export function statementCurrency(aid, metaCur) { const a = C.accountOf(aid); return String(metaCur || (a && a.currency) || "SGD").toUpperCase() === "MYR" ? "MYR" : "SGD"; }
export function bookCandidates(aid, cur) {
  cur = cur || "SGD"; const out = [];
  for (const t of S.txns) if (!t.account || t.account === aid) out.push({ id: "t:" + t.id, date: t.date, flow: "out", amt: C.txnInCur(t, cur), label: C.catName(t.cat), desc: t.merchantRaw || t.note || "" });
  for (const x of S.ledger) {
    const a = C.ledgerInCur(x, cur), d = x.date || iso(today()), n = x.note || "";
    if ((x.type === "income" || x.type === "refund") && x.account === aid) out.push({ id: "l:" + x.id, date: d, flow: "in", amt: a, label: n || x.type, desc: n });
    else if ((x.type === "expense" || x.type === "goal") && x.account === aid) out.push({ id: "l:" + x.id, date: d, flow: "out", amt: a, label: n || x.type, desc: n });
    else if (x.type === "transfer" || x.type === "card_payment") {
      const lab = x.type === "transfer" ? "Transfer" : "Card payment";
      if (x.from === aid) out.push({ id: "l:" + x.id + ":o", date: d, flow: "out", amt: a, label: lab, desc: n });
      if (x.to === aid) out.push({ id: "l:" + x.id + ":i", date: d, flow: "in", amt: a, label: lab, desc: n });
    }
  }
  return out;
}
/* same flow, same amount, within 3 days; ties go to the matching merchant name, then the closest date */
export function bestBookMatch(r, cands, used) {
  const flow = r.out ? "out" : "in", amt = r.out || r.inc;
  let best = null, bestSim = -1, bestDiff = 99;
  for (const c of cands) {
    if (used[c.id] || c.flow !== flow || c.amt !== amt) continue;
    const diff = Math.abs(days(pIso(c.date), pIso(r.date))); if (diff > 3) continue;
    const sim = C.merchantSimilarity(r.desc || "", c.desc || "");
    if (sim > bestSim + 0.001 || (Math.abs(sim - bestSim) <= 0.001 && diff < bestDiff)) { best = c; bestSim = sim; bestDiff = diff; }
  }
  return best;
}
export function analyzeStatement(name, aid, rows, source, metaCur) {
  const cur = statementCurrency(aid, metaCur), used = {}, matched = [], unmatched = [], cands = bookCandidates(aid, cur);
  let inflow = 0, outflow = 0;
  for (const r of rows) {
    inflow += r.inc || 0; outflow += r.out || 0;
    if (!(r.out || r.inc)) continue;
    const best = bestBookMatch(r, cands, used);
    if (best) { used[best.id] = true; matched.push({ row: r, book: best }); }
    else unmatched.push({ date: r.date, desc: r.desc || "", out: r.out || 0, inc: r.inc || 0, status: "pending", suggested: r.out ? C.ruleCategory(r.desc) : "" });
  }
  const dates = rows.map(r => r.date).sort(), first = dates[0], last = dates[dates.length - 1];
  let logged = 0;
  for (const t of S.txns) if (t.date >= first && t.date <= last && (!t.account || t.account === aid)) logged += C.txnInCur(t, cur);
  for (const x of S.ledger) if (x.date && x.date >= first && x.date <= last && x.type === "expense" && x.account === aid) logged += C.ledgerInCur(x, cur);
  return { name, source: source || "csv", account: aid, cur, rows, matched, unmatched, inflow, outflow, logged, first, last, ignored: 0, added: 0, check: rows.check || null };
}
/* book entries made from statement rows, in the statement's currency */
export function statementTxn(st, r, cat) { const t = C.makeTxn({ amount: r.out, cur: st.cur, cat, note: r.desc, account: st.account, date: r.date, source: "statement" }); return t; }
export function statementLedger(st, type, amount, r) { const x = { id: "l" + Date.now() + Math.floor(Math.random() * 999), type, amount, cur: st.cur, date: r.date, note: r.desc, createdAt: Date.now(), account: "", from: "", to: "" }; if (st.cur === "MYR") x.rate = S.rate || 3.35; return x; }

/* ── one-time historical migration (canonical CSV) ── */
export const HIST_REQUIRED = ["account_name", "account_type", "currency", "transaction_date", "description", "transaction_type", "amount"];
export function previewHistorical(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "No transaction rows found" };
  const h = rows[0].map(x => String(x).trim().toLowerCase());
  if (HIST_REQUIRED.some(x => !h.includes(x))) return { error: "This is not the canonical history format" };
  const idx = {}; h.forEach((x, i) => (idx[x] = i));
  const data = rows.slice(1).filter(r => r[idx.transaction_date] && r[idx.amount]);
  return { idx, data, accounts: new Set(data.map(r => r[idx.account_name] || "Imported account")).size };
}
function findOrCreateAccount(name, type, currency) {
  name = (name || "Imported account").trim();
  const mapped = type === "credit_card" ? "credit" : type === "cash" ? "cash" : type === "loan" ? "loan" : "bank";
  const hit = S.accounts.find(a => a.name.toLowerCase() === name.toLowerCase());
  if (hit) { if (!hit.currency) hit.currency = (currency || "SGD").toUpperCase(); if (hit.type === "bank" && mapped === "loan") hit.type = "loan"; return hit.id; }
  const a = { id: "a" + Date.now() + Math.floor(Math.random() * 9999), name, type: mapped, balance: 0, baseBalance: 0, snapshotAt: Date.now(), updated: iso(today()), currency: (currency || "SGD").toUpperCase(), source: "historical_import", needsSnapshot: true };
  S.accounts.push(a); return a.id;
}
function findOrCreateCategory(name) {
  name = (name || "").trim();
  if (!name) return (S.cats.find(c => c.name.toLowerCase() === "other") || S.cats[0] || {}).id || "";
  const hit = S.cats.find(c => c.name.toLowerCase() === name.toLowerCase()); if (hit) return hit.id;
  const c = { id: "c" + Date.now() + Math.floor(Math.random() * 9999), name, icon: "dots", cap: 0, quick: [500, 1000, 2000, 5000], home: true };
  S.cats.push(c); return c.id;
}
/* returns {error} or {spending, ledger} */
export function importHistorical(rows, idx, name, uid) {
  const sig = name + "|" + rows.length + "|" + ((rows[0] && rows[0][idx.transaction_date]) || "") + "|" + ((rows[rows.length - 1] && rows[rows.length - 1][idx.transaction_date]) || "");
  if (S.historicalImports.some(x => x.signature === sig)) return { error: "This historical file appears to be imported already" };
  let added = 0, ledgerAdded = 0; const created = {};
  rows.forEach((r, n) => {
    const an = r[idx.account_name] || "Imported account", at = r[idx.account_type] || "bank", cur = (r[idx.currency] || "SGD").toUpperCase(),
      date = (r[idx.transaction_date] || "").trim(), desc = r[idx.description] || "", type = (r[idx.transaction_type] || "other").trim().toLowerCase(),
      amount = parseFloat(String(r[idx.amount] || "").replace(/,/g, ""));
    if (!date || !isFinite(amount) || amount === 0) return;
    const before = S.accounts.length, aid = findOrCreateAccount(an, at, cur);
    if (S.accounts.length > before) created[aid] = 1;
    const cents = Math.round(Math.abs(amount) * 100), ref = idx.reference != null ? r[idx.reference] || "" : "", merchant = idx.merchant != null ? r[idx.merchant] || "" : "",
      hint = idx.category_hint != null ? r[idx.category_hint] || "" : "", sourceId = "hist:" + sig + ":" + n;
    if (type === "expense" && amount < 0) {
      const cat = findOrCreateCategory(hint || C.ruleCategory(merchant || desc) || "Other"), sgd = cur === "MYR" ? Math.round(cents / (S.rate || 3.35)) : cents;
      S.txns.push({ id: uid(), date, sgd, cur, orig: cents, cat, note: merchant || desc, account: aid, createdAt: Date.now(), source: "historical_import", sourceId, reference: ref, affectsBalance: false });
      added++; if (merchant) C.rememberRule(merchant, cat);
    } else {
      let lt = type; if (lt === "fee" || lt === "interest" || lt === "other") lt = amount < 0 ? "expense" : "income";
      if (["income", "expense", "refund", "transfer", "card_payment"].includes(lt)) {
        S.ledger.push({ id: "l" + Date.now() + "_" + n, type: lt, account: lt === "transfer" || lt === "card_payment" ? "" : aid, from: "", to: "", amount: cents, cur, date, note: merchant || desc, createdAt: Date.now(), source: "historical_import", sourceId, reference: ref, affectsBalance: false });
        ledgerAdded++;
      }
    }
  });
  S.historicalImports.push({ id: "hi" + Date.now(), file: name, signature: sig, date: iso(today()), spending: added, ledger: ledgerAdded, rows: rows.length, createdAccounts: Object.keys(created) });
  return { spending: added, ledger: ledgerAdded };
}
export function removeHistoricalImports() {
  const created = {}; S.historicalImports.forEach(h => (h.createdAccounts || []).forEach(id => (created[id] = 1)));
  S.txns = S.txns.filter(t => t.source !== "historical_import");
  S.ledger = S.ledger.filter(x => x.source !== "historical_import");
  S.accounts = S.accounts.filter(a => !(a.source === "historical_import" && created[a.id]));
  S.historicalImports = [];
}
