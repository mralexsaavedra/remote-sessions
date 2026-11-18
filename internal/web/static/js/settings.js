// Settings: the paired computers (select, forget, add) and what this page is.

import { forget, list, select, selected } from "./computers.js";
import { $, el } from "./dom.js";
import { show } from "./nav.js";

let onDone = () => {};
let onAdd = () => {};

function computerRow(computer, current) {
  const item = el("li", "split");
  const text = el("div");
  text.append(el("div", "t", computer.name), el("div", "muted", new URL(computer.origin).host));
  const end = el("div", "row");
  if (current) end.append(el("span", "check", "✓"));
  const remove = el("button", "small", "Forget");
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!confirm(`Forget ${computer.name} in this browser?`)) return;
    forget(computer.id);
    if (list().length) renderComputers(); else onAdd();
  });
  end.append(remove);
  item.append(text, end);
  item.addEventListener("click", () => { select(computer.id); onDone(); });
  return item;
}

function renderComputers() {
  const choice = selected();
  $("computers").replaceChildren(...list().map((computer) => computerRow(computer, choice && choice.id === computer.id)));
}

export function showSettings() {
  show("settings", "Settings");
  renderComputers();
  $("version").textContent = "";
  fetch("/health", { cache: "no-store" })
    .then((response) => response.json())
    .then((health) => { $("version").textContent = health.version; })
    .catch(() => {});
}

export function setUpSettings({ done, add }) {
  onDone = done;
  onAdd = add;
  $("settings-add").onclick = add;
}
