/** Shapes shared by the sandbox worker, the runner hook and the console view. */

/** A colour role for one run of text in the output. Kept abstract so each variant
 *  is free to map it to its own palette. */
export type Tone =
  | "plain"
  | "string"
  | "number"
  | "boolean"
  | "nullish"
  | "key"
  | "punct"
  | "fn"
  | "regexp"
  | "error"
  | "dim";

export type Token = { t: Tone; v: string };

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

/** Where a failure came from. `syntax` never ran; `timeout` was killed mid-run. */
export type ErrorPhase = "syntax" | "runtime" | "rejection" | "timeout";

export type LogEntry = {
  kind: "log";
  id: number;
  level: LogLevel;
  /** One token list per console argument. */
  parts: Token[][];
  /** Arrived after the top-level code had already finished. */
  deferred: boolean;
};

export type ErrorEntry = {
  kind: "error";
  id: number;
  name: string;
  message: string;
  line: number | null;
  column: number | null;
  phase: ErrorPhase;
};

export type NoticeEntry = { kind: "notice"; id: number; text: string };

export type Entry = LogEntry | ErrorEntry | NoticeEntry;

/** Worker → main. */
export type WorkerMessage =
  | { t: "log"; level: LogLevel; parts: Token[][] }
  | { t: "error"; name: string; message: string; line: number | null; column: number | null; phase: ErrorPhase }
  | { t: "notice"; text: string }
  | { t: "done"; ms: number };

export type RunStatus =
  /** Nothing has been run yet. */
  | "idle"
  /** Worker is evaluating, or the top-level code is still awaiting. */
  | "running"
  /** Finished without throwing. Async output may still trickle in. */
  | "ok"
  /** Threw, rejected, or failed to parse. */
  | "error"
  /** Killed by the watchdog — almost always an unbounded loop. */
  | "timeout"
  /** No Web Worker in this environment, so nothing can be run safely. */
  | "unsupported";

export type RunMode = "manual" | "auto";
