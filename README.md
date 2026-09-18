# JSPlayground

A JavaScript scratchpad in two panes: the source in one, whatever it printed in the other.
It runs your code as you type, in a Web Worker that can be killed — so `while (true) {}` is
something you try rather than something you recover from.

**[Open it →](https://jsplayground.rizki.id)** · no account, no build step, nothing to install.

![The editor on the left, the output on the right: arrays, a Map, a Set, a regexp, a BigInt, a sparse array, an expandable object tree, a circular reference, a console timer, a warning, a syntax error with its line number, and a late line from a setTimeout.](docs/screenshot-dark.webp)

## Why another one

Plenty of scratchpads send your code to a server, and plenty run it on the same thread as
the page. The first needs a network and a round trip; the second means one bad loop takes
the tab with it. This one runs everything locally, in a worker, which is what lets it do
two things at once: re-run on every keystroke, **and** survive code that never returns.

## What it does

**Runs your code, safely**

- **A fresh worker per run.** Globals cannot leak from one run into the next, and the
  previous run — which may still be holding a core — is terminated before the next starts.
- **An unbounded loop is survivable.** A watchdog terminates the thread, because
  `terminate()` is the only thing that actually stops `while (true) {}`. The limit is yours
  to set, between 100 ms and 5 s.
- **Top-level `await` just works.** Code is run through `AsyncFunction`, and output that
  arrives after the top-level code finished is tagged `late` rather than silently dropped.
- **Runs as you type**, debounced — or freeze it and run with `⌘↵` when you are ready.
  An amber dot tells you the code has moved on since the result you are looking at.

**Shows you what you actually got**

- **Values print as themselves.** `Map`, `Set`, typed arrays, `BigInt`, symbols, regexps,
  dates, sparse arrays, `-0` — not `[object Object]`.
- **Objects open.** Anything with members to show gets a one-line summary and a disclosure
  triangle, with the members below and the closing brace under the key that opened it — the
  shape of the source you would have written.
- **Circular references, getters and revoked proxies are handled**, not crashed on: a cycle
  says `[Circular]`, and a getter is named rather than invoked.
- **A huge value cannot take the tab with it.** Depth, width and a total budget per line
  keep `console.log` of a million-element array from becoming a 47 MB message and a
  multi-second freeze. Whatever is left out says `… N more`, the same way a merely wide
  value does.
- **Errors carry their line number**, mapped back to the editor's own numbering — including
  syntax errors, thrown non-`Error`s and unhandled rejections.
- **`console` is most of the real one**: `log` `info` `warn` `error` `debug` `assert`
  `count` `time`/`timeEnd`, each in its own colour where it has one. `table`, `dir`,
  `trace` and `group` are accepted, and print their arguments as a line. `alert`, `prompt` and
  `confirm` answer in the console rather than throwing, because a worker has none of them
  and a bare `ReferenceError` teaches nothing.

**Gets out of your way**

- **A layout that moves.** Panes in rows or columns, either one first, and a divider that
  drags with a mouse, a finger or a pen. Double-click resets it.
- **Twelve code themes and six app themes**, paired so that going dark and back again
  returns the theme you started on. Each pane's text size steps independently.
- **Format with Prettier**, fetched on the click rather than on load, so it costs nothing
  until you want it.
- **Completion scoped to the sandbox** — it offers what the worker actually has, not
  `document` and `localStorage`, which are not there.
- **Everything is remembered** — theme, layout, split, run mode, text sizes, timeout — in
  `localStorage`, read before the first frame so there is no flash of the wrong theme.
  Blocked storage costs you a preference, not the app.

| | |
|---|---|
| ![The same app in the Paper theme with the Sepia palette: a cream window, warm syntax colours.](docs/screenshot-light.webp) | ![The settings dialog, Theme tab: six app themes as tiles wearing their own colours, and six code themes below.](docs/screenshot-themes.webp) |
| Light themes are first-class, not an afterthought | Twelve code palettes, paired to the app theme |

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

`npm run build` type-checks and builds; `npm run lint` runs ESLint. React 19, TypeScript,
Vite, CodeMirror 6 and Tailwind 4 — no state library, no test framework, no backend.

## How it is put together

The whole app is one self-contained folder,
[`src/components/jsplayground`](src/components/jsplayground) — `src/App.tsx` renders it and
does nothing else. Drop the folder into another React app and it works; its only imports
from outside itself are React, CodeMirror, `lucide-react` and Prettier, the last behind a
dynamic import.

[**Its README**](src/components/jsplayground/README.md) is the design document: how the
sandbox is built and stringified into a blob worker, why the output is a tree rather than
wrapped text, how the two palettes stay in step, and what the boundaries actually are — the
worker guards against mistakes rather than against malice, and the README says so plainly.

## A note on the sandbox

A blob worker shares the page's origin. It has no DOM and it can be terminated mid-loop,
which is everything a playground needs, but it is not a security boundary: `fetch` from
inside it is a same-origin request. That costs nothing on a static site with no session and
nothing to ask for — it would be the first thing to think about if you dropped this into an
app that has either.

---

Happy coding.
