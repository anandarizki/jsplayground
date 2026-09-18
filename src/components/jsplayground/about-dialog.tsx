import { GITHUB_URL } from "./constants";
import { Dialog } from "./dialog";

const LINK = "underline underline-offset-2 transition hover:text-[var(--jp-text)]";

/**
 * What the app is, and nothing about how to work it.
 *
 * The controls explain themselves to anyone looking at them, and a dialog that describes
 * the screen you are already looking at is a dialog nobody finishes reading.
 */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="JSPlayground" onClose={onClose}>
      <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-[var(--jp-muted)]">
        <p>A JavaScript scratchpad: somewhere to try a few lines and see what they print.</p>
        <p>
          Your code runs in a Web Worker rather than on the page, so a loop that never ends can be
          stopped, and nothing one run leaves behind reaches the next. It never leaves this tab —
          there is nowhere for it to be sent.
        </p>
      </div>

      <p className="mt-5 border-t border-[var(--jp-border)] pt-4 font-mono text-[11px] text-[var(--jp-faint)]">
        Built by{" "}
        <a href="https://rizki.id" target="_blank" rel="noreferrer" className={LINK}>
          Ananda Rizki
        </a>{" "}
        ·{" "}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={LINK}>
          source on GitHub
        </a>
      </p>
    </Dialog>
  );
}
