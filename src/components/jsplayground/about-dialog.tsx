import { GITHUB_URL } from "./constants";
import { Dialog } from "./dialog";

const LINK = "underline underline-offset-2 transition hover:text-[var(--jp-text)]";

export function AboutDialog({ timeout, onClose }: { timeout: number; onClose: () => void }) {
  return (
    <Dialog title="JSPlayground" onClose={onClose}>
      <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-[var(--jp-muted)]">
        <p>A two-pane JavaScript scratchpad: the source in one pane, whatever it printed in the other.</p>
        <p>
          The code runs in a Web Worker rather than on the page, which is what makes an unbounded loop
          survivable — a watchdog stops the thread after {timeout} ms, and every run gets a
          fresh worker so nothing leaks from one into the next. Output is formatted rather than stringified:
          Maps, Sets, circular references, sparse arrays and getters each print as themselves, and anything
          with members inside it opens where it sits.
        </p>
        <p>
          Press <kbd className="font-mono text-[var(--jp-text)]">⌘↵</kbd> to run once, or
          leave the play button lit to re-run as you type. Layout, theme and run mode are under settings, and
          all of them are remembered.
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
