import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS, RUN_TIMEOUT_MS } from "./constants";
import { APP_THEMES, CODE_THEMES } from "./themes";
import type { RunMode } from "./types";

export type Orientation = "rows" | "columns";

export type Settings = {
  /** An id from `APP_THEMES`. */
  theme: string;
  /** An id from `CODE_THEMES`. */
  code: string;
  mode: RunMode;
  orientation: Orientation;
  /** Whether the output pane is the top/left one. */
  outputFirst: boolean;
  /** Percentage of the frame given to whichever pane is first. */
  split: number;
  /** Whether a container in the output starts open. */
  consoleOpen: boolean;
  /** Whether the output is coloured at all. */
  consoleColor: boolean;
  /** How long the code may run before the worker is killed. */
  timeout: number;
};

/** Versioned, so a later change of shape cannot be handed a stale object. */
const KEY = "jsplayground:settings:2";
/** The shape before themes had names — read once, to carry a light/dark choice over. */
const KEY_V1 = "jsplayground:settings:1";

const DEFAULTS: Settings = {
  theme: "night",
  code: "ink",
  mode: "auto",
  orientation: "columns",
  /** Source on the left, output on the right. */
  outputFirst: false,
  split: 50,
  consoleOpen: false,
  consoleColor: true,
  timeout: RUN_TIMEOUT_MS,
};

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

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

  // Theme ids are checked against the lists rather than merely typed: an id that no
  // longer exists would otherwise resolve through a fallback on every read, for ever.
  if (typeof input.theme === "string" && APP_THEMES.some((t) => t.id === input.theme)) out.theme = input.theme;
  if (typeof input.code === "string" && CODE_THEMES.some((t) => t.id === input.code)) out.code = input.code;
  if (input.mode === "auto" || input.mode === "manual") out.mode = input.mode;
  if (input.orientation === "rows" || input.orientation === "columns") out.orientation = input.orientation;
  if (typeof input.outputFirst === "boolean") out.outputFirst = input.outputFirst;
  if (typeof input.split === "number" && Number.isFinite(input.split)) out.split = clamp(input.split, 12, 88);
  if (typeof input.consoleOpen === "boolean") out.consoleOpen = input.consoleOpen;
  if (typeof input.consoleColor === "boolean") out.consoleColor = input.consoleColor;
  if (typeof input.timeout === "number" && Number.isFinite(input.timeout)) {
    out.timeout = clamp(Math.round(input.timeout), MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
  }
  return out;
}

/** What the previous shape can still tell us: which way round the person liked it. */
function carryOver(raw: string | null): Partial<Settings> {
  if (!raw) return {};
  let dark: boolean | null = null;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object" && typeof (value as Record<string, unknown>).dark === "boolean") {
      dark = (value as Record<string, boolean>).dark;
    }
  } catch {
    return {};
  }
  const carried = parse(raw);
  if (dark === null) return carried;
  return { ...carried, theme: dark ? "night" : "sunny", code: dark ? "ink" : "plain" };
}

/**
 * The settings, remembered.
 *
 * Storage is read after mount rather than during render, so a blocked or absent
 * `localStorage` costs a preference and not the first paint. `ready` is how callers know
 * the stored values have landed — it is what keeps the first automatic run from firing
 * against defaults that are about to be replaced.
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
      const current = window.localStorage.getItem(KEY);
      stored = current ? parse(current) : carryOver(window.localStorage.getItem(KEY_V1));
    } catch {
      // Private windows and blocked storage both throw on access, not on write.
    }
    setSettings({ ...DEFAULTS, ...stored });
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

  const update = useCallback((patch: Partial<Settings>) => setSettings((previous) => ({ ...previous, ...patch })), []);

  return { settings, update, ready };
}
