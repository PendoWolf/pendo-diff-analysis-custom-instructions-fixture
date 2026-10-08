// API base URL. Defaults to the local server; override via VITE_API_URL for
// deployed/preview environments (QAWolf runs against whatever URL this points at).
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export interface AppState {
  counter: number;
  lastAction: string;
}

// Request details attached to every error call() throws, so callers can report
// them (e.g. the demo-action-failed Track Event) without parsing the message.
// httpStatus is only set when the server responded.
export interface ApiErrorDetails {
  method: "GET" | "POST";
  path: string;
  httpStatus?: number;
}

async function call(path: string, method: "GET" | "POST"): Promise<AppState> {
  let httpStatus: number | undefined;
  try {
    const res = await fetch(`${BASE}${path}`, { method });
    httpStatus = res.status;
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
    return (await res.json()) as AppState;
  } catch (e) {
    // Rethrow the original error (TypeError for network failures, Error for HTTP
    // errors, SyntaxError for invalid JSON) so its name and message are unchanged.
    const details: ApiErrorDetails = { method, path, httpStatus };
    if (e instanceof Error) Object.assign(e, details);
    throw e;
  }
}

export const api = {
  getState: () => call("/api/state", "GET"),
  increment: () => call("/api/increment", "POST"),
  decrement: () => call("/api/decrement", "POST"),
  reset: () => call("/api/reset", "POST"),
};
