// @ts-check
// A new conversation: browse the selected computer's folders and start Claude Code in one.

/** @import { Computer } from "./computers.js" */
/** @import { Folders } from "./api.js" */
import { api, describe, launch } from "./api.js";
import { ALL, selected } from "./computers.js";
import { $, el, setError, setOpenLink, skeleton } from "./dom.js";
import { show } from "./nav.js";
import { recentFolders } from "./sessions.js";

/** @type {string | null} */
let currentFolder = null;
/** @type {Computer | null} */
let computer = null;

/** @param {string} [path] a folder; none opens the computer's home folder */
export async function showCreate(path) {
  if (!path) {
    const choice = selected();
    // The new-conversation button only shows with one computer selected.
    if (!choice || choice === ALL) return;
    computer = choice;
    const recent = recentFolders(computer);
    $("recent-label").hidden = recent.length === 0;
    $("recent").replaceChildren(...recent.map((folder) => folderItem(folder.name, folder.path, folder.path)));
  }
  if (!computer) return;
  const target = computer;
  show("create", `New conversation on ${target.name}`);
  setError("create-error", null);
  setOpenLink("create-open", null);
  $("create-start").hidden = false;
  $("folder-path").textContent = path || "";
  $("folders").replaceChildren(...skeleton(6, "card", ["45%"]));
  try {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    /** @type {Folders} */
    const listing = await api(target, "GET", `/v1/folders${query}`);
    currentFolder = listing.path;
    $("folder-path").textContent = listing.path;
    const items = [];
    if (listing.parent) items.push(folderItem("‹ ..", listing.parent));
    for (const folder of listing.folders) items.push(folderItem(`📁 ${folder.name}`, folder.path));
    $("folders").replaceChildren(...items);
  } catch (error) {
    $("folder-path").textContent = describe(error, target);
  }
}

/** @param {string} label @param {string} path @param {string} [detail] */
function folderItem(label, path, detail) {
  const item = el("li", null, label);
  if (detail) item.append(el("div", "muted path", detail));
  item.addEventListener("click", () => showCreate(path));
  return item;
}

export async function create() {
  const button = $("create-start");
  const target = computer;
  if (!target) return;
  button.disabled = true;
  button.textContent = "Starting… (up to 45 s)";
  setError("create-error", null);
  try {
    const title = $("create-title").value.trim();
    const result = await launch((trustFolder) => api(target, "POST", "/v1/sessions", { cwd: currentFolder, title, trustFolder }));
    setOpenLink("create-open", result.url);
    button.hidden = true;
  } catch (error) {
    setError("create-error", describe(error, target));
  } finally {
    button.disabled = false;
    button.textContent = "Start here";
  }
}
