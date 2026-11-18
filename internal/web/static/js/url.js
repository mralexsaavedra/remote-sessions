// The list's computer, search and project live in the address (?computer=dev&q=loop&project=homelab),
// so a reload keeps them and a link opens the same view.

import { ALL, list, select, selected } from "./computers.js";
import { $ } from "./dom.js";

const slug = (name) => name.trim().toLowerCase().replace(/\s+/g, "-");

// Applies the address to the store and the filters. Called once, before the first list.
export function readFilters() {
  const params = new URLSearchParams(location.search);
  const wanted = params.get("computer");
  if (wanted) {
    const match = wanted === ALL ? ALL : list().find((computer) => computer.id === wanted || slug(computer.name) === slug(wanted))?.id;
    if (match) select(match);
  }
  $("search").value = params.get("q") || "";
  // The project options arrive with the sessions; the list keeps this until it can select it.
  $("project").dataset.wanted = params.get("project") || "";
}

// Writes the current filters back into the address without adding a history entry.
export function writeFilters() {
  const params = new URLSearchParams();
  const choice = selected();
  if (list().length > 1 && choice) params.set("computer", choice === ALL ? ALL : slug(choice.name));
  const query = $("search").value.trim();
  if (query) params.set("q", query);
  const project = $("project").value || $("project").dataset.wanted;
  if (project) params.set("project", project);
  const search = params.toString();
  const url = location.pathname + (search ? `?${search}` : "");
  if (url !== location.pathname + location.search) history.replaceState(history.state, "", url);
}
