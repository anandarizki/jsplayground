/**
 * A JavaScript playground: two panes, one for the source and one for what it printed.
 *
 * The layout is the part people disagree about, so neither half of it is fixed. The
 * panes sit in rows or in columns, either one can be the top/left, and the divider
 * between them drags. What does not move is the rail: every control is in it, so the
 * panes themselves stay free of chrome.
 */

import { CircleHelp, Eraser, Play, Settings, Square } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { AboutDialog } from "./about-dialog";
import { ConsoleView } from "./console-view";
import { EXAMPLES, GITHUB_URL } from "./constants";
import { Editor } from "./editor";
import { GithubMark } from "./github-mark";
import { SettingsDialog } from "./settings-dialog";
import { statusLabel, statusTone } from "./status";
import { appTheme, codeTheme, cssVars } from "./themes";
import { usePlayground } from "./use-playground";
import { useSettings } from "./use-settings";

export default function JsPlayground() {
  const { settings, update, ready } = useSettings();
  const { mode, orientation, outputFirst, split } = settings;
  const { code, setCode, dirty, runNow, runner } = usePlayground(mode, ready, settings.timeout);

  const app = appTheme(settings.theme);
  const palette = codeTheme(settings.code);
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
    "flex h-9 w-9 items-center justify-center rounded-lg text-[var(--jp-faint)] transition hover:bg-[var(--jp-hover)] hover:text-[var(--jp-text)]";
  const railOn = "bg-[var(--jp-active)] text-[var(--jp-text)]";
  const paneHeader =
    "flex h-9 shrink-0 items-center justify-between gap-3 px-4 font-mono text-[11px] text-[var(--jp-muted)]";

  const source = (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className={paneHeader}>
        <span>source</span>
        <div className="flex gap-3">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              onClick={() => setCode(example.code)}
              className="transition hover:text-[var(--jp-text)]"
            >
              {example.label.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border-t border-[var(--jp-border)]">
        <Editor value={code} onChange={setCode} onRun={runNow} code={palette} className="h-full" />
      </div>
    </section>
  );

  const output = (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className={paneHeader}>
        <span>output</span>
        <button onClick={runner.clear} className="transition hover:text-[var(--jp-text)]">
          clear
        </button>
      </div>
      <ConsoleView
        entries={runner.entries}
        className="flex-1 border-t border-[var(--jp-border)]"
        hint="› output appears here"
        colour={settings.consoleColor}
        openByDefault={settings.consoleOpen}
      />
    </section>
  );

  const [first, second] = outputFirst ? [output, source] : [source, output];

  return (
    <div
      // Both palettes land here as custom properties; everything below reads them rather
      // than naming a colour. `color-scheme` is what matches the scrollbars to the theme.
      style={{ colorScheme: app.dark ? "dark" : "light", ...cssVars(app, palette) } as CSSProperties}
      className="flex h-dvh bg-[var(--jp-bg)] text-[var(--jp-text)]"
    >
      <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-[var(--jp-border)] py-3">
        {runner.status === "running" ? (
          <button onClick={runner.cancel} aria-label="Stop" className={`${rail} text-[var(--jp-error)]`}>
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
                ? "bg-[var(--jp-accent-bg)] text-[var(--jp-accent)]"
                : "text-[var(--jp-text)]"
            }`}
          >
            <Play size={15} fill="currentColor" />
            {mode === "manual" && dirty ? (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--jp-warn)]" />
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
            className={`${rail} ${dialog === "settings" ? railOn : ""}`}
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
            className={`${rail} ${dialog === "about" ? railOn : ""}`}
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
            className={`relative shrink-0 bg-[var(--jp-border)] ${
              columns ? "w-px cursor-col-resize" : "h-px cursor-row-resize"
            }`}
          >
            <span className={`absolute block ${columns ? "inset-y-0 -left-2 -right-2" : "inset-x-0 -top-2 -bottom-2"}`} />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{second}</div>
        </div>

        {/* Left half is deliberately empty: the byline chip is pinned there. */}
        <footer className="flex h-8 shrink-0 items-center justify-end gap-5 border-t border-[var(--jp-border)] px-4 font-mono text-[11px] text-[var(--jp-muted)]">
          <span>{mode === "auto" ? "runs as you type" : "⌘↵ to run"}</span>
          <span className={statusTone(runner)}>{statusLabel(runner)}</span>
        </footer>
      </div>

      {dialog === "settings" ? (
        <SettingsDialog settings={settings} update={update} onSwap={swap} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "about" ? <AboutDialog timeout={settings.timeout} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
