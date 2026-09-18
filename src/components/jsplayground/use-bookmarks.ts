import { useCallback, useEffect, useRef, useState } from "react";

/** A snippet the person saved, as opposed to one that shipped with the app. */
export type Bookmark = { id: string; title: string; code: string; saved: number };

/** Versioned like the settings key, so a later change of shape cannot be handed a
 *  stale object. */
const KEY = "jsplayground:bookmarks:1";

/** Long enough for a sentence, short enough that the list stays a list. */
const MAX_TITLE = 80;

const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Nothing here trusts what comes back — storage is shared with whatever else ran on
 * this origin and a hand-edited value is a plain `{}` away. An entry missing either of
 * the two fields that matter is dropped rather than repaired into a blank row.
 */
function parse(raw: string | null): Bookmark[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const out: Bookmark[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.title !== "string" || typeof entry.code !== "string") continue;
    if (!entry.title.trim()) continue;
    out.push({
      id: typeof entry.id === "string" && entry.id ? entry.id : id(),
      title: entry.title.slice(0, MAX_TITLE),
      code: entry.code,
      saved: typeof entry.saved === "number" && Number.isFinite(entry.saved) ? entry.saved : 0,
    });
  }
  return out;
}

/**
 * The saved snippets, remembered.
 *
 * Read after mount for the same reason the settings are: a blocked or absent
 * `localStorage` should cost a list and not the first paint. Newest first, because the
 * thing you just saved is the thing you are most likely to want back.
 */
export function useBookmarks(): {
  bookmarks: Bookmark[];
  add: (title: string, code: string) => void;
  remove: (id: string) => void;
} {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      setBookmarks(parse(window.localStorage.getItem(KEY)));
    } catch {
      // Private windows and blocked storage both throw on access, not on write.
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    // Guarded, or the empty list this starts as would overwrite the stored one in the
    // gap between mount and the read above.
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(bookmarks));
    } catch {
      // Quota or a blocked origin. The list still works for this session.
    }
  }, [bookmarks]);

  const add = useCallback((title: string, code: string) => {
    const clean = title.trim().slice(0, MAX_TITLE);
    if (!clean) return;
    setBookmarks((previous) => [{ id: id(), title: clean, code, saved: Date.now() }, ...previous]);
  }, []);

  const remove = useCallback(
    (target: string) => setBookmarks((previous) => previous.filter((b) => b.id !== target)),
    [],
  );

  return { bookmarks, add, remove };
}
