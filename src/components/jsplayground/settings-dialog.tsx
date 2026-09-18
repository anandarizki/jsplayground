import { useState, type ReactNode } from "react";

import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "./constants";
import { Dialog } from "./dialog";
import { APP_THEMES, appTheme, codeTheme, codeThemesFor } from "./themes";
import type { Settings, Update } from "./use-settings";

const TABS = ["Theme", "Layout", "Console", "Running"] as const;
type Tab = (typeof TABS)[number];

/** A row of mutually exclusive choices. Most settings here are one of a small closed
 *  set, so nothing needs a dropdown. */
function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-[var(--jp-hover)] p-1">
      {options.map((option) => {
        const picked = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={picked}
            className={`flex-1 rounded-md px-3 py-1.5 text-[13px] transition ${
              picked
                ? "bg-[var(--jp-panel)] text-[var(--jp-text)] shadow-sm"
                : "text-[var(--jp-muted)] hover:text-[var(--jp-text)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A named palette, shown as the colours it actually is. A theme list that describes its
 * entries in words is a list you have to try one at a time.
 *
 * An app theme wears its own background and text colour, because that pairing is most of
 * what it is — the tile shows you the window. A code theme has no background to show, so
 * its tile stays on the current surface and says what it is in dots.
 */
function Swatches({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { id: string; name: string; dots: string[]; bg?: string; text?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const picked = option.id === value;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            aria-pressed={picked}
            style={option.bg ? { backgroundColor: option.bg, color: option.text } : undefined}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
              picked ? "border-[var(--jp-accent)] ring-1 ring-[var(--jp-accent)]" : "border-[var(--jp-border)]"
            } ${option.bg ? "" : "text-[var(--jp-text)] hover:bg-[var(--jp-hover)]"}`}
          >
            <span className="truncate text-[13px]">{option.name}</span>
            <span className="flex shrink-0 gap-1">
              {/* Keyed by position: a palette may well use one colour twice. */}
              {option.dots.map((colour, i) => (
                <span
                  key={i}
                  style={{ backgroundColor: colour }}
                  className="h-3 w-3 rounded-full border border-[var(--jp-border)]"
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-wide text-[var(--jp-faint)] uppercase">{label}</p>
      <p className="mt-0.5 mb-2 text-[12px] text-[var(--jp-muted)]">{hint}</p>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex w-full items-start gap-3 rounded-lg border border-[var(--jp-border)] p-3 text-left transition hover:bg-[var(--jp-hover)]"
    >
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition ${
          value ? "bg-[var(--jp-accent)]" : "bg-[var(--jp-border)]"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-[var(--jp-panel)] transition-transform ${value ? "translate-x-3" : ""}`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-[var(--jp-text)]">{label}</span>
        <span className="mt-0.5 block text-[12px] text-[var(--jp-muted)]">{hint}</span>
      </span>
    </button>
  );
}

type Props = {
  settings: Settings;
  update: Update;
  /** Swapping has to move each pane's size with it, which is more than a field can say. */
  onSwap: () => void;
  onClose: () => void;
};

/**
 * Everything that is remembered, in one place.
 *
 * Four tabs rather than one long column: the settings fall into groups that are read at
 * different times — a theme is picked once, a timeout is changed while something is
 * misbehaving — and a list that mixes them makes you re-read all of it to find one.
 */
export function SettingsDialog({ settings, update, onSwap, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("Theme");
  const { mode, orientation, outputFirst, split, timeout } = settings;
  const columns = orientation === "columns";
  const app = appTheme(settings.theme);
  const code = codeTheme(settings.code);

  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="mt-4 flex gap-1 rounded-lg bg-[var(--jp-hover)] p-1">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            aria-pressed={tab === name}
            className={`flex-1 rounded-md px-2 py-1.5 text-[12px] transition ${
              tab === name
                ? "bg-[var(--jp-panel)] text-[var(--jp-text)] shadow-sm"
                : "text-[var(--jp-muted)] hover:text-[var(--jp-text)]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {tab === "Theme" ? (
          <>
            <Field label="App" hint="The rail, the pane status lines and these dialogs.">
              <Swatches
                value={settings.theme}
                onChange={(next) => update({ theme: next })}
                options={APP_THEMES.map((t) => ({
                  id: t.id,
                  name: t.name,
                  bg: t.bg,
                  text: t.text,
                  dots: [t.accent, t.muted, t.border],
                }))}
              />
            </Field>

            <Field
              label="Code"
              hint={`Syntax in both panes. ${app.dark ? "Dark" : "Light"} set, for ${app.name}.`}
            >
              <Swatches
                value={settings.code}
                onChange={(next) => update({ code: next })}
                options={codeThemesFor(app.dark).map((t) => ({
                  id: t.id,
                  name: t.name,
                  dots: [t.keyword, t.string, t.number],
                }))}
              />
            </Field>
          </>
        ) : null}

        {tab === "Layout" ? (
          <>
            <Field label="Panes" hint="How the source and output sit against each other.">
              <Choice
                value={orientation}
                onChange={(next) => update({ orientation: next })}
                options={[
                  { value: "rows", label: "Stacked" },
                  { value: "columns", label: "Side by side" },
                ]}
              />
            </Field>

            <Field label="First pane" hint={columns ? "Which one is on the left." : "Which one is on top."}>
              <Choice
                value={outputFirst ? "output" : "source"}
                onChange={(next) => {
                  if ((next === "output") !== outputFirst) onSwap();
                }}
                options={[
                  { value: "source", label: "Source" },
                  { value: "output", label: "Output" },
                ]}
              />
            </Field>

            <Field label="Divider" hint="Drag it to resize, or double-click it to even the panes up.">
              <button
                onClick={() => update({ split: 50 })}
                disabled={Math.round(split) === 50}
                className="w-full rounded-lg border border-[var(--jp-border)] px-3 py-1.5 text-[13px] text-[var(--jp-muted)] transition hover:bg-[var(--jp-hover)] hover:text-[var(--jp-text)] disabled:pointer-events-none disabled:opacity-40"
              >
                {Math.round(split) === 50 ? "Panes are even" : "Even the panes up"}
              </button>
            </Field>
          </>
        ) : null}

        {tab === "Console" ? (
          <>
            <Toggle
              label="Start expanded"
              hint="Objects and arrays arrive open instead of shut. Deep output gets long."
              value={settings.consoleOpen}
              onChange={(next) => update({ consoleOpen: next })}
            />
            <Toggle
              label="Colour the output"
              hint="Off prints everything in the code theme's plain text colour."
              value={settings.consoleColor}
              onChange={(next) => update({ consoleColor: next })}
            />
            <div className="rounded-lg border border-[var(--jp-border)] bg-[var(--jp-bg)] p-3 font-mono text-[12px]">
              <span style={{ color: settings.consoleColor ? code.property : code.text }}>title</span>
              <span style={{ color: settings.consoleColor ? code.operator : code.text }}>: </span>
              <span style={{ color: settings.consoleColor ? code.string : code.text }}>'first coat'</span>
            </div>
          </>
        ) : null}

        {tab === "Running" ? (
          <>
            <Field label="When" hint="Live re-runs as you type, debounced. ⌘↵ runs once either way.">
              <Choice
                value={mode}
                onChange={(next) => update({ mode: next })}
                options={[
                  { value: "auto", label: "Live" },
                  { value: "manual", label: "On ⌘↵" },
                ]}
              />
            </Field>

            <Field
              label={`Timeout — ${timeout} ms`}
              hint="How long the code may run before the worker is killed. An unbounded loop can only be stopped from outside, so this is the only thing that ends one."
            >
              <input
                type="range"
                min={MIN_TIMEOUT_MS}
                max={MAX_TIMEOUT_MS}
                step={100}
                value={timeout}
                onChange={(event) => update({ timeout: Number(event.target.value) })}
                aria-label="Timeout in milliseconds"
                className="w-full accent-[var(--jp-accent)]"
              />
              <div className="mt-1 flex justify-between font-mono text-[11px] text-[var(--jp-faint)]">
                <span>{MIN_TIMEOUT_MS} ms</span>
                <span>{MAX_TIMEOUT_MS} ms</span>
              </div>
            </Field>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
