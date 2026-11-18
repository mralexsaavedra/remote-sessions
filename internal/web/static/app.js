// Remote Sessions web client: the store apps' features on top of the same v1 API (docs/API.md).
// Each screen lives in its own module under js/.

import { whenUnauthorized } from "./js/api.js";
import { forget, list, migrate, select, selected } from "./js/computers.js";
import { create, showCreate } from "./js/create.js";
import { $ } from "./js/dom.js";
import { ADD } from "./js/nav.js";
import { setUpPairing, showPair } from "./js/pair.js";
import { showList } from "./js/sessions.js";

// Offline shell. Chrome refuses service workers on a self-signed certificate; the page works without one.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "/app/" }).catch(() => {});

function home() {
  if (list().length) showList(); else showPair();
}

setUpPairing(() => {
  history.replaceState(null, "");
  showList();
});
whenUnauthorized((computer) => {
  forget(computer.id);
  showPair(`${computer.name} did not accept the key. Pair it again.`);
});

$("back").onclick = () => (history.state ? history.back() : home());
$("new").onclick = () => { history.pushState({ view: "create" }, ""); showCreate(); };
$("create-start").onclick = create;
$("computer").onchange = (event) => {
  if (event.target.value === ADD) {
    history.pushState({ view: "pair" }, "");
    showPair();
    return;
  }
  select(event.target.value);
  showList();
};
$("unpair").onclick = () => {
  const computer = selected();
  if (!computer || !confirm(`Forget ${computer.name} in this browser?`)) return;
  forget(computer.id);
  home();
};
window.addEventListener("popstate", home);

migrate().then(home);
