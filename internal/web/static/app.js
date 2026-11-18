// Remote Sessions web client: the store apps' features on top of the same v1 API (docs/API.md).
// Each screen lives in its own module under js/.

import { whenUnauthorized } from "./js/api.js";
import { create, showCreate } from "./js/create.js";
import { $ } from "./js/dom.js";
import { setUpPairing, showPair } from "./js/pair.js";
import { showList } from "./js/sessions.js";
import { forgetToken, token } from "./js/token.js";

// Offline shell. Chrome refuses service workers on a self-signed certificate; the page works without one.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "/app/" }).catch(() => {});
setUpPairing();
whenUnauthorized(() => {
  forgetToken();
  showPair("The computer did not accept the key. Pair again.");
});

$("back").onclick = () => history.back();
$("new").onclick = () => { history.pushState({ view: "create" }, ""); showCreate(); };
$("create-start").onclick = create;
$("unpair").onclick = () => { forgetToken(); showPair(); };
window.addEventListener("popstate", () => { if (token()) showList(); });

if (token()) showList(); else showPair();
