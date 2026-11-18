// @ts-check
// The v1 API (docs/API.md) on one paired computer, and the messages for its error codes.

/** @import { Computer } from "./computers.js" */

/** @typedef {{ code?: string, error?: string, folder?: string }} ErrorBody */
/**
 * A conversation as GET /v1/sessions returns it, plus the computer it came from.
 * @typedef {{
 *   id: string, title: string, lastPrompt?: string, cwd?: string, project?: string, updatedAt: string,
 *   running?: { kind: string, status?: string } | null, remote?: { url: string } | null,
 * }} SessionInfo
 * @typedef {SessionInfo & { computer: Computer }} Session
 */
/** @typedef {{ id: string, role: string, text: string, tools?: string[], timestamp?: string }} Message */
/** @typedef {{ path: string, parent?: string, home?: string, folders: { name: string, path: string }[] }} Folders */

export class ApiError extends Error {
  /** @param {number} status @param {ErrorBody} body */
  constructor(status, body) {
    super(body.error || `HTTP ${status}`);
    this.status = status;
    this.code = body.code || "internal";
    this.body = body;
  }
}

/** @type {(computer: Computer) => void} */
let onUnauthorized = () => {};

// Called with the computer that rejected its key, e.g. after `pair --rotate`.
/** @param {(computer: Computer) => void} handler */
export function whenUnauthorized(handler) {
  onUnauthorized = handler;
}

// timeout (ms) bounds calls that should be quick, so one computer that is off does not hold the page.
/**
 * @param {Computer} computer
 * @param {"GET" | "POST" | "DELETE"} method
 * @param {string} path
 * @param {object} [body]
 * @param {number} [timeout] ms
 * @returns {Promise<any>} the JSON body, or null for 204
 */
export async function api(computer, method, path, body, timeout) {
  const response = await fetch(computer.origin + path, {
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
    method,
    headers: {
      Authorization: `Bearer ${computer.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (response.status === 204) return null;
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (json.code === "unauthorized") onUnauthorized(computer);
    throw new ApiError(response.status, json);
  }
  return json;
}

/** @type {Record<string, string>} */
const messages = {
  open_elsewhere: "The conversation is open on the computer. Close it there or run /remote-control in it.",
  remote_control_timeout: "Remote Control did not answer in time. Is Claude Code logged in with a Claude subscription?",
  folder_access: "The computer does not let Remote Sessions open that folder (macOS: Full Disk Access).",
  outside_home: "Only folders inside your home folder can be used.",
};

/** @param {unknown} error @param {Computer | null} [computer] */
export function describe(error, computer) {
  if (error instanceof ApiError) return messages[error.code] || error.message;
  // A computer reached cross-origin fails the same way when it is off and when this browser has not accepted its certificate.
  const where = computer ? `${computer.name} (${computer.origin})` : "the computer";
  return `Cannot reach ${where}. Is it on? If this browser has not accepted its certificate yet, open ${computer ? computer.origin + "/health" : "it"} once and accept it.`;
}

// Runs a launch call; asks before trusting a folder, as the store apps do.
/**
 * @template T
 * @param {(trustFolder: boolean) => Promise<T>} call
 * @returns {Promise<T>}
 */
export async function launch(call) {
  try {
    return await call(false);
  } catch (error) {
    if (error instanceof ApiError && error.code === "trust_required"
      && confirm(`Claude Code asks whether you trust ${error.body.folder}. Trust it?`)) {
      return call(true);
    }
    throw error;
  }
}
