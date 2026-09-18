import { useCallback, useEffect, useRef, useState } from "react";

import { DEBOUNCE_MS, DEFAULT_CODE } from "./constants";
import type { RunMode } from "./types";
import { useRunner, type Runner } from "./use-runner";

/** Versioned like the settings key, so a later change of shape cannot be handed a stale
 *  document. A string, not JSON: the document is the whole of the value. */
const KEY = "jsplayground:code:1";

/** How long typing settles before the document is written. Longer than the settings'
 *  own wait, because this is fed by a keystroke stream rather than by the odd click,
 *  and nothing reads it until the next time the app is opened. */
const PERSIST_MS = 500;

/**
 * The document as it was left. Never throws: a private window and a blocked origin both
 * throw on access rather than on write, and a scratchpad is not worth a blank page.
 *
 * Checked against `null` rather than for emptiness — an editor someone cleared and
 * walked away from should come back cleared, not refilled with the starter.
 */
function load(): string {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === null ? DEFAULT_CODE : stored;
  } catch {
    return DEFAULT_CODE;
  }
}

export type Playground = {
  code: string;
  setCode: (next: string) => void;
  /** Edited since the last run. Only meaningful while runs are frozen. */
  dirty: boolean;
  runNow: () => void;
  runner: Runner;
};

/**
 * The document and when it runs. The settings that drive it live in `useSettings`; both
 * outlive the session, and both are read in the state initialiser for the same reason.
 *
 * There is no gate on the first run any more. The stored mode used to arrive a tick
 * after mount, so this had to wait to be told whether a run was wanted at all; it is
 * read before the first render now, and `mode` is right the first time it is seen.
 */
export function usePlayground(mode: RunMode, timeout: number): Playground {
  const [code, setCode] = useState(load);
  // The same value, so a restored document does not arrive already marked as edited
  // since its last run. An initial value is read once, on the first render, so this is
  // the string `code` started as and not whatever it has since become.
  const [ranAt, setRanAt] = useState(code);
  const runner = useRunner(timeout);

  const codeRef = useRef(code);
  codeRef.current = code;

  const runRef = useRef(runner.run);
  runRef.current = runner.run;

  const runNow = useCallback(() => {
    setRanAt(codeRef.current);
    runRef.current(codeRef.current);
  }, []);

  // Debounce keystrokes, but not the first run and not the switch into live mode. The
  // debounce is there to wait out typing; on arrival there has been none, and turning
  // live mode on is itself the request for a result — waiting either of those out reads
  // as an app that has not started yet.
  const wasMode = useRef(mode);
  const ranOnce = useRef(false);
  useEffect(() => {
    const justSwitched = wasMode.current !== mode;
    wasMode.current = mode;
    if (mode !== "auto") return;
    const timer = window.setTimeout(
      () => {
        // Marked here rather than where the timer is set, so a run that was cleared
        // before it fired does not count as the one that has already happened.
        ranOnce.current = true;
        setRanAt(code);
        runRef.current(code);
      },
      !ranOnce.current || justSwitched ? 0 : DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [code, mode]);

  // What was restored, and whether anything has been typed since. Until something has,
  // there is nothing to save: writing the starter back on arrival would mean anyone who
  // opened the app once and typed nothing kept that starter for good, long after the
  // app had moved on to a different one.
  const restored = useRef(code);
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) {
      if (code === restored.current) return;
      // Edited once is edited for the rest of the session — including back to exactly
      // what was restored, which is a document someone chose and not a document nobody
      // has touched.
      touched.current = true;
    }

    let written = false;
    const save = () => {
      if (written) return;
      written = true;
      try {
        window.localStorage.setItem(KEY, code);
      } catch {
        // Quota, a blocked origin, or a paste far larger than a scratchpad was meant to
        // hold. The document in front of you is unaffected; only the copy for next time
        // is lost, and there is nothing useful to say about it mid-keystroke.
      }
    };

    // The same shape as the settings' own write, and for the same reason: the tab can be
    // closed or hidden inside the settle, and neither event will wait for anything
    // asynchronous — which is what makes this a synchronous write.
    const timer = window.setTimeout(save, PERSIST_MS);
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [code]);

  return { code, setCode, dirty: code !== ranAt, runNow, runner };
}
