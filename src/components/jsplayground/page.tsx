/**
 * A JavaScript playground: two panes, one for the source and one for what it printed.
 *
 * The layout is the part people disagree about, so neither half of it is fixed. The
 * panes sit in rows or in columns, either one can be the top/left, and the divider
 * between them drags.
 *
 * Each pane carries its own status line along the bottom, with the controls that act on
 * that pane at the far end of it: the source says when it will run and holds format and
 * save, the output says how long the last run took and holds the eraser. Nothing sits
 * above a pane, and nothing spans both — the rail keeps only what acts on neither.
 */

import {
  AArrowDown,
  AArrowUp,
  AlignLeft,
  Bookmark,
  BookmarkPlus,
  CircleHelp,
  Eraser,
  Play,
  Settings,
  Square,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { AboutDialog } from "./about-dialog";
import { BookmarksDialog } from "./bookmarks-dialog";
import { ConsoleView } from "./console-view";
import { DEFAULT_FONT_PX, GITHUB_URL, MAX_FONT_PX, MIN_FONT_PX } from "./constants";
import { Editor } from "./editor";
import { ErrorBoundary } from "./error-boundary";
import { formatCode } from "./format";
import { GithubMark } from "./github-mark";
import { SaveBookmarkDialog } from "./save-bookmark-dialog";
import { SettingsDialog } from "./settings-dialog";
import { statusLabel, statusTone } from "./status";
import { appTheme, codeTheme, cssVars } from "./themes";
import { useBookmarks } from "./use-bookmarks";
import { usePlayground } from "./use-playground";
import { useSettings } from "./use-settings";

/**
 * The steps either pane's text takes, bounded so a click that can do nothing says so
 * rather than doing nothing quietly.
 *
 * The number between them is the way back: it is the one part of this that has a value
 * worth reading, and a button that shows what it will undo needs no icon to explain it.
 * At the default it has nothing to undo, so it reads as a label and stops being a
 * button.
 */
function TextSize({
  size,
  onChange,
  onReset,
  what,
  className,
}: {
  size: number;
  onChange: (step: number) => void;
  onReset: () => void;
  what: string;
  className: string;
}) {
  return (
    <>
      <button
        onClick={() => onChange(-1)}
        disabled={size <= MIN_FONT_PX}
        aria-label={`Smaller ${what} text`}
        title={`Smaller ${what} text`}
        className={className}
      >
        <AArrowDown size={15} />
      </button>
      <button
        onClick={onReset}
        disabled={size === DEFAULT_FONT_PX}
        aria-label={`Reset ${what} text size`}
        title={`Reset ${what} text size`}
        className={`${className} w-8 tabular-nums disabled:opacity-100`}
      >
        {size}
      </button>
      <button
        onClick={() => onChange(1)}
        disabled={size >= MAX_FONT_PX}
        aria-label={`Larger ${what} text`}
        title={`Larger ${what} text`}
        className={className}
      >
        <AArrowUp size={15} />
      </button>
    </>
  );
}

export default function JsPlayground() {
  const { settings, update } = useSettings();
  const { mode, orientation, outputFirst, split } = settings;
  const { code, setCode, dirty, runNow, runner } = usePlayground(mode, settings.timeout);
  const { bookmarks, add, remove } = useBookmarks();

  const app = appTheme(settings.theme);
  const palette = codeTheme(settings.code);
  // Not a setting: nobody wants the dialog they closed to come back next visit.
  const [dialog, setDialog] = useState<"bookmarks" | "save" | "settings" | "about" | null>(null);
  // Unformattable code is nearly always code that does not parse, and the output pane
  // says so in more detail the moment it runs. The status line only has to admit the
  // button did nothing, and then stop saying it.
  const [unformattable, setUnformattable] = useState(false);

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

  useEffect(() => {
    if (!unformattable) return;
    const timer = window.setTimeout(() => setUnformattable(false), 3000);
    return () => window.clearTimeout(timer);
  }, [unformattable]);

  const format = async () => {
    try {
      const formatted = await formatCode(code);
      setUnformattable(false);
      if (formatted !== code) setCode(formatted);
    } catch {
      setUnformattable(true);
    }
  };

  // Swapping moves each pane's size with it, so the one you had made tall stays tall.
  const swap = () => update({ outputFirst: !outputFirst, split: 100 - split });

  const rail =
    "flex h-9 w-9 items-center justify-center rounded-lg text-[var(--jp-faint)] transition hover:bg-[var(--jp-hover)] hover:text-[var(--jp-text)]";
  const railOn = "bg-[var(--jp-active)] text-[var(--jp-text)]";
  // What the pane has to say on the left, what you can do to it on the right. It is the
  // pane's last flex item and the content above it is the one that grows, so it sits on
  // the pane's bottom edge however little there is above it.
  const paneFooter =
    "flex h-9 shrink-0 items-center justify-between gap-3 px-4 font-mono text-[11px] text-[var(--jp-muted)]";
  // No rule above the line: the pane it belongs to is the only surface either of them
  // has, so a border would be drawing a seam through one thing.
  const paneButton =
    "flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--jp-hover)] hover:text-[var(--jp-text)] disabled:pointer-events-none disabled:opacity-30";

  const source = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <Editor
          value={code}
          onChange={setCode}
          onRun={runNow}
          code={palette}
          size={settings.editorSize}
          className="h-full"
        />
      </div>
      <div className={paneFooter}>
        {/* The one line this pane has to itself, so a failed format borrows it rather
            than opening somewhere of its own. */}
        <span className={unformattable ? "text-[var(--jp-error)]" : undefined}>
          {unformattable ? "cannot format" : mode === "auto" ? "runs as you type" : "⌘↵ to run"}
        </span>
        <div className="-mr-1.5 flex items-center gap-0.5">
          <TextSize
            size={settings.editorSize}
            onChange={(step) => update((previous) => ({ editorSize: previous.editorSize + step }))}
            onReset={() => update({ editorSize: DEFAULT_FONT_PX })}
            what="editor"
            className={paneButton}
          />
          <span className="mx-1 h-4 w-px bg-[var(--jp-border)]" />
          <button onClick={format} aria-label="Format code" title="Format code" className={paneButton}>
            <AlignLeft size={15} />
          </button>
          <button
            onClick={() => setDialog("save")}
            aria-label="Save as bookmark"
            title="Save as bookmark"
            className={paneButton}
          >
            <BookmarkPlus size={15} />
          </button>
        </div>
      </div>
    </section>
  );

  const output = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Keyed on the generation so the eraser and the next run both give the boundary
          a fresh instance: the row it could not draw is gone, and the pane should not go
          on saying otherwise. */}
      <ErrorBoundary
        key={runner.generation}
        fallback={
          <p
            className="flex-1 overflow-auto px-4 py-4 font-mono text-[var(--jp-error)]"
            style={{ fontSize: `${settings.consoleSize}px` }}
          >
            The output could not be drawn. Erase it to continue.
          </p>
        }
      >
        <ConsoleView
          entries={runner.entries}
          className="flex-1"
          hint="› output appears here"
          colour={settings.consoleColor}
          openByDefault={settings.consoleOpen}
          size={settings.consoleSize}
        />
      </ErrorBoundary>
      <div className={paneFooter}>
        <span className={statusTone(runner)}>{statusLabel(runner)}</span>
        <div className="-mr-1.5 flex items-center gap-0.5">
          <TextSize
            size={settings.consoleSize}
            onChange={(step) => update((previous) => ({ consoleSize: previous.consoleSize + step }))}
            onReset={() => update({ consoleSize: DEFAULT_FONT_PX })}
            what="output"
            className={paneButton}
          />
          <span className="mx-1 h-4 w-px bg-[var(--jp-border)]" />
          <button onClick={runner.clear} aria-label="Erase output" title="Erase output" className={paneButton}>
            <Eraser size={15} />
          </button>
        </div>
      </div>
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
          // A run in flight takes the slot over: same square, urgent colour, and it
          // kills the worker rather than changing when the next run happens.
          <button onClick={runner.cancel} aria-label="Stop this run" title="Stop this run" className={`${rail} text-[var(--jp-error)]`}>
            <Square size={15} fill="currentColor" />
          </button>
        ) : (
          // One control, two states, and the glyph is what says which: a square while
          // the code re-runs as you type, because pressing it stops that; a triangle
          // while the result is frozen, because pressing it starts it again. A colour
          // would be saying the same thing a second time, and less plainly.
          <button
            onClick={() => update({ mode: mode === "auto" ? "manual" : "auto" })}
            aria-label={mode === "auto" ? "Stop running on every keystroke" : "Run on every keystroke"}
            aria-pressed={mode === "auto"}
            title={mode === "auto" ? "Live — click to freeze" : "Frozen — click to run as you type"}
            className={`${rail} relative text-[var(--jp-text)]`}
          >
            {mode === "auto" ? (
              <Square size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            {mode === "manual" && dirty ? (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--jp-warn)]" />
            ) : null}
          </button>
        )}

        <button
          onClick={() => setDialog((open) => (open === "bookmarks" ? null : "bookmarks"))}
          aria-label="Bookmarks"
          aria-expanded={dialog === "bookmarks"}
          title="Snippets to load"
          className={`${rail} ${dialog === "bookmarks" ? railOn : ""}`}
        >
          <Bookmark size={15} />
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

      <div ref={frame} className={`flex min-h-0 min-w-0 flex-1 ${columns ? "flex-row" : "flex-col"}`}>
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

      {dialog === "bookmarks" ? (
        <BookmarksDialog
          bookmarks={bookmarks}
          onPick={setCode}
          onRemove={remove}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "save" ? (
        <SaveBookmarkDialog onSave={(title) => add(title, code)} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "settings" ? (
        <SettingsDialog settings={settings} update={update} onSwap={swap} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "about" ? <AboutDialog timeout={settings.timeout} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
