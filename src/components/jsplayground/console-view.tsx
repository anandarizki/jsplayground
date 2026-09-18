import { ChevronRight } from "lucide-react";
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_FONT_PX } from "./constants";
import type { Entry, Member, Printed, Token, Tone } from "./types";

/**
 * Tones are abstract in the worker so the mapping lives here, once, and resolves to the
 * code palette — the same one the editor is using. A string is then the same green
 * whether you are writing it or reading what it printed.
 */
const TONE: Record<Tone, string> = {
  plain: "var(--jp-code-text)",
  string: "var(--jp-code-string)",
  number: "var(--jp-code-number)",
  boolean: "var(--jp-code-keyword)",
  nullish: "var(--jp-code-comment)",
  key: "var(--jp-code-property)",
  punct: "var(--jp-code-operator)",
  fn: "var(--jp-code-def)",
  regexp: "var(--jp-code-type)",
  error: "var(--jp-code-error)",
  dim: "var(--jp-code-comment)",
};

/** How the output behaves, rather than what it says. Passed by context because it is
 *  read at every depth and threading it through each node would say nothing useful. */
type Options = { colour: boolean; openByDefault: boolean };
const Options = createContext<Options>({ colour: true, openByDefault: false });

function Tokens({ tokens }: { tokens: Token[] }) {
  const { colour } = useContext(Options);
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} style={colour ? { color: TONE[token.t] } : undefined}>
          {token.v}
        </span>
      ))}
    </>
  );
}

/** How close to the bottom still counts as being at it, for the purpose of following
 *  new output. A line's height, roughly. */
const NEAR_BOTTOM = 40;

/** Chevron column: the glyph plus its gap. Rows without a chevron are padded by it so
 *  every key in a level starts at the same column. */
const GUTTER = "pl-[14px]";

/** One level of nesting. The guide line runs under the chevron that opened it. */
const BRANCH = "ml-[6px] border-l border-[var(--jp-border)] pl-3";

/**
 * A container and, when open, its members.
 *
 * The whole thing is a block, and the members are a sibling of the summary rather than
 * a continuation of it. That is the difference between a level indenting by a fixed
 * step and indenting by however long the key that introduced it happened to be — which
 * puts every chevron in a level on the same column and makes the tree scannable.
 *
 * Open state is deliberately local rather than lifted: entries are keyed by id, so React
 * keeps each toggle's state where it belongs for as long as the row lives, and a new run
 * starts everything as the setting says.
 */
function Branch({ node, label }: { node: Extract<Printed, { n: "c" }>; label?: Token[] }) {
  const { openByDefault } = useContext(Options);
  const [open, setOpen] = useState(openByDefault);

  return (
    <span className="block">
      <button
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="-mx-0.5 flex w-full items-start gap-0.5 rounded px-0.5 text-left transition hover:bg-[var(--jp-hover)]"
      >
        <ChevronRight
          size={12}
          className={`mt-[3px] shrink-0 text-[var(--jp-faint)] transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1">
          {label ? <Tokens tokens={label} /> : null}
          <Tokens tokens={open ? node.head : node.preview} />
        </span>
      </button>

      {open ? (
        <>
          <span className={`block ${BRANCH}`}>
            {node.members.map((member, i) => (
              <MemberRow key={i} member={member} />
            ))}
            {node.hidden > 0 ? (
              <span className="block text-[var(--jp-faint)]">… {node.hidden} more</span>
            ) : null}
          </span>
          {/* Aligned with the key that opened the level, not with the brace itself —
              the same place a closing brace goes in the source you are writing. */}
          <span className={`block ${GUTTER}`}>
            <Tokens tokens={node.tail} />
          </span>
        </>
      ) : null}
    </span>
  );
}

const MemberRow = memo(function MemberRow({ member }: { member: Member }) {
  if (member.value.n === "c") return <Branch node={member.value} label={member.key} />;
  return (
    <span className={`block ${GUTTER}`}>
      <Tokens tokens={member.key} />
      <Tokens tokens={member.value.tokens} />
    </span>
  );
});

/**
 * A console argument. Expandable ones are inline-block so `console.log("x", obj)` keeps
 * its summary on one line, and the tree grows downward from there.
 *
 * Memoised because this is where the tree recurses: a node the worker handed over is
 * never mutated, so opening one branch has nothing to say to its siblings or to what is
 * already drawn beneath it.
 */
const Node = memo(function Node({ node }: { node: Printed }) {
  if (node.n === "v") return <Tokens tokens={node.tokens} />;
  return (
    <span className="inline-block max-w-full align-top">
      <Branch node={node} />
    </span>
  );
});

/**
 * One line of output.
 *
 * Its own component so it can be memoised: entries are immutable and appended, so a run
 * that adds a line has nothing to say to the lines already drawn. The key that keys this
 * is the parent's business — it carries the "start open" setting as well as the id, so
 * flipping that setting reaches rows already on screen rather than only the next run's.
 */
const EntryRow = memo(function EntryRow({ entry }: { entry: Entry }) {
  if (entry.kind === "notice") {
    return <li className="px-4 py-1.5 text-[var(--jp-faint)] italic">{entry.text}</li>;
  }

  if (entry.kind === "error") {
    return (
      <li className="border-l-2 border-[var(--jp-error)] bg-[var(--jp-error-bg)] px-4 py-2">
        <span className="font-semibold text-[var(--jp-error)]">{entry.name}</span>
        <span className="text-[var(--jp-error)]">{entry.message ? `: ${entry.message}` : ""}</span>
        {entry.line !== null ? (
          <span className="ml-2 text-[var(--jp-muted)]">
            line {entry.line}
            {entry.column !== null ? `:${entry.column}` : ""}
          </span>
        ) : null}
      </li>
    );
  }

  const row =
    entry.level === "warn"
      ? "bg-[var(--jp-warn-bg)] text-[var(--jp-warn)]"
      : entry.level === "error"
        ? "bg-[var(--jp-error-bg)] text-[var(--jp-error)]"
        : entry.level === "debug"
          ? "text-[var(--jp-muted)]"
          : "";

  return (
    <li className={`flex items-start gap-3 px-4 py-1.5 ${row}`}>
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
          className="mt-0.5 shrink-0 text-[0.77em] tracking-wide text-[var(--jp-faint)] uppercase"
        >
          late
        </span>
      ) : null}
    </li>
  );
});

type Props = {
  entries: Entry[];
  className?: string;
  /** Shown when nothing has printed yet. */
  hint?: string;
  /** Whether tones are applied at all. */
  colour?: boolean;
  /** Whether containers arrive open. */
  openByDefault?: boolean;
  /** Text size in pixels. Everything inside is sized in `em`, so this scales the lot. */
  size?: number;
};

/**
 * Memoised, and so is everything under it. The page re-renders on every keystroke, every
 * frame of a divider drag and every change of status, and none of those have anything to
 * say to what has already printed.
 */
export const ConsoleView = memo(function ConsoleView({
  entries,
  className,
  hint = "console.log(…) to print something here.",
  colour = true,
  openByDefault = false,
  size = DEFAULT_FONT_PX,
}: Props) {
  const scroller = useRef<HTMLDivElement | null>(null);
  // Whether the view was at the bottom, and so whether it should follow what is printed
  // next. It has to be recorded as the person scrolls, because by the time a new line has
  // arrived the measurement it depends on has already changed.
  const following = useRef(true);

  const onScroll = () => {
    const node = scroller.current;
    if (node) following.current = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM;
  };

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    // An empty pane is at its bottom by definition, so a new run always follows again.
    if (entries.length === 0) following.current = true;
    if (following.current) node.scrollTop = node.scrollHeight;
  }, [entries.length]);

  // A fresh object here would be a new context value on every render, which is every
  // memo below this point defeated at once.
  const options = useMemo(() => ({ colour, openByDefault }), [colour, openByDefault]);

  return (
    <Options value={options}>
      <div
        ref={scroller}
        onScroll={onScroll}
        style={{ fontSize: `${size}px` }}
        className={`overflow-auto font-mono leading-relaxed text-[var(--jp-code-text)] ${className ?? ""}`}
      >
        {entries.length === 0 ? (
          <p className="px-4 py-4 text-[var(--jp-faint)]">{hint}</p>
        ) : (
          <ul className="divide-y divide-[var(--jp-border)]">
            {entries.map((entry) => (
              // Keyed on the setting as well as the id, so flipping "start open" reaches
              // rows that are already on screen instead of only the next run's.
              <EntryRow key={`${entry.id}:${openByDefault}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </Options>
  );
});
