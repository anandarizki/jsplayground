# JS Playground

The whole app. `src/App.tsx` renders it and nothing else.

## The layout is not fixed

Neither half of it is. The two panes sit in **rows** or in **columns**, **either one can
be first**, and the divider between them drags (double-click resets it to half). Swapping
carries each pane's size with it, so the one you made tall stays tall.

Every control is in the left rail, which is why the panes carry no chrome of their own:

- **Play** — a toggle, not a trigger. Lit means live: the code re-runs as you type,
  debounced. Unlit means the result is frozen, and an amber dot on the button says the
  code has moved on since the result you are looking at. `⌘↵` runs once either way.
- **Eraser** — clear the output.
- **Layout / Swap** — rows or columns, and which pane leads.
- **Sun / Moon** — light or dark. The editor and the console share one palette, so a
  string is the same green whether you are writing it or reading what it printed.

## How it runs your code

- `worker-main.ts` — the sandbox, stringified into a blob Worker. No DOM, so the worst
  a snippet can do is burn a core until the watchdog terminates it. Runs the code
  through `AsyncFunction`, so top-level `await` works.
- `use-runner.ts` — one worker per run (globals cannot leak between runs, and the
  previous run is killed before the next starts), a 2 s watchdog, and a window for
  late `setTimeout` output with a 15 s ceiling.
- `console-view.tsx` — the formatter's output. The worker serialises to abstract
  tones; the mapping to colour lives here, next to the editor's palette.
- `completion.ts` — property and global completion. `scopeCompletionSource` walks a
  real object, and the easy move is to hand it `globalThis` — which would offer
  `document`, `window` and `localStorage`, none of which exist in a worker. It gets a
  scope describing what the sandbox actually has instead, including the worker's own
  `console` rather than the browser's.

Edge cases it already survives: unbounded loops, syntax errors, thrown non-Errors,
unhandled rejections, circular structures, getters (named, never invoked), sparse
arrays, `Map`/`Set`/typed arrays, huge strings and runaway output (both capped),
`alert`/`prompt`/`confirm` (answered in the console rather than throwing), and
stale results from a run that has been superseded.

Error line numbers are mapped back to the editor's own numbering by measuring the
`AsyncFunction` wrapper's offset at startup rather than assuming it.

## Boundaries

This folder is self-contained. `index.tsx` is its only public file; everything else
is private and free to change. It imports nothing from outside itself apart from React,
CodeMirror and `lucide-react`, which is what makes it droppable into another app as is.
