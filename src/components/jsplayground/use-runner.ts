import { useCallback, useEffect, useRef, useState } from "react";

import { ASYNC_CEILING_MS, ASYNC_IDLE_MS } from "./constants";
import type { Entry, RunStatus } from "./types";
import { checkMessage } from "./validate";
import { WORKER_SOURCE } from "./worker-main";

export type Runner = {
  entries: Entry[];
  status: RunStatus;
  /** Milliseconds the last run took, once it settled. */
  ms: number | null;
  run: (code: string) => void;
  cancel: () => void;
  clear: () => void;
  /** Bumped whenever the output is replaced wholesale — a new run, or the eraser. What
   *  the error boundary around the console is keyed on, so a row that could not be drawn
   *  stops being a broken pane the moment it is gone. */
  generation: number;
};

const supported = () =>
  typeof Worker !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

/**
 * One run, one worker.
 *
 * A fresh worker per run is a few milliseconds of startup in exchange for two things
 * worth more than that: globals cannot leak from the previous run into this one, and
 * the previous run — which may be a `while (true)` still holding a core — is killed
 * before the next one starts. `terminate()` is the only lever that works on a thread
 * that never yields, so every path out of a run goes through it.
 */
export function useRunner(timeout: number): Runner {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [ms, setMs] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);

  const worker = useRef<Worker | null>(null);
  const blobUrl = useRef<string | null>(null);
  const watchdog = useRef<number | null>(null);
  const idle = useRef<number | null>(null);
  const ceiling = useRef<number | null>(null);
  const settled = useRef(false);
  const refused = useRef(false);
  const seq = useRef(0);

  const id = () => (seq.current += 1);
  const append = (entry: Entry) => setEntries((prev) => prev.concat(entry));

  const stopTimer = (ref: React.RefObject<number | null>) => {
    if (ref.current !== null) window.clearTimeout(ref.current);
    ref.current = null;
  };

  const kill = useCallback(() => {
    stopTimer(watchdog);
    stopTimer(idle);
    stopTimer(ceiling);
    if (worker.current) {
      worker.current.terminate();
      worker.current = null;
    }
  }, []);

  const run = useCallback(
    (code: string) => {
      kill();
      if (!supported()) {
        setStatus("unsupported");
        setEntries([
          {
            kind: "notice",
            id: id(),
            text: "This environment has no Web Worker, so there is nowhere safe to run the code.",
          },
        ]);
        return;
      }

      setEntries([]);
      setMs(null);
      setStatus("running");
      setGeneration((n) => n + 1);
      settled.current = false;
      refused.current = false;

      if (!blobUrl.current) {
        blobUrl.current = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      }
      const w = new Worker(blobUrl.current);
      worker.current = w;

      // Late output keeps the worker alive, but only up to a ceiling — a `setInterval`
      // would otherwise hold the thread open until the tab closes.
      const armIdle = () => {
        stopTimer(idle);
        idle.current = window.setTimeout(kill, ASYNC_IDLE_MS);
      };

      w.onmessage = (event: MessageEvent) => {
        // A message already in flight when `kill()` ran belongs to a run that is over,
        // and everything below it — the entries, the status, the settled flag — belongs
        // to the run that replaced it.
        if (worker.current !== w) return;
        // The sandbox is not the only thing that can post on this channel: the code it
        // is running holds the same `postMessage`. So the message is checked rather than
        // destructured, and one that is not a message this console can draw is dropped —
        // said once, so a loop posting rubbish cannot fill the pane with complaints.
        const msg = checkMessage(event.data);
        if (!msg) {
          if (!refused.current) {
            refused.current = true;
            append({ kind: "notice", id: id(), text: "The sandbox sent a message this console cannot show." });
          }
          return;
        }
        switch (msg.t) {
          case "log":
            append({ kind: "log", id: id(), level: msg.level, parts: msg.parts, deferred: settled.current });
            break;
          case "error":
            append({
              kind: "error",
              id: id(),
              name: msg.name,
              message: msg.message,
              line: msg.line,
              column: msg.column,
              phase: msg.phase,
            });
            setStatus("error");
            break;
          case "notice":
            append({ kind: "notice", id: id(), text: msg.text });
            break;
          case "done":
            settled.current = true;
            stopTimer(watchdog);
            setMs(msg.ms);
            setStatus((prev) => (prev === "error" ? "error" : "ok"));
            break;
        }
        if (settled.current) armIdle();
      };

      w.onerror = () => {
        if (worker.current !== w) return;
        kill();
        append({
          kind: "error",
          id: id(),
          name: "SandboxError",
          message: "The sandbox itself failed to start.",
          line: null,
          column: null,
          phase: "runtime",
        });
        setStatus("error");
      };

      watchdog.current = window.setTimeout(() => {
        kill();
        append({
          kind: "error",
          id: id(),
          name: "Timeout",
          message:
            "Stopped after " +
            timeout +
            " ms. The code never handed control back — an unbounded loop can only be killed from outside.",
          line: null,
          column: null,
          phase: "timeout",
        });
        setStatus("timeout");
      }, timeout);

      ceiling.current = window.setTimeout(() => {
        if (!worker.current) return;
        kill();
        append({ kind: "notice", id: id(), text: "Stopped listening for late output after 15 s." });
      }, ASYNC_CEILING_MS);

      w.postMessage({ t: "run", code });
    },
    [kill, timeout],
  );

  const cancel = useCallback(() => {
    kill();
    setStatus((prev) => (prev === "running" ? "idle" : prev));
  }, [kill]);

  const clear = useCallback(() => {
    setEntries([]);
    setMs(null);
    setStatus("idle");
    setGeneration((n) => n + 1);
  }, []);

  useEffect(
    () => () => {
      kill();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = null;
    },
    [kill],
  );

  return { entries, status, ms, run, cancel, clear, generation };
}
