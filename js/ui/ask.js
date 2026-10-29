/* Budget Margin 4 — Ask: questions about your own money, answered from numbers computed on the phone.
   Plan changes arrive as proposal cards; nothing changes until you tap Apply. */
import { h, icon, esc, miniMarkdown, haptic } from "../util.js";
import { S, CHAT, saveChat, clearChat, AIC } from "../state.js";
import * as AI from "../ai.js";
import { validateProposal, describeProposal, applyProposal } from "../proposals.js";
import { toast, confirmSheet } from "./core.js";

let go = () => { };
export const initAsk = nav => (go = nav);
let busy = false, draft = "";
export const setDraft = t => (draft = t || "");

const SUGGEST = [
  "How much did I spend on food and transport last period?",
  "How am I doing this period?",
  "How far am I from clearing my debt, given how I've actually been paying?",
  "Set a new debt plan that fits my budget",
  "Which envelopes am I overspending most often?",
  "Am I on track with my CPF and savings plan?",
  "What should I do this month for my long-term plan?",
];

export function renderAsk(root) {
  const chat = h("div.chat");
  root.replaceChildren(
    h("div.bar", h("div", h("h1", "Ask"), h("span.sub", AI.aiOn() ? "Answers use your budget data" : "Needs AI assist")),
      h("div.bar-actions",
        CHAT.length ? h("button.icon-btn", { type: "button", "aria-label": "Clear conversation", html: icon("trash"), onclick: async () => { if (await confirmSheet("Clear the conversation?", "Your budget data isn't affected.", "Clear")) { clearChat(); renderAsk(root); } } }) : null,
        h("button.icon-btn", { type: "button", "aria-label": "Settings", html: icon("gear"), onclick: () => go("settings") }))),
    chat);
  if (!AI.aiOn()) {
    chat.appendChild(h("div.card", h("div.empty", h("b", "Ask about your money"), "Questions like \"How much did I spend on food last month?\" or \"When will I clear my debt at this pace?\" are answered using your own numbers. This needs AI assist, which uses your Setpoint Worker.",
      h("div", { style: { marginTop: "14px" } }, h("button.btn.sm", { type: "button", style: { margin: "0 auto" }, onclick: () => go("settings", "ai") }, "Set up AI assist")))));
    return;
  }
  if (!CHAT.length) {
    chat.appendChild(h("p.hint", { style: { margin: "4px 4px 6px" } }, "Try one of these, or type your own question:"));
    chat.appendChild(h("div.suggest", SUGGEST.map(s => h("button", { type: "button", onclick: () => send(s, root) }, s))));
    chat.appendChild(h("p.hint", { style: { margin: "14px 4px 0" } }, "Each question sends your budget summary plus the transactions from the last three periods (merchants, amounts, envelopes, accounts) to your Worker and its AI provider (" + String(AIC.provider || "groq").split("+")[0] + " for text). Totals and forecasts are calculated on your phone first."));
  }
  CHAT.forEach((m, i) => chat.appendChild(bubble(m, i, root)));
  if (busy) chat.appendChild(h("div.msg.bot.typing", h("i"), h("i"), h("i")));
  const ta = h("textarea", { rows: 1, placeholder: "Ask about your money…", value: draft, "aria-label": "Question", enterkeyhint: "send",
    oninput: e => { draft = e.target.value; e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; sendBtn.disabled = busy || !draft.trim(); },
    onkeydown: e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim() && !busy) send(draft, root); } } });
  const sendBtn = h("button.send", { type: "button", "aria-label": "Send", html: icon("send"), disabled: busy || !draft.trim(), onclick: () => send(draft, root) });
  root.appendChild(h("div.composer", h("div.composer-in", ta, sendBtn)));
  requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
}

function bubble(m, i, root) {
  if (m.role === "user") return h("div.msg.user", m.text);
  const box = h("div", { style: { display: "contents" } });
  box.appendChild(h("div.msg.bot" + (m.error ? ".err" : ""), { html: miniMarkdown(m.text) }));
  (m.proposals || []).forEach((p, j) => {
    const v = validateProposal(p); if (!v) return;
    const d = describeProposal(v), state = (m.applied || {})[j];
    const card = h("div.proposal" + (state ? ".done" : ""),
      h("h4", h("span", { html: icon("bolt") }), d.title),
      h("table", d.rows.map(r => h("tr", h("td", r[0]), h("td.from.tab", r[1]), h("td.arrow", "→"), h("td.to.tab", r[2])))),
      d.note ? h("p.hint", d.note) : null,
      state ? h("p.hint", { style: { marginBottom: 0 } }, state === "applied" ? "Applied." : "Dismissed.")
        : h("div.btn-row",
          h("button.btn.sm", { type: "button", onclick: () => {
            const undo = applyProposal(v); m.applied = m.applied || {}; m.applied[j] = "applied"; saveChat(); haptic(8);
            toast("Plan updated", () => { undo(); m.applied[j] = null; saveChat(); renderAsk(root); });
            renderAsk(root);
          } }, "Apply"),
          h("button.btn.sm.soft", { type: "button", onclick: () => { m.applied = m.applied || {}; m.applied[j] = "dismissed"; saveChat(); renderAsk(root); } }, "Dismiss")));
    box.appendChild(card);
  });
  return box;
}

async function send(text, root) {
  text = String(text || "").trim(); if (!text || busy) return;
  busy = true; draft = "";
  CHAT.push({ role: "user", text, at: Date.now() }); saveChat();
  renderAsk(root);
  try {
    const r = await AI.askChat(text, CHAT.slice(0, -1));
    CHAT.push({ role: "bot", text: r.reply, proposals: r.proposals, at: Date.now() });
  } catch (e) {
    CHAT.push({ role: "bot", text: "I couldn't answer that: " + AI.aiErr(e) + ".", error: true, at: Date.now() });
  }
  busy = false; saveChat();
  if (root.isConnected && root.classList.contains("on")) renderAsk(root);
}
