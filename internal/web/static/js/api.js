// The v1 API (docs/API.md) on one paired computer, and the messages for its error codes.

export class ApiError extends Error {
  constructor(status, body) {
    super(body.error || `HTTP ${status}`);
    this.status = status;
    this.code = body.code || "internal";
    this.body = body;
  }
}

let onUnauthorized = () => {};

// Called with the computer that rejected its key, e.g. after `pair --rotate`.
export function whenUnauthorized(handler) {
  onUnauthorized = handler;
}

// timeout (ms) bounds calls that should be quick, so one computer that is off does not hold the page.
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

const messages = {
  open_elsewhere: "The conversation is open on the computer. Close it there or run /remote-control in it.",
  remote_control_timeout: "Remote Control did not answer in time. Is Claude Code logged in with a Claude subscription?",
  folder_access: "The computer does not let Remote Sessions open that folder (macOS: Full Disk Access).",
  outside_home: "Only folders inside your home folder can be used.",
};

export function describe(error, computer) {
  if (error instanceof ApiError) return messages[error.code] || error.message;
  // A computer reached cross-origin fails the same way when it is off and when this browser has not accepted its certificate.
  const where = computer ? `${computer.name} (${computer.origin})` : "the computer";
  return `Cannot reach ${where}. Is it on? If this browser has not accepted its certificate yet, open ${computer ? computer.origin + "/health" : "it"} once and accept it.`;
}

// Runs a launch call; asks before trusting a folder, as the store apps do.
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
