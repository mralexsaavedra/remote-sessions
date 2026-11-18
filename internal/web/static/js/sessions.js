// The conversation list (one computer or all of them) and one conversation, with Remote Control.

import { api, describe, launch } from "./api.js";
import { ALL, list, selected } from "./computers.js";
import { $, ago, el, setError, setOpenLink } from "./dom.js";
import { show } from "./nav.js";

export async function showList() {
  const choice = selected();
  show("list");
  const computers = choice === ALL ? list() : [choice];
  $("list-status").textContent = "Loading…";
  $("sessions").replaceChildren();
  const results = await Promise.all(computers.map(async (computer) => {
    try {
      const { sessions } = await api(computer, "GET", "/v1/sessions");
      return { sessions: sessions.map((session) => ({ ...session, computer })) };
    } catch (error) {
      return { error: describe(error, computer), sessions: [] };
    }
  }));
  const sessions = results.flatMap((result) => result.sessions)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const errors = results.map((result) => result.error).filter(Boolean);
  $("list-status").textContent = errors.join(" ") || (sessions.length ? "" : "No conversations yet.");
  $("sessions").replaceChildren(...sessions.map((session) => sessionCard(session, choice === ALL)));
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
