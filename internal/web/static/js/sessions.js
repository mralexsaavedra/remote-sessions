// The conversation list (one computer or all of them) and one conversation, with Remote Control.

import { api, describe, launch } from "./api.js";
import { ALL, list, selected } from "./computers.js";
import { $, ago, el, setError, setOpenLink } from "./dom.js";
import { show } from "./nav.js";

const LIST_TIMEOUT = 8000;
let listRun = 0;

// Each computer's conversations appear as soon as that computer answers; a slow or absent one
// only adds its error line instead of holding the whole list.
export async function showList() {
  const choice = selected();
  const run = ++listRun;
  show("list");
  const computers = choice === ALL ? list() : [choice];
  const sessions = [];
  const errors = [];
  let pending = computers.length;
  const render = () => {
    if (run !== listRun) return;
    sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const status = pending ? ["Loading…"] : (sessions.length ? [] : ["No conversations yet."]);
    $("list-status").textContent = [...errors, ...status].join(" ");
    $("sessions").replaceChildren(...sessions.map((session) => sessionCard(session, choice === ALL)));
  };
  render();
  await Promise.all(computers.map(async (computer) => {
    try {
      const result = await api(computer, "GET", "/v1/sessions", undefined, LIST_TIMEOUT);
      sessions.push(...result.sessions.map((session) => ({ ...session, computer })));
    } catch (error) {
      errors.push(describe(error, computer));
    }
    pending -= 1;
    render();
  }));
}

function sessionCard(session, showComputer) {
  const item = el("li");
  const badges = el("div");
  if (session.remote) badges.append(el("span", "badge remote", "Remote Control"));
  else if (session.running) badges.append(el("span", "badge", "Open on the computer"));
  const where = [showComputer ? session.computer.name : null, session.project, ago(session.updatedAt)];
  item.append(
    el("div", "t", session.title),
    el("div", "s", session.lastPrompt || ""),
    badges,
    el("div", "muted", where.filter(Boolean).join(" · ")),
  );
  item.addEventListener("click", () => {
    history.pushState({ view: "detail" }, "");
    showDetail(session);
  });
  return item;
}

const remoteControlPath = (session) => `/v1/sessions/${encodeURIComponent(session.id)}/remote-control`;

async function showDetail(session) {
  const { computer } = session;
  show("detail", session.title);
  $("detail-meta").textContent = [computer.name, session.cwd].filter(Boolean).join(" · ");
  $("messages").replaceChildren(el("li", "muted", "Loading…"));
  setError("detail-error", null);
  setOpenLink("open-claude", session.remote && session.remote.url);
  $("connect").hidden = Boolean(session.remote);
  $("connect").disabled = false;
  $("connect").onclick = () => connect(session);
  $("stop").hidden = !(session.running && session.running.kind === "remote-sessions");
  $("stop").onclick = () => stop(session);
  try {
    const { messages } = await api(computer, "GET", `/v1/sessions/${encodeURIComponent(session.id)}/messages?limit=60`);
    $("messages").replaceChildren(...messages.map((message) => {
      const item = el("li", message.role, message.text);
      if (message.tools && message.tools.length) item.append(el("span", "tools", `⚙ ${message.tools.join(", ")}`));
      return item;
    }));
    window.scrollTo(0, document.body.scrollHeight);
  } catch (error) {
    $("messages").replaceChildren(el("li", "error", describe(error, computer)));
  }
}

async function connect(session) {
  const button = $("connect");
  button.disabled = true;
  button.textContent = "Starting Remote Control… (up to 45 s)";
  setError("detail-error", null);
  try {
    const result = await launch((trustFolder) =>
      api(session.computer, "POST", remoteControlPath(session), trustFolder ? { trustFolder } : undefined));
    setOpenLink("open-claude", result.url);
    button.hidden = true;
    $("stop").hidden = false;
  } catch (error) {
    setError("detail-error", describe(error, session.computer));
  } finally {
    button.disabled = false;
    button.textContent = "Connect with Remote Control";
  }
}

async function stop(session) {
  try {
    await api(session.computer, "DELETE", remoteControlPath(session));
    history.back();
  } catch (error) {
    setError("detail-error", describe(error, session.computer));
  }
}
