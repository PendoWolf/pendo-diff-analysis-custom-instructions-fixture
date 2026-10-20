import { useEffect, useState } from "react";
import { api, type ApiErrorDetails, type AppState } from "./api";

type Action = "load" | "refresh" | "increment" | "decrement" | "reset";
type TrackProps = Record<string, string | number | boolean | undefined>;

// Seam for Pendo. Novus installs the Pendo agent, which provides window.pendo
// at runtime; this fires a Track Event for each action. No-op when the agent
// isn't present (local dev), so the app and Playwright mocks both stay simple.
// The emitted names (demo-load, demo-refresh, demo-increment, demo-decrement,
// demo-reset, demo-action-failed) are registered in Pendo; don't rename them.
function trackEvent(name: Action | "action-failed", props: TrackProps) {
  if (typeof window !== "undefined") {
    window.pendo?.track?.(`demo-${name}`, props);
  }
}

// Properties for a successful action's event: the server-confirmed state it
// returned (`next`) plus what was on screen when the action started.
function successProps(
  action: Action,
  next: AppState,
  previousCounter: number,
  recoveredFromError: boolean,
): TrackProps {
  switch (action) {
    case "load":
      return { counter: next.counter, lastAction: next.lastAction };
    case "refresh":
      return {
        counter: next.counter,
        previousCounter,
        counterChanged: next.counter !== previousCounter,
        lastAction: next.lastAction,
        recoveredFromError,
      };
    case "increment":
    case "decrement":
      return { counter: next.counter, recoveredFromError };
    case "reset":
      return { previousCounter, recoveredFromError };
  }
}

// Properties for demo-action-failed. call() in api.ts attaches the request's
// method, path and (when the server responded) httpStatus to its errors, and
// errorName separates network failures (TypeError), HTTP errors (Error) and
// non-JSON responses (SyntaxError).
function failureProps(action: Action, e: unknown): TrackProps {
  const err = e as Partial<Error & ApiErrorDetails>;
  return {
    action,
    errorMessage: err.message?.slice(0, 100),
    errorName: err.name,
    httpStatus: err.httpStatus,
    method: err.method,
    path: err.path,
  };
}

// <StrictMode> runs the mount effect, and so the initial load, twice in
// development. Only the first load per page view is tracked; module scope (not
// a ref) so the guard holds for the whole page view.
let initialLoadTracked = false;

function shouldTrack(action: Action): boolean {
  if (action !== "load") return true;
  if (initialLoadTracked) return false;
  initialLoadTracked = true;
  return true;
}

export default function App() {
  const [state, setState] = useState<AppState>({ counter: 0, lastAction: "none" });
  const [error, setError] = useState<string | null>(null);

  const run = async (action: Action, fn: () => Promise<AppState>) => {
    // What was on screen when the action started, for the Track Event.
    const previousCounter = state.counter;
    const recoveredFromError = error !== null;
    const tracked = shouldTrack(action);
    try {
      setError(null);
      const next = await fn();
      setState(next);
      if (tracked) trackEvent(action, successProps(action, next, previousCounter, recoveredFromError));
    } catch (e) {
      setError((e as Error).message);
      if (tracked) trackEvent("action-failed", failureProps(action, e));
    }
  };

  useEffect(() => {
    run("load", api.getState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
      <h1>QAWolf Demo</h1>

      <p data-testid="counter-value" style={{ fontSize: "3rem", margin: "1rem 0" }}>
        {state.counter}
      </p>
      <p data-testid="last-action" style={{ color: "#666" }}>
        Last action: {state.lastAction}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button data-testid="btn-increment" onClick={() => run("increment", api.increment)}>
          Increment
        </button>
        <button data-testid="btn-decrement" onClick={() => run("decrement", api.decrement)}>
          Decrement
        </button>
        <button data-testid="btn-reset" onClick={() => run("reset", api.reset)}>
          Reset
        </button>
        <button data-testid="btn-refresh" onClick={() => run("refresh", api.getState)}>
          Refresh
        </button>
      </div>

      {error && (
        <p data-testid="error" style={{ color: "crimson", marginTop: 16 }}>
          {error}
        </p>
      )}
    </main>
  );
}
