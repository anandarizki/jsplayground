import { Trash2 } from "lucide-react";

import { EXAMPLES } from "./constants";
import { Dialog } from "./dialog";
import type { Bookmark } from "./use-bookmarks";

/** The only thing a snippet can say about itself in one line. */
const firstLine = (code: string) => code.trim().split("\n")[0];

const heading = "px-3 font-mono text-[11px] text-[var(--jp-faint)]";

function Row({ title, code, onPick }: { title: string; code: string; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="w-full min-w-0 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--jp-hover)]"
    >
      <span className="block truncate text-[13px] text-[var(--jp-text)]">{title}</span>
      <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--jp-faint)]">
        {firstLine(code)}
      </span>
    </button>
  );
}

/**
 * The snippet shelf: what you saved, then what shipped.
 *
 * Yours come first because they are the ones with a reason to be here; the examples
 * below them each poke at one thing the runner has to survive, and stay whatever you do
 * to the list above.
 */
export function BookmarksDialog({
  bookmarks,
  onPick,
  onRemove,
  onClose,
}: {
  bookmarks: Bookmark[];
  onPick: (code: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const pick = (code: string) => {
    onPick(code);
    onClose();
  };

  return (
    <Dialog title="Bookmarks" onClose={onClose}>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--jp-muted)]">
        Opening one replaces what is in the editor.
      </p>

      <p className={`mt-4 ${heading}`}>saved</p>
      {bookmarks.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-[var(--jp-faint)]">
          Nothing yet — the bookmark button at the foot of the source saves what you are editing.
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {bookmarks.map((bookmark) => (
            // The delete button cannot sit inside the row, which is itself a button, so
            // the two are siblings and the group is what brings the second one forward.
            // Forward, not out: hidden until hover is hidden for good on a touch screen,
            // where there is no hovering to be done.
            <li key={bookmark.id} className="group flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <Row title={bookmark.title} code={bookmark.code} onPick={() => pick(bookmark.code)} />
              </div>
              <button
                onClick={() => onRemove(bookmark.id)}
                aria-label={`Delete ${bookmark.title}`}
                title="Delete"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--jp-faint)] opacity-40 transition group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-[var(--jp-hover)] hover:text-[var(--jp-error)] focus:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={`mt-4 ${heading}`}>examples</p>
      <ul className="mt-1 space-y-1">
        {EXAMPLES.map((example) => (
          <li key={example.label}>
            <Row title={example.label} code={example.code} onPick={() => pick(example.code)} />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
