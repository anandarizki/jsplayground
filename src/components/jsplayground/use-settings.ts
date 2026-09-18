import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_FONT_PX,
  MAX_FONT_PX,
  MAX_TIMEOUT_MS,
  MIN_FONT_PX,
  MIN_TIMEOUT_MS,
  RUN_TIMEOUT_MS,
} from "./constants";
import { APP_THEMES, CODE_THEMES, appTheme, matchCode } from "./themes";
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
  /** Text size in the editor, in pixels. */
  editorSize: number;
  /** Text size in the output, in pixels. Kept apart from the editor's: reading a wide
   *  printed structure and writing the line that made it are not the same job. */
  consoleSize: number;
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
  editorSize: DEFAULT_FONT_PX,
  consoleSize: DEFAULT_FONT_PX,
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
  for (const key of ["editorSize", "consoleSize"] as const) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = clamp(Math.round(value), MIN_FONT_PX, MAX_FONT_PX);
    }
  }
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
export type Update = (patch: Partial<Settings> | ((previous: Settings) => Partial<Settings>)) => void;

export function useSettings(): {
  settings: Settings;
  update: Update;
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
    // A stored pair can be mismatched — hand-edited, or carried over from a shape that
    // did not have the constraint — so the invariant is restored on the way in.
    const merged = { ...DEFAULTS, ...stored };
    setSettings({ ...merged, code: matchCode(merged.code, appTheme(merged.theme).dark) });
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

  // A patch may be a function of what is already there, which is what makes a step
  // correct when two clicks land inside one render: an object patch would carry the
  // size the button was drawn with, and the second click would repeat the first.
  const update = useCallback<Update>(
    (patch) =>
      setSettings((previous) => {
        const resolved = typeof patch === "function" ? patch(previous) : patch;
        const next = { ...previous, ...resolved };
        // Changing the app theme carries the code theme with it, unless the caller said
        // which one it wanted. Keeping this here rather than in the dialog means no
        // caller can leave the two out of step.
        if (resolved.theme !== undefined && resolved.code === undefined) {
          next.code = matchCode(next.code, appTheme(next.theme).dark);
        }
        // Sizes are nudged a step at a time, so the bounds are enforced here rather than
        // trusted to every button that offers a step.
        next.editorSize = clamp(next.editorSize, MIN_FONT_PX, MAX_FONT_PX);
        next.consoleSize = clamp(next.consoleSize, MIN_FONT_PX, MAX_FONT_PX);
        return next;
      }),
    [],
  );

  return { settings, update, ready };
}
