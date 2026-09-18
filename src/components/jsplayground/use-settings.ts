import { useCallback, useEffect, useRef, useState } from "react";

import type { RunMode } from "./types";

export type Orientation = "rows" | "columns";

export type Settings = {
  dark: boolean;
  mode: RunMode;
  orientation: Orientation;
  /** Whether the output pane is the top/left one. */
  outputFirst: boolean;
  /** Percentage of the frame given to whichever pane is first. */
  split: number;
};

/** Versioned, so a later change of shape cannot be handed a stale object. */
const KEY = "jsplayground:settings:1";

const DEFAULTS: Settings = {
  dark: false,
  mode: "auto",
  orientation: "rows",
  outputFirst: true,
  split: 58,
};

/**
 * Nothing here trusts what comes back. Storage is shared with whatever else ran on
 * this origin, it survives across versions of this app, and a hand-edited value is a
 * plain `{}` away — so every field is checked, and anything unrecognised falls back to
 * the default rather than reaching React as `undefined`.
 */
function parse(raw: string | null): Partial<Settings> {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null) return {};
  const input = value as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (typeof input.dark === "boolean") out.dark = input.dark;
  if (input.mode === "auto" || input.mode === "manual") out.mode = input.mode;
  if (input.orientation === "rows" || input.orientation === "columns") out.orientation = input.orientation;
  if (typeof input.outputFirst === "boolean") out.outputFirst = input.outputFirst;
  if (typeof input.split === "number" && Number.isFinite(input.split)) {
    out.split = Math.min(88, Math.max(12, input.split));
  }
  return out;
}

/**
 * The settings, remembered.
 *
 * Read after mount, never during render: the server has no storage and no media query,
 * so resolving either one early would render markup the client immediately contradicts.
 * `ready` is how callers know the stored values have landed — it is what keeps the
 * first automatic run from firing against defaults that are about to be replaced.
 */
export function useSettings(): {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  ready: boolean;
} {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let stored: Partial<Settings> = {};
    try {
      stored = parse(window.localStorage.getItem(KEY));
    } catch {
      // Private windows and blocked storage both throw on access, not on write.
    }
    // Only fall back to the system theme when nothing was ever stored: someone who
    // chose light on a dark machine meant it.
    const dark =
      stored.dark ?? (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setSettings({ ...DEFAULTS, ...stored, dark });
    loaded.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Quota or a blocked origin. Losing the preference is not worth an error.
    }
  }, [settings]);

  const update = useCallback(
    (patch: Partial<Settings>) => setSettings((previous) => ({ ...previous, ...patch })),
    [],
  );

  return { settings, update, ready };
}
