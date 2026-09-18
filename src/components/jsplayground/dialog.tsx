import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * The shell both dialogs sit in.
 *
 * Rendered inside the app's root rather than in a portal, which is what puts it inside
 * the element carrying the theme's custom properties — a portalled dialog would land on
 * `document.body` and inherit none of them.
 */
export function Dialog({ title, onClose, children }: Props) {
  const close = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

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

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // The backdrop closes on mousedown; the panel must not pass its own through.
        onMouseDown={(event) => event.stopPropagation()}
        className="relative max-h-full w-full max-w-md overflow-auto rounded-xl border border-[var(--jp-border)] bg-[var(--jp-panel)] p-6 shadow-xl"
      >
        <button
          ref={close}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--jp-faint)] transition hover:bg-[var(--jp-hover)] hover:text-[var(--jp-text)]"
        >
          <X size={15} />
        </button>

        <h2 id={titleId} className="pr-8 font-mono text-sm text-[var(--jp-text)]">
          {title}
        </h2>

        {children}
      </div>
    </div>
  );
}
