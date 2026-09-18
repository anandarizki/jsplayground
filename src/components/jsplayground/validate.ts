/**
 * What comes back from the sandbox, checked before it is believed.
 *
 * The worker talks to the page through `self.postMessage`, and so can the code it is
 * running: `postMessage({ t: "log", level: "log", parts: null })` is a one-line snippet,
 * and it used to reach the view as a render that threw — which in React 19 unmounts the
 * root and leaves a blank page behind. The channel is reachable by the very thing the
 * worker exists to contain, so nothing arriving on it is trusted; every field the view
 * will touch is checked here first, in the shape the view expects.
 *
 * A message that does not pass is dropped whole rather than repaired. Half a log entry
 * is not better than none, and guessing at what was meant is how a validator becomes a
 * second parser.
 */

import type { ErrorPhase, LogLevel, Member, Printed, Token, Tone, WorkerMessage } from "./types";

const TONES = new Set<string>([
  "plain",
  "string",
  "number",
  "boolean",
  "nullish",
  "key",
  "punct",
  "fn",
  "regexp",
  "error",
  "dim",
] satisfies Tone[]);

const LEVELS = new Set<string>(["log", "info", "warn", "error", "debug"] satisfies LogLevel[]);

const PHASES = new Set<string>(["syntax", "runtime", "rejection", "timeout"] satisfies ErrorPhase[]);

/**
 * How much of a message may be walked before it is refused outright.
 *
 * The worker's own caps keep a real message far under this; the budget is here for the
 * hand-written one, so that rejecting a million-node structure cannot itself be the
 * thing that stalls the main thread.
 */
const MAX_NODES = 50000;
/** Deeper than the worker's `MAX_DEPTH` can produce, and shallow enough that the walk
 *  below cannot exhaust the stack. */
const MAX_DEPTH = 16;
/** A single run of text the view would render as one node. The worker clips strings at
 *  4000 characters; this only has to stop a hand-written megabyte. */
const MAX_TOKEN_CHARS = 100000;
/** Free text — a notice, an error's name and message. Long enough for any real one. */
const MAX_TEXT = 4000;

type Budget = { left: number };

const clip = (text: string) => (text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + "…" : text);

/** `null` is a line the worker could not locate, and is the common case. */
function isPlace(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isTokens(value: unknown, budget: Budget): value is Token[] {
  if (!Array.isArray(value)) return false;
  for (const token of value) {
    if ((budget.left -= 1) < 0) return false;
    if (typeof token !== "object" || token === null) return false;
    const { t, v } = token as Record<string, unknown>;
    if (typeof t !== "string" || !TONES.has(t)) return false;
    if (typeof v !== "string" || v.length > MAX_TOKEN_CHARS) return false;
  }
  return true;
}

function isMembers(value: unknown, budget: Budget, depth: number): value is Member[] {
  if (!Array.isArray(value)) return false;
  for (const member of value) {
    if (typeof member !== "object" || member === null) return false;
    const { key, value: inner } = member as Record<string, unknown>;
    if (!isTokens(key, budget)) return false;
    if (!isPrinted(inner, budget, depth)) return false;
  }
  return true;
}

function isPrinted(value: unknown, budget: Budget, depth: number): value is Printed {
  if ((budget.left -= 1) < 0 || depth > MAX_DEPTH) return false;
  if (typeof value !== "object" || value === null) return false;
  const node = value as Record<string, unknown>;

  if (node.n === "v") return isTokens(node.tokens, budget);
  if (node.n !== "c") return false;

  if (!isTokens(node.preview, budget)) return false;
  if (!isTokens(node.head, budget)) return false;
  if (!isTokens(node.tail, budget)) return false;
  if (typeof node.hidden !== "number" || !Number.isFinite(node.hidden)) return false;
  return isMembers(node.members, budget, depth + 1);
}

/**
 * The one way in. Returns the message as the rest of the app may read it, or `null` if
 * it is not one — in which case the caller says so once and carries on.
 */
export function checkMessage(value: unknown): WorkerMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const msg = value as Record<string, unknown>;
  const budget: Budget = { left: MAX_NODES };

  switch (msg.t) {
    case "log": {
      if (typeof msg.level !== "string" || !LEVELS.has(msg.level)) return null;
      if (!Array.isArray(msg.parts)) return null;
      for (const part of msg.parts) if (!isPrinted(part, budget, 0)) return null;
      return { t: "log", level: msg.level as LogLevel, parts: msg.parts as Printed[] };
    }
    case "error": {
      if (typeof msg.name !== "string" || typeof msg.message !== "string") return null;
      if (!isPlace(msg.line) || !isPlace(msg.column)) return null;
      if (typeof msg.phase !== "string" || !PHASES.has(msg.phase)) return null;
      return {
        t: "error",
        name: clip(msg.name),
        message: clip(msg.message),
        line: msg.line,
        column: msg.column,
        phase: msg.phase as ErrorPhase,
      };
    }
    case "notice": {
      if (typeof msg.text !== "string") return null;
      return { t: "notice", text: clip(msg.text) };
    }
    case "done": {
      if (typeof msg.ms !== "number" || !Number.isFinite(msg.ms)) return null;
      return { t: "done", ms: msg.ms };
    }
  }
  return null;
}
