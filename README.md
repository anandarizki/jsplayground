# JSPlayground

A two-pane JavaScript scratchpad: the source in one pane, whatever it printed in the other.

## Key Features

- **Runs in a worker** — the code never touches the page, so an unbounded loop is
  survivable: a watchdog terminates the thread after two seconds, and every run gets a
  fresh worker so nothing leaks from one into the next.
- **Formatted output** — Maps, Sets, circular references, sparse arrays and getters each
  print as themselves rather than as `[object Object]`, and error line numbers are mapped
  back to the editor's own numbering.
- **CodeMirror editor** — with completion scoped to what the sandbox actually exposes
  instead of the page's globals.
- **A layout that moves** — panes stack or sit side by side in either order, the divider
  drags, and the choice is remembered along with the theme and the run mode.

Run it with `npm install && npm run dev`. The app itself lives in
[`src/components/jsplayground`](src/components/jsplayground) — see its README for how the
sandbox works.

## Demo

Try out JSPlayground at: [jsplayground.rizki.id](https://jsplayground.rizki.id)

Happy coding!
