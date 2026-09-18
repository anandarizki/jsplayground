/**
 * A JavaScript playground: two panes, one for the source and one for what it printed.
 *
 * The layout is the part people disagree about, so neither half of it is fixed. The
 * panes sit in rows or in columns, either one can be the top/left, and the divider
 * between them drags. What does not move is the rail: every control is in it, so the
 * panes themselves stay free of chrome.
 */

import { CircleHelp, Eraser, Play, Settings, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AboutDialog } from "./about-dialog";
import { ConsoleView } from "./console-view";
import { EXAMPLES, GITHUB_URL } from "./constants";
import { Editor } from "./editor";
import { GithubMark } from "./github-mark";
import { SettingsDialog } from "./settings-dialog";
import { statusLabel, statusTone } from "./status";
import { usePlayground } from "./use-playground";
import { useSettings } from "./use-settings";

export default function JsPlayground() {
  const { settings, update, ready } = useSettings();
  const { dark, mode, orientation, outputFirst, split } = settings;
  const { code, setCode, dirty, runNow, runner } = usePlayground(mode, ready);
  // Not a setting: nobody wants the dialog they closed to come back next visit.
  const [dialog, setDialog] = useState<"settings" | "about" | null>(null);

  const frame = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const columns = orientation === "columns";

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!dragging.current || !frame.current) return;
      const box = frame.current.getBoundingClientRect();
      const pct = columns
        ? ((event.clientX - box.left) / box.width) * 100
        : ((event.clientY - box.top) / box.height) * 100;
      update({ split: Math.min(88, Math.max(12, pct)) });
    };
    const up = () => {
      dragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [columns, update]);

  // Swapping moves each pane's size with it, so the one you had made tall stays tall.
  const swap = () => update({ outputFirst: !outputFirst, split: 100 - split });

  const rail =
    "flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-900 group-[.dark]:hover:bg-zinc-800 group-[.dark]:hover:text-zinc-100";
  const paneHeader =
    "flex h-9 shrink-0 items-center justify-between gap-3 px-4 font-mono text-[11px] text-zinc-400 group-[.dark]:text-zinc-600";

  const source = (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className={paneHeader}>
        <span>source</span>
        <div className="flex gap-3">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              onClick={() => setCode(example.code)}
              className="transition hover:text-zinc-900 group-[.dark]:hover:text-zinc-100"
            >
              {example.label.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-t border-zinc-200 group-[.dark]:border-zinc-800">
        <Editor value={code} onChange={setCode} onRun={runNow} dark={dark} className="h-full" />
      </div>
    </section>
  );

  const output = (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className={paneHeader}>
        <span>output</span>
        <button onClick={runner.clear} className="transition hover:text-zinc-900 group-[.dark]:hover:text-zinc-100">
          clear
        </button>
      </div>
      <ConsoleView
        entries={runner.entries}
        className="flex-1 border-t border-zinc-200 group-[.dark]:border-zinc-800"
        hint="› output appears here"
      />
    </section>
  );

  const [first, second] = outputFirst ? [output, source] : [source, output];

  return (
    <div
      // `color-scheme` is what gets the console pane's scrollbar to match the theme.
      style={{ colorScheme: dark ? "dark" : "light" }}
      className={`group flex h-dvh ${dark ? "dark bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"}`}
    >
      <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 py-3 group-[.dark]:border-zinc-800">
        {runner.status === "running" ? (
          <button onClick={runner.cancel} aria-label="Stop" className={`${rail} text-red-500`}>
            <Square size={15} fill="currentColor" />
          </button>
        ) : (
          // One control, two states. Lit means live: the code re-runs as you type.
          // Unlit means the result is frozen until you ask for one with ⌘↵.
          <button
            onClick={() => update({ mode: mode === "auto" ? "manual" : "auto" })}
            aria-label={mode === "auto" ? "Stop running on every keystroke" : "Run on every keystroke"}
            aria-pressed={mode === "auto"}
            title={mode === "auto" ? "Live — click to freeze" : "Frozen — click to run as you type"}
            className={`${rail} relative ${
              mode === "auto"
                ? "bg-emerald-100 text-emerald-600 group-[.dark]:bg-emerald-500/15 group-[.dark]:text-emerald-400"
                : "text-zinc-900 group-[.dark]:text-zinc-100"
            }`}
          >
            <Play size={15} fill="currentColor" />
            {mode === "manual" && dirty ? (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
            ) : null}
          </button>
        )}

        <button onClick={runner.clear} aria-label="Clear output" className={rail}>
          <Eraser size={15} />
        </button>

        {/* Pushed to the foot of the rail: none of these touch the code. */}
        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={() => setDialog((open) => (open === "settings" ? null : "settings"))}
            aria-label="Settings"
            aria-expanded={dialog === "settings"}
            title="Layout, theme and when it runs"
            className={`${rail} ${dialog === "settings" ? "bg-zinc-200 text-zinc-900 group-[.dark]:bg-zinc-800 group-[.dark]:text-zinc-100" : ""}`}
          >
            <Settings size={15} />
          </button>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            title="Source on GitHub"
            className={rail}
          >
            <GithubMark />
          </a>

          <button
            onClick={() => setDialog((open) => (open === "about" ? null : "about"))}
            aria-label="About this app"
            aria-expanded={dialog === "about"}
            title="About this app"
            className={`${rail} ${dialog === "about" ? "bg-zinc-200 text-zinc-900 group-[.dark]:bg-zinc-800 group-[.dark]:text-zinc-100" : ""}`}
          >
            <CircleHelp size={15} />
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={frame} className={`flex min-h-0 flex-1 ${columns ? "flex-row" : "flex-col"}`}>
          <div className="flex min-h-0 min-w-0 flex-col" style={{ flex: `0 0 ${split}%` }}>
            {first}
          </div>

          <div
            onMouseDown={() => {
              dragging.current = true;
              document.body.style.userSelect = "none";
            }}
            onDoubleClick={() => update({ split: 50 })}
            className={`relative shrink-0 bg-zinc-200 group-[.dark]:bg-zinc-800 ${
              columns ? "w-px cursor-col-resize" : "h-px cursor-row-resize"
            }`}
          >
            <span className={`absolute block ${columns ? "inset-y-0 -left-2 -right-2" : "inset-x-0 -top-2 -bottom-2"}`} />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{second}</div>
        </div>

        {/* Left half is deliberately empty: the byline chip is pinned there. */}
        <footer className="flex h-8 shrink-0 items-center justify-end gap-5 border-t border-zinc-200 px-4 font-mono text-[11px] text-zinc-400 group-[.dark]:border-zinc-800 group-[.dark]:text-zinc-600">
          <span>{mode === "auto" ? "runs as you type" : "⌘↵ to run"}</span>
          <span className={statusTone(runner)}>{statusLabel(runner)}</span>
        </footer>
      </div>

      {dialog === "settings" ? (
        <SettingsDialog settings={settings} update={update} onSwap={swap} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "about" ? <AboutDialog onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
