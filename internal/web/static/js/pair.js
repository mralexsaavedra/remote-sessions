// Pairing: the same QR code as the store apps, read with the camera or pasted.
// A code from this page's computer pairs it; a code from another computer pairs that one through its addresses.

import { candidateOrigins, healthAt, list, parsePairing, proxiedOrigin, save } from "./computers.js";
import { $, el, setError } from "./dom.js";
import { show } from "./nav.js";
import { startScanner, stopScanner } from "./scanner.js";

let onPaired = () => {};
let pending = null;

// The first address that answers as the computer in the code.
async function locate(pairing) {
  const own = await healthAt(location.origin).catch(() => null);
  if (!pairing.id || (own && own.id === pairing.id)) {
    return own && { id: own.id, name: own.name, origin: location.origin };
  }
  // This page's proxy first: same address and certificate as the page.
  if (pairing.name) {
    const health = await healthAt(proxiedOrigin(pairing.name), 2000).catch(() => null);
    if (health && health.id === pairing.id) return { id: health.id, name: health.name, origin: proxiedOrigin(pairing.name) };
  }
  const origins = candidateOrigins(pairing);
  const found = await Promise.any(origins.map(async (origin) => {
    const health = await healthAt(origin);
    if (health.id !== pairing.id) throw new Error("another computer");
    return { id: health.id, name: health.name, origin };
  })).catch(() => null);
  return found;
}

function showCertificateLinks(pairing) {
  // The browser cannot pin the certificate like the apps do: the person accepts it once per address.
  const links = candidateOrigins(pairing).map((origin) => {
    const link = el("a", null, `${origin}/health`);
    link.href = `${origin}/health`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const item = el("li");
    item.append(link);
    return item;
  });
  $("pair-links").replaceChildren(...links);
  $("pair-reach").hidden = links.length === 0;
}

async function pairWith(pairing) {
  setError("pair-error", null);
  $("pair-reach").hidden = true;
  const computer = await locate(pairing);
  if (!computer) {
    pending = pairing;
    showCertificateLinks(pairing);
    throw new Error(`Cannot reach ${pairing.name || "that computer"} from this browser.`);
  }
  pending = null;
  save({ ...computer, token: pairing.token });
  onPaired();
}

function pair(pairing) {
  pairWith(pairing).catch((error) => {
    setError("pair-error", error.message);
    $("scan-start").hidden = false;
  });
}

function scan() {
  startScanner((text) => {
    const pairing = parsePairing(text);
    if (!pairing) return false;
    stopScanner();
    pair(pairing);
    return true;
  });
}

export function showPair(error) {
  show("pair", list().length ? "Add a computer" : null);
  $("pair-reach").hidden = true;
  setError("pair-error", error);
  // Phones open the camera at once; on a computer the code is usually on the same screen
  // (and the camera may be a virtual one), so it waits for the button and opens the paste box.
  if (matchMedia("(pointer: coarse)").matches) scan();
  else {
    stopScanner();
    $("scan-start").hidden = false;
    document.querySelector("#pair details").open = true;
  }
}

export function setUpPairing(paired) {
  onPaired = paired;
  $("scan-start").onclick = scan;
  $("pair-retry").onclick = () => { if (pending) pair(pending); };
  $("pair-save").onclick = () => {
    const pairing = parsePairing($("pair-input").value);
    if (!pairing) return setError("pair-error", "That is not a pairing link.");
    $("pair-input").value = "";
    pair(pairing);
  };
}
