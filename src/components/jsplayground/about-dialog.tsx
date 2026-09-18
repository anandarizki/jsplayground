import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { GITHUB_URL, RUN_TIMEOUT_MS } from "./constants";

type Props = {
  onClose: () => void;
};

/**
 * What the app is and who made it.
 *
 * Rendered inside the app's root element rather than in a portal, so the `group` that
 * carries the `dark` class is still an ancestor and every `group-[.dark]:` here resolves
 * the same way it does in the panes.
 */
export function AboutDialog({ onClose }: Props) {
  const close = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Opened from a button the pointer is already on, so focus has to be moved by hand
    // for Escape and Tab to reach the dialog at all.
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const link = "underline underline-offset-2 transition hover:text-zinc-900 group-[.dark]:hover:text-zinc-100";

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 p-4 group-[.dark]:bg-zinc-950/60"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        // The backdrop closes on mousedown; the panel must not pass its own through.
        onMouseDown={(event) => event.stopPropagation()}
        className="relative max-h-full w-full max-w-md overflow-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl group-[.dark]:border-zinc-800 group-[.dark]:bg-zinc-900"
      >
        <button
          ref={close}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 group-[.dark]:hover:bg-zinc-800 group-[.dark]:hover:text-zinc-100"
        >
          <X size={15} />
        </button>

        <h2 id="about-title" className="pr-8 font-mono text-sm text-zinc-900 group-[.dark]:text-zinc-100">
          JSPlayground
        </h2>

        <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-zinc-600 group-[.dark]:text-zinc-400">
          <p>
            A two-pane JavaScript scratchpad: the source in one pane, whatever it printed in the other.
          </p>
          <p>
            The code runs in a Web Worker rather than on the page, which is what makes an unbounded loop
            survivable — a watchdog stops the thread after {RUN_TIMEOUT_MS / 1000} seconds, and every run
            gets a fresh worker so nothing leaks from one into the next. Output is formatted rather than
            stringified: Maps, Sets, circular references, sparse arrays and getters each print as
            themselves, and anything with members inside it opens where it sits.
          </p>
          <p>
            Press <kbd className="font-mono text-zinc-500 group-[.dark]:text-zinc-400">⌘↵</kbd> to run once,
            or leave the play button lit to re-run as you type. The rest of the rail moves the panes around;
            the layout is remembered.
          </p>
        </div>

        <p className="mt-5 border-t border-zinc-200 pt-4 font-mono text-[11px] text-zinc-400 group-[.dark]:border-zinc-800 group-[.dark]:text-zinc-500">
          Built by{" "}
          <a href="https://rizki.id" target="_blank" rel="noreferrer" className={link}>
            Ananda Rizki
          </a>{" "}
          ·{" "}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={link}>
            source on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
