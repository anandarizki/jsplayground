import { useCallback, useEffect, useRef, useState } from "react";

import { DEBOUNCE_MS, DEFAULT_CODE } from "./constants";
import type { RunMode } from "./types";
import { useRunner, type Runner } from "./use-runner";

export type Playground = {
  code: string;
  setCode: (next: string) => void;
  /** Edited since the last run. Only meaningful while runs are frozen. */
  dirty: boolean;
  runNow: () => void;
  runner: Runner;
};

/**
 * The document and when it runs. The settings that drive it live in `useSettings`,
 * because they outlive the session and this does not.
 *
 * There is no gate on the first run any more. The stored mode used to arrive a tick
 * after mount, so this had to wait to be told whether a run was wanted at all; it is
 * read before the first render now, and `mode` is right the first time it is seen.
 */
export function usePlayground(mode: RunMode, timeout: number): Playground {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [ranAt, setRanAt] = useState(DEFAULT_CODE);
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

  return { code, setCode, dirty: code !== ranAt, runNow, runner };
}
