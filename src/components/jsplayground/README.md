# JS Playground

The whole app. `src/App.tsx` renders it and nothing else.

## The layout is not fixed

Neither half of it is. The two panes sit in **rows** or in **columns**, **either one can
be first**, and the divider between them drags (double-click resets it to half). Swapping
carries each pane's size with it, so the one you made tall stays tall. It opens as two
columns — source left, output right — in dark, and `use-settings.ts` remembers whatever
you change it to.

The left rail holds the two controls you reach for while writing, which is why the panes
carry no chrome of their own:

- **Play** — a toggle, not a trigger. Lit means live: the code re-runs as you type,
  debounced. Unlit means the result is frozen, and an amber dot on the button says the
  code has moved on since the result you are looking at. `⌘↵` runs once either way.
- **Eraser** — clear the output.

At the foot of the rail, away from anything that touches the code: **settings**, the
source on **GitHub**, and **about**. Both dialogs render inside the app's root rather
than in a portal, so the `group` carrying `dark` is still above them.

Settings is where the rest lives, in four tabs — Theme, Layout, Console, Running — because
a theme is chosen once and a timeout is changed while something is misbehaving, and one
long column makes you re-read all of it to find either. A rail is a good place for a verb
and a poor one for a preference: a bare icon can show a toggle's state only as a glyph,
and has nowhere to say what the alternative is.

## Two palettes

`themes.ts` holds both, and they are deliberately separate.

An **app theme** — Sunny, Calm, Paper, Night, Dusk, Forest — paints every surface: the
rail, the headers, the footer, the dialogs and both panes alike. A **code theme** — twelve
of them, six a side — paints only what is written on them, and the editor's
syntax and the console's output both come from it. That is what keeps a string the same
green whether you are writing it or reading what it printed, and it is why the console's
tones are named abstractly in the worker: the mapping to a colour cannot be made until
the palette is known.

A code theme has no background of its own. Both panes are transparent, so the window is
one surface rather than a cream frame around a white rectangle. That is also what makes
the brightness filter load-bearing rather than tidy — a code theme has nothing to sit on
but the chrome, so only themes of the app theme's own brightness are offered. Switching
the app between light and dark carries the code theme to the same slot in the other list
rather than to a fixed default, so going dark and back again returns the theme you
started on — and the two lists are written so that slot means something: Plain against
Ink, Meadow against Moss, Mono against Contrast. `use-settings.ts` holds that invariant, not the dialog, so no caller can
leave the two out of step.

Every colour in the app reads a `--jp-*` custom property set on the root element, which
is the only reason a theme can be a value picked at runtime rather than a second set of
classes written beside the first. The one duplicate is the `body` background in
`index.css`: the theme is not known until storage has been read, and something has to be
painted before that, so it repeats `night`'s background by hand.

## How it runs your code

- `worker-main.ts` — the sandbox, stringified into a blob Worker. No DOM, so the worst
  a snippet can do is burn a core until the watchdog terminates it. Runs the code
  through `AsyncFunction`, so top-level `await` works.
- `use-runner.ts` — one worker per run (globals cannot leak between runs, and the
  previous run is killed before the next starts), the watchdog, and a window for
  late `setTimeout` output with a 15 s ceiling. The watchdog's limit is a setting,
  between 100 ms and 5 s. The ceiling is not: it is what stops a `setInterval` holding
  a thread open until the tab closes, which is not a preference.
- `console-view.tsx` — the formatter's output. The worker serialises to abstract
  tones; the mapping to colour lives here, next to the editor's palette.
- Values open rather than wrap. Anything with members to show prints as a one-line
  summary with a disclosure triangle, whatever its width — a value's controls should not
  depend on how wide it happens to print, and the summary is what you read either way.
  The exception is `{}` and `[]`, which stay as they are: a triangle that opens onto
  nothing is a broken promise.
- Open, a container drops the summary and shows only its brace, with the members on the
  lines below and the closing brace under the key that opened it — the shape of the
  source you would have written. Devtools keeps the summary on the header line, which
  means every value you open is then on screen twice, once abbreviated and once not. The tree is serialised up front, because the worker is
  terminated once the run settles and there is nobody left to ask for the next level;
  `MAX_DEPTH`, `MAX_ITEMS` and `MAX_NODES` are what bound that. A level's members are a
  sibling of its summary rather than a continuation of it, which is what makes the indent
  a fixed step instead of the width of the key that introduced it. Open state lives in
  the row that owns it, so a new run starts everything shut.
- `completion.ts` — property and global completion. `scopeCompletionSource` walks a
  real object, and the easy move is to hand it `globalThis` — which would offer
  `document`, `window` and `localStorage`, none of which exist in a worker. It gets a
  scope describing what the sandbox actually has instead, including the worker's own
  `console` rather than the browser's.

Edge cases it already survives: unbounded loops, syntax errors, thrown non-Errors,
unhandled rejections, circular structures, getters (named, never invoked), sparse
arrays, `Map`/`Set`/typed arrays, huge strings and runaway output (both capped),
`alert`/`prompt`/`confirm` (answered in the console rather than throwing), and
stale results from a run that has been superseded, and objects wide enough or deep
enough that printing them whole would fill the pane.

Error line numbers are mapped back to the editor's own numbering by measuring the
`AsyncFunction` wrapper's offset at startup rather than assuming it.

## Boundaries

This folder is self-contained. `index.tsx` is its only public file; everything else
is private and free to change. It imports nothing from outside itself apart from React,
CodeMirror and `lucide-react`, which is what makes it droppable into another app as is.
