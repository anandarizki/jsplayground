/** Timings and starter code. All of it is tuned for judging, not for production. */

/** How long the top-level code may run before the worker is killed. An unbounded
 *  loop never yields, so this watchdog is the only thing that can stop one. */
export const RUN_TIMEOUT_MS = 2000;

/** After the code settles, how long to keep listening for `setTimeout` output
 *  before tearing the worker down. Reset by each late message. */
export const ASYNC_IDLE_MS = 2500;

/** An absolute lid on the above, so a `setInterval` cannot keep a worker alive. */
export const ASYNC_CEILING_MS = 15000;

/** Quiet time after the last keystroke before an automatic run. */
export const DEBOUNCE_MS = 700;

export const DEFAULT_CODE = `// Runs in a worker. Nothing here can reach the page.
const tasks = [
  { id: 1, title: "sand the frame", done: true },
  { id: 2, title: "prime the joints", done: false },
  { id: 3, title: "first coat", done: false },
];

console.log(tasks.filter((t) => !t.done).map((t) => t.title));
console.log(new Map(tasks.map((t) => [t.id, t.done])));
console.log(new Set(["oak", "ash", "oak"]), /coat$/i, 42n);

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
console.time("drying");
await wait(120);
console.timeEnd("drying");

console.log({ layers: { primer: 1, coats: { first: true } } });
`;

/** Snippets that each poke at one thing the runner has to survive. */
export const EXAMPLES: { label: string; code: string }[] = [
  {
    label: "Values",
    code: `console.log(1 / 3, 10n ** 20n, NaN, -0);
console.log(new Set(["a", "b"]), /^ab+c$/gi, new Date(0));
console.log([1, , 3], { nested: { deep: { deeper: { deepest: 1 } } } });

const loop = { name: "loop" };
loop.self = loop;
console.log(loop);
`,
  },
  {
    label: "Async",
    code: `console.log("1 — synchronous");

setTimeout(() => console.log("4 — macrotask, 200ms later"), 200);
Promise.resolve().then(() => console.log("3 — microtask"));

console.log("2 — still synchronous");
`,
  },
  {
    label: "Throws",
    code: `function parse(input) {
  return JSON.parse(input);
}

console.log("about to throw");
parse("{ not json }");
console.log("never reached");
`,
  },
  {
    label: "Infinite loop",
    code: `// The watchdog kills this. Nothing else can.
let n = 0;
while (true) n += 1;
`,
  },
];
