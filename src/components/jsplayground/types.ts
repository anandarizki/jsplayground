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

/**
 * One console argument, as the worker hands it over.
 *
 * `v` is a run of tokens and prints as itself. `c` opens: it carries a one-line summary
 * for when it is shut and its members for when it is not. The worker is terminated once
 * a run settles, so there is no fetching a level on demand — everything the view can
 * ever show is already here, which is what the caps in the worker are bounding.
 */
export type Printed =
  | { n: "v"; tokens: Token[] }
  | {
      n: "c";
      /** The whole value on one line, for when it is shut. */
      preview: Token[];
      /** What it shows instead when open: its label and opening brace, nothing more —
       *  the members are the lines below, so the summary would only repeat them. */
      head: Token[];
      /** The closing brace, on its own line under the key that opened it. */
      tail: Token[];
      members: Member[];
      hidden: number;
    };

/** A member of an open container. `key` carries its own `: ` or ` => `; Sets and arrays
 *  use the index, so every row reads the same way. */
export type Member = { key: Token[]; value: Printed };

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

/** Where a failure came from. `syntax` never ran; `timeout` was killed mid-run. */
export type ErrorPhase = "syntax" | "runtime" | "rejection" | "timeout";

export type LogEntry = {
  kind: "log";
  id: number;
  level: LogLevel;
  /** One per console argument. */
  parts: Printed[];
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
  | { t: "log"; level: LogLevel; parts: Printed[] }
  /** The top-level code has returned control — it either finished or reached an await.
   *  What tells a timeout the difference between a loop and a slow wait. */
  | { t: "yield" }
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
