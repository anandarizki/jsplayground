import { useEffect, useRef, useState } from "react";

import { Dialog } from "./dialog";

/**
 * Naming what is in the editor, so it can be found again.
 *
 * A form rather than a button, which is what makes Enter save — the title is one field,
 * and reaching for the mouse to commit a single line reads as a step too many.
 */
export function SaveBookmarkDialog({
  onSave,
  onClose,
}: {
  onSave: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSave(title);
    onClose();
  };

  return (
    <Dialog title="Save bookmark" onClose={onClose} autoFocus={false}>
      <form onSubmit={submit} className="mt-3">
        <label htmlFor="bookmark-title" className="block text-[13px] text-[var(--jp-muted)]">
          What is in the editor, saved under a name of your choosing.
        </label>

        <input
          id="bookmark-title"
          ref={field}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder="binary search"
          className="mt-3 w-full rounded-lg border border-[var(--jp-border)] bg-[var(--jp-bg)] px-3 py-2 font-mono text-[13px] text-[var(--jp-text)] placeholder:text-[var(--jp-faint)] focus:border-[var(--jp-accent)] focus:outline-none"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] text-[var(--jp-muted)] transition hover:bg-[var(--jp-hover)] hover:text-[var(--jp-text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-lg bg-[var(--jp-accent-bg)] px-3 py-1.5 text-[13px] text-[var(--jp-accent)] transition hover:bg-[var(--jp-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
