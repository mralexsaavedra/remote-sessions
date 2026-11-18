// The paired computers, like the store apps: each with its address and key, kept in this browser's localStorage.
// The page is served by one of them; the others are reached cross-origin (the server allows it, see docs/API.md).

const KEY = "remote-sessions.computers";
const CURRENT_KEY = "remote-sessions.current";
const LEGACY_TOKEN_KEY = "remote-sessions.token";
export const ALL = "all";

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* private mode: lasts this visit only */ }
}

let computers = [];
try { computers = JSON.parse(read(KEY)) || []; } catch { computers = []; }
let current = read(CURRENT_KEY) || (computers[0] && computers[0].id) || null;

function persist() {
  write(KEY, JSON.stringify(computers));
  write(CURRENT_KEY, current);
}

export const list = () => computers;
export const byId = (id) => computers.find((computer) => computer.id === id) || null;

// The selected computer, or ALL for the merged list.
export function selected() {
  if (current === ALL && computers.length > 1) return ALL;
  return byId(current) || computers[0] || null;
}

export function select(id) {
  current = id;
  persist();
}

export function save(computer) {
  computers = computers.filter((other) => other.id !== computer.id);
  computers.push(computer);
  computers.sort((a, b) => a.name.localeCompare(b.name));
  current = computer.id;
  persist();
}

export function forget(id) {
  computers = computers.filter((computer) => computer.id !== id);
  if (current === id || computers.length < 2) current = (computers[0] && computers[0].id) || null;
  persist();
}

// The first version kept a single key for the page's own computer: move it into the list.
export async function migrate() {
  const token = read(LEGACY_TOKEN_KEY);
  if (!token) return;
  try {
    const health = await fetch("/health", { cache: "no-store" }).then((response) => response.json());
    save({ id: health.id, name: health.name, origin: location.origin, token });
    write(LEGACY_TOKEN_KEY, null);
  } catch { /* the computer is away: try again next time */ }
}

// Reads the store apps' remotesessions://pair link (from the QR code or pasted) or a bare token.
export function parsePairing(text) {
  text = text.trim();
  if (!text) return null;
  if (text.startsWith("remotesessions:")) {
    const params = new URLSearchParams(text.slice(text.indexOf("?") + 1));
    if (!params.get("token")) return null;
    return {
      token: params.get("token"),
      id: params.get("id"),
      name: params.get("name"),
      port: params.get("port") || "8787",
      hosts: (params.get("hosts") || "").split(",").filter(Boolean),
    };
  }
  return /^[\w-]{16,}$/.test(text) ? { token: text, hosts: [] } : null;
}

// Where a pairing code's computer answers: this page's own computer, or one of the addresses in the code.
export function candidateOrigins(pairing) {
  return pairing.hosts.map((host) => `https://${host.includes(":") ? `[${host}]` : host}:${pairing.port}`);
}
