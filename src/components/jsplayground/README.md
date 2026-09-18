# JS Playground

The whole app. `src/App.tsx` renders it and nothing else.

## The layout is not fixed

Neither half of it is. The two panes sit in **rows** or in **columns**, **either one can
be first**, and the divider between them drags (double-click resets it to half). Swapping
carries each pane's size with it, so the one you made tall stays tall. It opens as two
columns — source left, output right — in dark, and `use-settings.ts` remembers whatever
you change it to.

The divider takes a pointer rather than a mouse, which is what makes it draggable by
touch and pen as well, and the listeners go on the handle for the length of the gesture
rather than on the window for the length of the session — pointer capture is what keeps a
one-pixel target receiving moves the cursor has already left behind. Moves are coalesced
to one update a frame, and the write to storage waits for the gesture to settle: a
two-second drag used to be a hundred and twenty `JSON.stringify` calls and a hundred and
twenty synchronous writes, and is now one. That write is flushed if the tab is hidden or
closed first, since neither event will wait for anything asynchronous.

The left rail holds the two controls that act on the session as a whole:

- **Play** — a toggle, not a trigger, and the glyph is what says which way it is set. A
  square means live: the code re-runs as you type, debounced, and pressing it stops that.
  A triangle means the result is frozen, and an amber dot on it says the code has moved on
  since the result you are looking at. `⌘↵` runs once either way. A run in flight takes
  the slot over — the same square in the error colour, which kills the worker rather than
  changing when the next run happens.
- **Bookmark** — the shelf: what you saved, then the examples that shipped. The examples
  used to sit as bare labels above the source, where they read as part of the
  document rather than as a way out of it; a list also has room for each snippet's
  opening line, which is the only thing that says what you are about to load over your
  own code.

Everything else belongs to one pane, and each pane carries a single line along its
bottom: what it has to say on the left, what you can do to it on the right. Nothing sits
above a pane and nothing spans both, so the app has no bar of its own and the panes meet
the top edge.

Each line also carries its pane's text size, as two steps between 10 and 24 px with the
current size between them, bounded so a click that can do nothing is disabled rather than
silently ignored. That number is the way back: pressing it returns the pane to 13 px, and
at 13 px it has nothing to undo, so it stops being a button and reads as the label it
already was. The two sizes
are separate settings: reading a wide printed structure and writing the line that made it
are not the same job, and a screen you have leaned back from may want only one of them
bigger. The output is sized in `em` throughout, so everything in it scales together. The
editor's size goes through its CodeMirror theme rather than through the element around
it: CodeMirror measures a line once and gives every gutter element that height, so text
scaled underneath it by an inherited `font-size` leaves the numbers behind — a pixel a
line, which is a whole line by the bottom of a long document. A theme carrying the size
makes it a reconfiguration, and a reconfiguration is measured again. The theme cache is
keyed by palette and size together, so the extension array is still stable across every
render that changed neither.

The editor's `basicSetup` is a module-level constant rather than the object literal it
reads as, because `@uiw/react-codemirror` keys its reconfigure effect on that object's
identity: written inline it was a new object every render, and so a full reconfiguration
of the editor on every keystroke, every mousemove of a drag and every change of run
status. The editor is also memoised, since the page re-renders on each console message
and none of them are about the editor.

The source line says when the code will run — `runs as you type`, or `⌘↵ to run` when
the play button is unlit — and holds **format** and **save**. Format is Prettier,
imported on the click rather than at the top of the file, because the parser and printer
together are the largest thing here and most sessions never press it; that first fetch
is seconds on a slow connection, so the line says `formatting…` while it is happening and
the button will not start a second one. Whatever is typed in the meantime wins — a result
computed from the document as it was before is not allowed to overwrite the document as
it is. Code that does not parse cannot be formatted, so that same line says
`cannot format` for a moment and the output pane gives the real error on the next run. Save names what is in the editor and
puts it at the top of the shelf.

The output line is the status — `ready`, `running…`, how long the last run took, or why
it stopped — and holds the **eraser**. Both of those were a strip across the foot of the
whole window, which put a run's duration as far from the output it measured as the
layout allowed.

Saved snippets live in `use-bookmarks.ts`, under their own versioned storage key and
read in the state initialiser for the same reason the settings are. Nothing that comes
back is trusted — an entry without both a title and a body is dropped rather than
repaired into a blank row. The examples are not
stored at all, so no amount of deleting can lose them.

At the foot of the rail, away from anything that touches the code: **settings**, the
source on **GitHub**, and **about**. Every dialog renders inside the app's root rather
than in a portal, so the element carrying the theme's custom properties is still above them.

`update` in `use-settings.ts` takes a function of the current settings as well as a
plain patch, which is what makes a step correct when two clicks land inside one render:
an object patch carries the size the button was drawn with, so the second click would
only repeat the first.

Settings is where the rest lives, in four tabs — Theme, Layout, Console, Running — because
a theme is chosen once and a timeout is changed while something is misbehaving, and one
long column makes you re-read all of it to find either. A rail is a good place for a verb
and a poor one for a preference: a bare icon can show a toggle's state only as a glyph,
and has nowhere to say what the alternative is.

## Two palettes

`themes.ts` holds both, and they are deliberately separate.

An **app theme** — Sunny, Calm, Paper, Night, Dusk, Forest — paints every surface: the
rail, the pane status lines, the dialogs and both panes alike. A **code theme** — twelve
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
`index.css`, which repeats `night`'s by hand: something has to be painted before any
script has run, and a stylesheet cannot read a preference. What it can be told is a
colour, so `use-settings.ts` writes the chosen background under a key of its own and a
line in `index.html` paints it — which is why choosing Sunny no longer costs a frame of
Night on every reload.

Both hooks read storage in their state initialiser rather than in an effect. Storage is
synchronous and nothing here is server-rendered, so reading it there costs exactly what
reading it after mount cost, and saves a render against values that immediately replace
themselves — along with the wrong theme for a frame, and a first run that had to be told
it was wanted before it could start. The guards that used to hold the persist effect off
until the load effect had run did not, in fact, guard: both landed in the same commit, so
the defaults were written over what was stored and what was stored written back a tick
later. There is no gap to guard now, and a session that changes nothing writes nothing.

## How it runs your code

- `worker-main.ts` — the sandbox, stringified into a blob Worker. No DOM, so the worst
  a snippet can do is burn a core until the watchdog terminates it. Runs the code
  through `AsyncFunction`, so top-level `await` works.
- `use-runner.ts` — one worker per run (globals cannot leak between runs, and the
  previous run is killed before the next starts), the watchdog, and a window for
  late `setTimeout` output with a 15 s ceiling. The worker says once when its top-level
  code hands control back, which is the only way the watchdog can tell an unbounded loop
  from a slow await: by the time it fires there is nobody left in that thread to ask, and
  the two deserve different sentences — one cannot be stopped from inside, and the other
  did nothing wrong but take longer than the setting allows. The watchdog's limit is a setting,
  between 100 ms and 5 s. The ceiling is not: it is what stops a `setInterval` holding
  a thread open until the tab closes, which is not a preference.
- `validate.ts` — the sandbox is not the only thing that can talk on the channel back
  to the page: the code it is running holds the same `postMessage`, and
  `postMessage({ t: "log", parts: null })` is one line. So nothing arriving is trusted.
  Every message is re-checked in the shape the view expects and dropped whole if it is
  not one — repairing half an entry is how a validator turns into a second parser — and
  the pane says so once per run rather than once per message.
- `error-boundary.tsx` — the guard behind that, for whatever the checking misses. A
  render that throws unmounts the React root, and here the root is the app, so one bad
  row would otherwise cost the editor and everything typed into it. Contained, it costs
  one pane, and the eraser gives it back: the boundary is keyed on a counter the runner
  bumps whenever the output is replaced.
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
  terminated once the run settles and there is nobody left to ask for the next level.
  `MAX_DEPTH`, `MAX_ITEMS` and `MAX_NODES` bound any one level of that, and
  `MAX_TOKENS`/`MAX_CHARS` bound the call as a whole — without which the per-level caps
  simply multiply, and a hundred items four deep is a million leaves and a 47 MB message
  from one `console.log` of an ordinary-looking array. A run has a budget too, because
  four hundred entries at a full budget each is still more than the main thread should
  be asked to hold; past it lines still print, as the line they would have shown shut.
  Whatever a budget stops is reported as `… N more`, the same thing a level says when it
  was merely too wide — running out of room should read like being wide, not like being
  cut off. The caps are asked about before a line is serialised rather than after, so the
  four hundred and first entry costs nothing to not send. A level's members are a
  sibling of its summary rather than a continuation of it, which is what makes the indent
  a fixed step instead of the width of the key that introduced it. Open state lives in
  the row that owns it, so a new run starts everything shut. The pane follows new output
  only when it was already at the bottom: output that arrives while you are reading
  something further up should not take you away from it.
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

The worker is a boundary against mistakes, not against malice. It has no DOM and it can
be terminated mid-loop, which is what a playground needs; but a blob worker shares the
page's origin, so a `fetch` from inside it is a same-origin request carrying the page's
cookies, and the channel it reports on is one the code inside it can post to as well.
The second of those is why nothing coming back over that channel is believed without
being checked. The first costs nothing here — a static site with no session and nothing
to ask for — and would be the thing to think about first if this were ever dropped into
an app that has either.

This folder is self-contained. `index.tsx` is its only public file; everything else
is private and free to change. It imports nothing from outside itself apart from React,
CodeMirror, `lucide-react` and Prettier — the last of those only inside a dynamic import,
so an app that drops this folder in pays for it on a click and not on load.
