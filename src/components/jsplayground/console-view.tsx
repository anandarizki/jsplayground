import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Entry, Printed, Token, Tone } from "./types";

/** Tones are abstract in the worker so the mapping lives here, once, next to the
 *  editor's palette. Dark follows the repo's `.dark` on a `group` ancestor. */
const TONE: Record<Tone, string> = {
  plain: "",
  string: "text-emerald-600 group-[.dark]:text-emerald-400",
  number: "text-blue-600 group-[.dark]:text-blue-400",
  boolean: "text-violet-600 group-[.dark]:text-violet-400",
  nullish: "text-zinc-400 group-[.dark]:text-zinc-500",
  key: "text-sky-700 group-[.dark]:text-sky-300",
  punct: "text-zinc-400 group-[.dark]:text-zinc-600",
  fn: "text-amber-600 group-[.dark]:text-amber-400",
  regexp: "text-rose-600 group-[.dark]:text-rose-400",
  error: "text-red-600 group-[.dark]:text-red-400",
  dim: "text-zinc-400 group-[.dark]:text-zinc-500",
};

const LEVEL_ROW: Record<string, string> = {
  log: "",
  info: "",
  debug: "text-zinc-500 group-[.dark]:text-zinc-400",
  warn: "bg-amber-50/70 text-amber-900 group-[.dark]:bg-amber-500/10 group-[.dark]:text-amber-200",
  error: "bg-red-50/70 text-red-800 group-[.dark]:bg-red-500/10 group-[.dark]:text-red-200",
};

function Tokens({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={TONE[token.t]}>
          {token.v}
        </span>
      ))}
    </>
  );
}

/**
 * A container, shut until asked. Open state is deliberately local rather than lifted:
 * entries are keyed by id, so React keeps each toggle's state where it belongs for as
 * long as the row lives, and a new run starts everything shut — which is what you want,
 * since the next run's objects are not the ones you opened.
 */
function Expandable({ node }: { node: Extract<Printed, { n: "c" }> }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-block max-w-full align-top">
      <button
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="-mx-0.5 inline-flex max-w-full items-start gap-0.5 rounded px-0.5 text-left transition hover:bg-zinc-200/70 group-[.dark]:hover:bg-zinc-800/70"
      >
        <ChevronRight
          size={12}
          className={`mt-[3px] shrink-0 text-zinc-400 transition-transform group-[.dark]:text-zinc-500 ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0">
          <Tokens tokens={node.preview} />
        </span>
      </button>

      {open ? (
        <span className="mt-0.5 mb-1 ml-[5px] block border-l border-zinc-200 pl-3 group-[.dark]:border-zinc-800">
          {node.members.map((entry, i) => (
            <span key={i} className="block">
              <Tokens tokens={entry.key} />
              <Node node={entry.value} />
            </span>
          ))}
          {node.hidden > 0 ? (
            <span className="block text-zinc-400 group-[.dark]:text-zinc-500">… {node.hidden} more</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function Node({ node }: { node: Printed }) {
  return node.n === "v" ? <Tokens tokens={node.tokens} /> : <Expandable node={node} />;
}

type Props = {
  entries: Entry[];
  className?: string;
  /** Shown when nothing has printed yet. */
  hint?: string;
};

export function ConsoleView({ entries, className, hint = "console.log(…) to print something here." }: Props) {
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries.length]);

  return (
    <div ref={scroller} className={`overflow-auto font-mono text-[13px] leading-relaxed ${className ?? ""}`}>
      {entries.length === 0 ? (
        <p className="px-4 py-4 text-zinc-400 group-[.dark]:text-zinc-600">{hint}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 group-[.dark]:divide-zinc-800/70">
          {entries.map((entry) => {
            if (entry.kind === "notice") {
              return (
                <li
                  key={entry.id}
                  className="px-4 py-1.5 text-zinc-400 italic group-[.dark]:text-zinc-500"
                >
                  {entry.text}
                </li>
              );
            }

            if (entry.kind === "error") {
              return (
                <li
                  key={entry.id}
                  className="border-l-2 border-red-500 bg-red-50/70 px-4 py-2 group-[.dark]:bg-red-500/10"
                >
                  <span className="font-semibold text-red-600 group-[.dark]:text-red-400">{entry.name}</span>
                  <span className="text-red-700 group-[.dark]:text-red-300">
                    {entry.message ? `: ${entry.message}` : ""}
                  </span>
                  {entry.line !== null ? (
                    <span className="ml-2 text-zinc-400 group-[.dark]:text-zinc-500">
                      line {entry.line}
                      {entry.column !== null ? `:${entry.column}` : ""}
                    </span>
                  ) : null}
                </li>
              );
            }

            return (
              <li key={entry.id} className={`flex items-start gap-3 px-4 py-1.5 ${LEVEL_ROW[entry.level] ?? ""}`}>
                <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                  {entry.parts.map((part, i) => (
                    <span key={i}>
                      {i > 0 ? " " : null}
                      <Node node={part} />
                    </span>
                  ))}
                </span>
                {entry.deferred ? (
                  <span
                    title="printed after the top-level code finished"
                    className="mt-0.5 shrink-0 text-[10px] tracking-wide text-zinc-300 uppercase group-[.dark]:text-zinc-600"
                  >
                    late
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
