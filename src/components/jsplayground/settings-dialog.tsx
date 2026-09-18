import type { ReactNode } from "react";

import { Dialog } from "./dialog";
import type { Settings } from "./use-settings";

/** A row of mutually exclusive choices. Every setting in here is one of a small closed
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
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 group-[.dark]:bg-zinc-800/60">
      {options.map((option) => {
        const picked = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={picked}
            className={`flex-1 rounded-md px-3 py-1.5 text-[13px] transition ${
              picked
                ? "bg-white text-zinc-900 shadow-sm group-[.dark]:bg-zinc-700 group-[.dark]:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 group-[.dark]:text-zinc-400 group-[.dark]:hover:text-zinc-100"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-wide text-zinc-400 uppercase group-[.dark]:text-zinc-500">{label}</p>
      <p className="mt-0.5 mb-2 text-[12px] text-zinc-500 group-[.dark]:text-zinc-400">{hint}</p>
      {children}
    </div>
  );
}

type Props = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  /** Swapping has to move each pane's size with it, which is more than a field can say. */
  onSwap: () => void;
  onClose: () => void;
};

/**
 * Everything that is remembered, in one place.
 *
 * These used to be three unlabelled buttons in the rail, which meant their state was
 * only legible as an icon and there was nowhere to say what they did. The rail keeps the
 * two controls you reach for while writing — run and clear — and the rest lives here.
 */
export function SettingsDialog({ settings, update, onSwap, onClose }: Props) {
  const { dark, mode, orientation, outputFirst, split } = settings;
  const columns = orientation === "columns";

  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="mt-5 space-y-5">
        <Field label="Theme" hint="The editor and the console share one palette.">
          <Choice
            value={dark ? "dark" : "light"}
            onChange={(next) => update({ dark: next === "dark" })}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Field>

        <Field label="Layout" hint="How the source and output panes sit against each other.">
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

        <Field label="Running" hint="Live re-runs as you type, debounced. ⌘↵ runs once either way.">
          <Choice
            value={mode}
            onChange={(next) => update({ mode: next })}
            options={[
              { value: "auto", label: "Live" },
              { value: "manual", label: "On ⌘↵" },
            ]}
          />
        </Field>

        <Field label="Divider" hint="Drag it to resize, or double-click it to even the panes up.">
          <button
            onClick={() => update({ split: 50 })}
            disabled={Math.round(split) === 50}
            className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-[13px] text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40 group-[.dark]:border-zinc-800 group-[.dark]:text-zinc-400 group-[.dark]:hover:bg-zinc-800 group-[.dark]:hover:text-zinc-100"
          >
            {Math.round(split) === 50 ? "Panes are even" : "Even the panes up"}
          </button>
        </Field>
      </div>
    </Dialog>
  );
}
