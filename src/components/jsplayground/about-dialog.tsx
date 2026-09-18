import { GITHUB_URL, RUN_TIMEOUT_MS } from "./constants";
import { Dialog } from "./dialog";

const LINK = "underline underline-offset-2 transition hover:text-zinc-900 group-[.dark]:hover:text-zinc-100";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="JSPlayground" onClose={onClose}>
      <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-zinc-600 group-[.dark]:text-zinc-400">
        <p>A two-pane JavaScript scratchpad: the source in one pane, whatever it printed in the other.</p>
        <p>
          The code runs in a Web Worker rather than on the page, which is what makes an unbounded loop
          survivable — a watchdog stops the thread after {RUN_TIMEOUT_MS / 1000} seconds, and every run gets a
          fresh worker so nothing leaks from one into the next. Output is formatted rather than stringified:
          Maps, Sets, circular references, sparse arrays and getters each print as themselves, and anything
          with members inside it opens where it sits.
        </p>
        <p>
          Press <kbd className="font-mono text-zinc-500 group-[.dark]:text-zinc-400">⌘↵</kbd> to run once, or
          leave the play button lit to re-run as you type. Layout, theme and run mode are under settings, and
          all of them are remembered.
        </p>
      </div>

      <p className="mt-5 border-t border-zinc-200 pt-4 font-mono text-[11px] text-zinc-400 group-[.dark]:border-zinc-800 group-[.dark]:text-zinc-500">
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
