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
 * `ready` gates the first automatic run: the stored mode arrives one tick after mount,
 * and running against the default in the meantime would burn a worker on a setting the
 * user turned off weeks ago.
 */
export function usePlayground(mode: RunMode, ready: boolean): Playground {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [ranAt, setRanAt] = useState(DEFAULT_CODE);
  const runner = useRunner();

  const codeRef = useRef(code);
  codeRef.current = code;

  const runRef = useRef(runner.run);
  runRef.current = runner.run;

  const runNow = useCallback(() => {
    setRanAt(codeRef.current);
    runRef.current(codeRef.current);
  }, []);

  // Debounce keystrokes, but not the switch into live mode: turning it on is itself
  // the request for a result, and waiting out the debounce would read as a dead button.
  const wasMode = useRef(mode);
  useEffect(() => {
    const justSwitched = wasMode.current !== mode;
    wasMode.current = mode;
    if (!ready || mode !== "auto") return;
    const timer = window.setTimeout(
      () => {
        setRanAt(code);
        runRef.current(code);
      },
      justSwitched ? 0 : DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [code, mode, ready]);

  return { code, setCode, dirty: code !== ranAt, runNow, runner };
}
