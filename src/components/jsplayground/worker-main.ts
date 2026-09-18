/**
 * The sandbox, as a function that is stringified into a blob Worker.
 *
 * It runs in its own thread with no DOM, so the worst a snippet can do is burn one
 * core until the watchdog on the main thread calls `terminate()` — which is the only
 * thing that actually stops `while (true) {}`. It is not a security boundary: a blob
 * worker shares the page's origin, so `fetch` from in here is a same-origin request with
 * the page's cookies. That costs nothing on a static site with nothing to ask for, and it
 * is the reason this is a sandbox for mistakes rather than for hostile code.
 *
 * Nothing here may reference a module
 * binding: `Function.prototype.toString` gives us this function's source and nothing
 * else, so a captured import would be undefined inside the worker.
 *
 * Deliberately written without `async`/`await` and without generators. Those are the
 * two forms a downlevelling compiler rewrites into calls to injected helpers, and an
 * injected helper is exactly the module binding that cannot survive the trip.
 */
export function workerMain() {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const MAX_ENTRIES = 400; // console lines per run
  const MAX_STRING = 4000; // characters of any one string
  const MAX_DEPTH = 4; // nesting levels before "{…}"
  const MAX_ITEMS = 100; // array/object/map members
  const PREVIEW_WIDTH = 96; // characters of a shut container's summary line
  const MAX_NODES = 4000; // members serialised per console call
  // The two that bound a whole console call rather than any one level of it. Without
  // them the per-level caps multiply: 100 items, four levels deep, is a million leaves
  // and a 47 MB message — from one `console.log` of an ordinary-looking array.
  const MAX_TOKENS = 3000; // token runs per console call
  const MAX_CHARS = 100000; // characters of text per console call
  const PREVIEW_TOKENS = 300; // token runs assembled for a line that will be cut anyway
  // And the same again for a whole run, because `MAX_ENTRIES` lines at a full budget
  // each is still a hundred megabytes for the main thread to hold in state.
  const MAX_RUN_TOKENS = 100000;
  const MAX_RUN_CHARS = 2000000;

  const scope: any = self;
  let sent = 0;
  let nodes = 0;
  let capped = false;
  let lineOffset = 0;
  let tokensOut = 0;
  let charsOut = 0;
  let tokenCap = MAX_TOKENS;
  let charCap = MAX_CHARS;
  let runTokens = 0;
  let runChars = 0;

  // Opaque to the bundler on purpose: writing `async function () {}` out here would
  // hand a downlevelling compiler something to rewrite.
  const AsyncFunction = new Function("return Object.getPrototypeOf(async function () {}).constructor")();

  function now(): number {
    return scope.performance && scope.performance.now ? scope.performance.now() : Date.now();
  }

  function emit(msg: any) {
    scope.postMessage(msg);
  }

  /**
   * Whether another console line will be sent at all.
   *
   * Asked before its arguments are serialised rather than after. The cap used to live
   * inside `emit`, by which point the entry nobody would see had already been walked in
   * full — a thousand lines of output cost a thousand lines of work to send four hundred.
   */
  function canEmitLog() {
    if (capped) return false;
    if (sent >= MAX_ENTRIES) {
      capped = true;
      scope.postMessage({ t: "notice", text: "Output stopped after " + MAX_ENTRIES + " entries." });
      return false;
    }
    sent += 1;
    return true;
  }

  // ------------------------------------------------------------------- budget

  /**
   * Whether the current console call has spent what it is allowed.
   *
   * Every loop that could keep going asks this and stops. What it skips is reported as
   * `… N more` by the container it was filling, which is the same thing that container
   * already says about `MAX_ITEMS` — so a value that ran out of budget reads like a value
   * that was merely wide, rather than like a value that was cut off.
   *
   * The caps are variables rather than the constants themselves so `summary` can lower
   * them for a line it is going to cut anyway.
   */
  function spent() {
    return tokensOut >= tokenCap || charsOut >= charCap;
  }

  /**
   * Per console call: each message starts again with the whole budget.
   *
   * Up to a point. A run that has already spent `MAX_RUN_TOKENS` keeps printing, but
   * every line from then on gets only what a summary costs — nobody opens the three
   * hundredth copy of a wide array, and the main thread has to hold all four hundred of
   * them whether or not anybody does.
   */
  function resetBudget() {
    runTokens += tokensOut;
    runChars += charsOut;
    nodes = 0;
    tokensOut = 0;
    charsOut = 0;
    const roomy = runTokens < MAX_RUN_TOKENS && runChars < MAX_RUN_CHARS;
    tokenCap = roomy ? MAX_TOKENS : PREVIEW_TOKENS;
    charCap = roomy ? MAX_CHARS : PREVIEW_WIDTH * 4;
  }

  // ---------------------------------------------------------------- formatting

  /** The one place a token is made, so it is also the one place the budget is spent.
   *  There is no guard here: the callers stop, and letting the value in hand finish
   *  overshoots by one nesting level rather than leaving a half-written brace. */
  function push(out: any[], t: string, v: string) {
    tokensOut += 1;
    charsOut += v.length;
    out.push({ t: t, v: v });
  }

  function quote(s: string) {
    const clipped = s.length > MAX_STRING ? s.slice(0, MAX_STRING) : s;
    let body = clipped
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    if (s.length > MAX_STRING) body += "… +" + (s.length - MAX_STRING) + " chars";
    return "'" + body + "'";
  }

  function isIdent(key: string) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
  }

  /** Cut a token run down to `width`, marking the cut. Previews are one line whatever
   *  the value is, so this is what keeps a 4000-character string out of the summary. */
  function truncate(tokens: any[], width: number) {
    const out = [];
    let n = 0;
    for (let i = 0; i < tokens.length; i++) {
      const v = tokens[i].v;
      if (n + v.length <= width) {
        out.push(tokens[i]);
        n += v.length;
        continue;
      }
      if (width > n) out.push({ t: tokens[i].t, v: v.slice(0, width - n) });
      out.push({ t: "dim", v: "…" });
      return out;
    }
    return out;
  }

  /**
   * A value on one line, cut to `PREVIEW_WIDTH` — the summary a shut container shows,
   * and what a container the tree refused to open prints as instead.
   *
   * Built under a budget of its own, because assembling a hundred 4000-character strings
   * to then keep 96 characters of them is most of the work for none of the result. What
   * survives the cut is what the call is charged for; the rest never existed as far as
   * the budget is concerned.
   */
  function summary(prefix: string, value: any, depth: number, seen: any[]) {
    const tokens0 = tokensOut;
    const chars0 = charsOut;
    const tokenCap0 = tokenCap;
    const charCap0 = charCap;
    tokenCap = Math.min(tokenCap0, tokens0 + PREVIEW_TOKENS);
    charCap = Math.min(charCap0, chars0 + PREVIEW_WIDTH);
    const out: any[] = [];
    try {
      if (prefix) push(out, "dim", prefix);
      tokenize(value, out, depth, seen);
    } finally {
      tokenCap = tokenCap0;
      charCap = charCap0;
    }
    const cut = truncate(out, PREVIEW_WIDTH);
    tokensOut = tokens0 + cut.length;
    charsOut = chars0;
    for (let i = 0; i < cut.length; i++) charsOut += cut[i].v.length;
    return cut;
  }

  /**
   * Lay a container's members out on one line. Everything that reads as a list —
   * arrays, objects, Maps, Sets, typed arrays — comes through here, so the rule is the
   * same wherever it applies.
   *
   * There is no multi-line form: a container too wide for one line is not wrapped, it
   * is handed to the view as something that opens. `pad` is the space just inside the
   * braces that `{ a: 1 }` has and `[1]` does not.
   */
  function assemble(out: any[], prefix: string, open: string, close: string, items: any[], pad: boolean, hidden: number) {
    if (prefix) push(out, "dim", prefix);
    if (items.length === 0 && hidden === 0) {
      push(out, "punct", open + close);
      return;
    }
    push(out, "punct", pad ? open + " " : open);
    for (let i = 0; i < items.length; i++) {
      if (i) push(out, "punct", ", ");
      for (let j = 0; j < items[i].length; j++) out.push(items[i][j]);
    }
    if (hidden > 0) {
      if (items.length) push(out, "punct", ", ");
      push(out, "dim", "… " + hidden + " more");
    }
    push(out, "punct", pad ? " " + close : close);
  }

  function tokenize(value: any, out: any[], depth: number, seen: any[]) {
    if (spent()) return push(out, "dim", "…");
    const type = typeof value;
    if (value === null) return push(out, "nullish", "null");
    if (type === "undefined") return push(out, "nullish", "undefined");
    if (type === "boolean") return push(out, "boolean", String(value));
    if (type === "number") return push(out, "number", Object.is(value, -0) ? "-0" : String(value));
    if (type === "bigint") return push(out, "number", String(value) + "n");
    if (type === "symbol") return push(out, "regexp", String(value));
    if (type === "string") return push(out, "string", quote(value));
    if (type === "function") {
      let src = "";
      try {
        src = Function.prototype.toString.call(value);
      } catch {
        /* proxies and bound natives can refuse */
      }
      const head = /^\s*class[\s{]/.test(src) ? "class " : "ƒ ";
      return push(out, "fn", head + (value.name || "(anonymous)"));
    }

    if (seen.indexOf(value) !== -1) return push(out, "dim", "[Circular]");

    const kind = Object.prototype.toString.call(value).slice(8, -1);
    if (kind === "Date") {
      return push(out, "regexp", isNaN(value.getTime()) ? "Invalid Date" : value.toISOString());
    }
    if (kind === "RegExp") return push(out, "regexp", String(value));
    if (kind === "Promise") return push(out, "dim", "Promise { … }");
    if (kind === "Error" || value instanceof Error) {
      return push(out, "error", (value.name || "Error") + ": " + value.message);
    }
    if (kind === "WeakMap" || kind === "WeakSet") return push(out, "dim", kind + " { … }");

    if (depth >= MAX_DEPTH) return push(out, "dim", Array.isArray(value) ? "[…]" : "{…}");

    seen.push(value);
    try {
      if (Array.isArray(value)) return listTokens(value, value.length, out, depth, seen, "");
      if (ArrayBuffer.isView(value) && kind !== "DataView") {
        const len = (value as any).length;
        return listTokens(value, len, out, depth, seen, kind + "(" + len + ") ");
      }
      if (kind === "Map") return pairTokens(value, out, depth, seen);
      if (kind === "Set") return setTokens(value, out, depth, seen);
      return objectTokens(value, out, depth, seen, kind);
    } finally {
      seen.pop();
    }
  }

  function listTokens(value: any, length: number, out: any[], depth: number, seen: any[], label: string) {
    const items: any[] = [];
    const shown = Math.min(length, MAX_ITEMS);
    for (let i = 0; i < shown; i++) {
      if (spent()) break;
      const item: any[] = [];
      if (i in value) tokenize(value[i], item, depth + 1, seen);
      else push(item, "dim", "<empty>");
      items.push(item);
    }
    assemble(out, label, "[", "]", items, false, length - items.length);
  }

  function pairTokens(value: any, out: any[], depth: number, seen: any[]) {
    const items: any[] = [];
    let i = 0;
    value.forEach(function (v: any, k: any) {
      if (i < MAX_ITEMS && !spent()) {
        const item: any[] = [];
        tokenize(k, item, depth + 1, seen);
        push(item, "punct", " => ");
        tokenize(v, item, depth + 1, seen);
        items.push(item);
      }
      i += 1;
    });
    assemble(out, "Map(" + value.size + ") ", "{", "}", items, true, value.size - items.length);
  }

  function setTokens(value: any, out: any[], depth: number, seen: any[]) {
    const items: any[] = [];
    let i = 0;
    value.forEach(function (v: any) {
      if (i < MAX_ITEMS && !spent()) {
        const item: any[] = [];
        tokenize(v, item, depth + 1, seen);
        items.push(item);
      }
      i += 1;
    });
    assemble(out, "Set(" + value.size + ") ", "{", "}", items, true, value.size - items.length);
  }

  /** The dim word in front of a container: `Map(3) `, `Uint8Array(4) `, `Box `. Plain
   *  objects have none, and plain arrays only get their `(n)` at the top of a node,
   *  where the summary is truncated long before its end. */
  function labelOf(value: any, kind: string, size: number) {
    if (Array.isArray(value)) return size < 0 ? "" : "(" + size + ") ";
    if (ArrayBuffer.isView(value) && kind !== "DataView") return kind + "(" + (value as any).length + ") ";
    if (kind === "Map" || kind === "Set") return kind + "(" + value.size + ") ";
    try {
      if (Object.getPrototypeOf(value) === null) return "[null prototype] ";
      if (value.constructor && value.constructor.name && value.constructor.name !== "Object") {
        return value.constructor.name + " ";
      }
      if (kind !== "Object") return kind + " ";
    } catch {
      /* exotic prototypes */
    }
    return "";
  }

  function objectTokens(value: any, out: any[], depth: number, seen: any[], kind: string) {
    const prefix = labelOf(value, kind, -1);

    let keys: string[] = [];
    try {
      keys = Object.keys(value);
    } catch {
      /* revoked proxy */
    }
    const items: any[] = [];
    const shown = Math.min(keys.length, MAX_ITEMS);
    for (let i = 0; i < shown; i++) {
      if (spent()) break;
      const item: any[] = [];
      push(item, "key", isIdent(keys[i]) ? keys[i] : quote(keys[i]));
      push(item, "punct", ": ");
      // Reading through a getter would run user code inside the formatter, which can
      // throw, recurse, or take a second. Name it and move on.
      let d;
      try {
        d = Object.getOwnPropertyDescriptor(value, keys[i]);
      } catch {
        d = null;
      }
      if (d && (d.get || d.set)) push(item, "dim", d.get ? "[Getter]" : "[Setter]");
      else tokenize(d ? d.value : undefined, item, depth + 1, seen);
      items.push(item);
    }
    assemble(out, prefix, "{", "}", items, true, keys.length - items.length);
  }

  // ------------------------------------------------------------------ nodes

  /** Whether a value has members worth opening. Dates, regexps, errors, promises and
   *  the weak collections all print as one thing and hide nothing behind it. */
  function opens(value: any, kind: string) {
    if (value === null || typeof value !== "object") return false;
    if (kind === "Date" || kind === "RegExp" || kind === "Promise") return false;
    if (kind === "WeakMap" || kind === "WeakSet" || kind === "DataView") return false;
    if (kind === "Error" || value instanceof Error) return false;
    return true;
  }

  /** How many members a container has, without rendering any of them — the cheap test
   *  that keeps a 10,000-element array from being formatted just to be measured. */
  function count(value: any, kind: string) {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) return (value as any).length;
    if (kind === "Map" || kind === "Set") return value.size;
    try {
      return Object.keys(value).length;
    } catch {
      return 0;
    }
  }

  /** One member: the key tokens (already carrying their `: ` or ` => `) and the value. */
  function member(key: any[], value: any) {
    return { key: key, value: value };
  }

  function membersOf(value: any, kind: string, depth: number, seen: any[]) {
    const list: any[] = [];
    const indexKey = function (i: number) {
      return [{ t: "dim", v: i + ": " }];
    };

    if (Array.isArray(value) || (ArrayBuffer.isView(value) && kind !== "DataView")) {
      const list_ = value as any;
      const shown = Math.min(list_.length, MAX_ITEMS);
      for (let i = 0; i < shown; i++) {
        if (spent()) break;
        if (Array.isArray(list_) && !(i in list_)) {
          list.push(member(indexKey(i), { n: "v", tokens: [{ t: "dim", v: "<empty>" }] }));
        } else {
          list.push(member(indexKey(i), toNode(list_[i], depth + 1, seen)));
        }
      }
      return list;
    }

    if (kind === "Map") {
      let i = 0;
      value.forEach(function (v: any, k: any) {
        if (i < MAX_ITEMS && !spent()) {
          const key: any[] = [];
          tokenize(k, key, MAX_DEPTH - 1, []);
          push(key, "punct", " => ");
          list.push(member(key, toNode(v, depth + 1, seen)));
        }
        i += 1;
      });
      return list;
    }

    if (kind === "Set") {
      let i = 0;
      value.forEach(function (v: any) {
        if (i < MAX_ITEMS && !spent()) list.push(member(indexKey(i), toNode(v, depth + 1, seen)));
        i += 1;
      });
      return list;
    }

    let keys: string[] = [];
    try {
      keys = Object.keys(value);
    } catch {
      /* revoked proxy */
    }
    const shown = Math.min(keys.length, MAX_ITEMS);
    for (let i = 0; i < shown; i++) {
      if (spent()) break;
      const key: any[] = [];
      push(key, "key", isIdent(keys[i]) ? keys[i] : quote(keys[i]));
      push(key, "punct", ": ");
      // Reading through a getter would run user code inside the formatter, which can
      // throw, recurse, or take a second. Name it and move on.
      let d;
      try {
        d = Object.getOwnPropertyDescriptor(value, keys[i]);
      } catch {
        d = null;
      }
      if (d && (d.get || d.set)) {
        list.push(member(key, { n: "v", tokens: [{ t: "dim", v: d.get ? "[Getter]" : "[Setter]" }] }));
      } else {
        list.push(member(key, toNode(d ? d.value : undefined, depth + 1, seen)));
      }
    }
    return list;
  }

  /**
   * One console argument, as something the view can render.
   *
   * Two shapes come out of here. `v` is a run of tokens and prints as itself; `c` opens,
   * and carries a one-line summary plus its members. Anything with members to show gets
   * the second shape whatever its width, so a value's controls do not depend on how wide
   * it happens to print — the summary is what you read, and opening is always there.
   *
   * The one exception is a container with nothing in it: `{}` and `[]` print as
   * themselves, because a triangle that opens onto nothing is a broken promise.
   *
   * Members are serialised eagerly, because there is no asking the worker later: it is
   * terminated once the run settles. That is what MAX_DEPTH, MAX_ITEMS and MAX_NODES
   * are holding back — without them a deep structure would be walked in full to build a
   * tree nobody opens.
   */
  function toNode(value: any, depth: number, seen: any[]): any {
    const kind = Object.prototype.toString.call(value).slice(8, -1);
    const flat = function () {
      const tokens: any[] = [];
      tokenize(value, tokens, depth, seen);
      return { n: "v", tokens: tokens };
    };

    if (!opens(value, kind) || seen.indexOf(value) !== -1 || depth >= MAX_DEPTH) return flat();

    const size = count(value, kind);
    if (size === 0) return flat();

    const label = labelOf(value, kind, size);
    const square = Array.isArray(value) || (ArrayBuffer.isView(value) && kind !== "DataView");
    // Length first, because a shut array's summary is truncated long before its end and
    // "how many" is the thing you actually wanted. Map and Set already say their own.
    const prefix = Array.isArray(value) ? label : "";

    // Out of budget, so this one does not open. It still prints — as the line it would
    // have shown shut. Falling back to `tokenize` at the current depth, which is what
    // this used to do, is how the cap was got round: a level that refused to open then
    // wrote out every one of its members flat, which is the more expensive of the two.
    if (nodes >= MAX_NODES || spent()) {
      return { n: "v", tokens: summary(prefix, value, MAX_DEPTH - 1, seen) };
    }

    // One level only: members show as `{…}` in the summary, the way devtools does it.
    const preview = summary(prefix, value, MAX_DEPTH - 1, seen);

    // Open, a container shows its brace and nothing else: the members are on the lines
    // below, and repeating them in the summary above would be saying it twice.
    const head: any[] = [];
    if (label) push(head, "dim", label);
    push(head, "punct", square ? "[" : "{");

    nodes += Math.min(size, MAX_ITEMS);
    seen.push(value);
    let list;
    try {
      list = membersOf(value, kind, depth, seen);
    } finally {
      seen.pop();
    }

    return {
      n: "c",
      preview: preview,
      head: head,
      tail: [{ t: "punct", v: square ? "]" : "}" }],
      members: list,
      hidden: Math.max(0, size - list.length),
    };
  }

  function argsToNodes(args: any): any[] {
    resetBudget();
    const parts = [];
    for (let i = 0; i < args.length; i++) {
      if (spent()) break;
      // A top-level string argument prints bare, the way a devtools console does.
      if (typeof args[i] === "string") {
        const s: string = args[i];
        const tokens: any[] = [];
        push(tokens, "plain", s.length > MAX_STRING ? s.slice(0, MAX_STRING) + "…" : s);
        parts.push({ n: "v", tokens: tokens });
      } else {
        parts.push(toNode(args[i], 0, []));
      }
    }
    return parts;
  }

  // ------------------------------------------------------------------- console

  function logger(level: string) {
    return function (...args: any[]) {
      if (!canEmitLog()) return;
      emit({ t: "log", level: level, parts: argsToNodes(args) });
    };
  }

  const counters: any = {};
  const timers: any = {};

  scope.console = {
    log: logger("log"),
    info: logger("info"),
    warn: logger("warn"),
    error: logger("error"),
    debug: logger("debug"),
    trace: logger("debug"),
    dir: logger("log"),
    table: logger("log"),
    group: logger("log"),
    groupCollapsed: logger("log"),
    groupEnd: function () {},
    clear: function () {},
    assert: function (condition: any, ...rest_: any[]) {
      if (condition) return;
      if (!canEmitLog()) return;
      const rest = argsToNodes(rest_);
      emit({ t: "log", level: "error", parts: [{ n: "v", tokens: [{ t: "error", v: "Assertion failed" }] }].concat(rest) });
    },
    count: function (label: any) {
      const key = label === undefined ? "default" : String(label);
      counters[key] = (counters[key] || 0) + 1;
      if (!canEmitLog()) return;
      emit({ t: "log", level: "log", parts: [{ n: "v", tokens: [{ t: "plain", v: key + ": " + counters[key] }] }] });
    },
    time: function (label: any) {
      timers[label === undefined ? "default" : String(label)] = now();
    },
    timeEnd: function (label: any) {
      const key = label === undefined ? "default" : String(label);
      if (timers[key] === undefined) return;
      const ms = now() - timers[key];
      delete timers[key];
      if (!canEmitLog()) return;
      emit({
        t: "log",
        level: "log",
        parts: [{ n: "v", tokens: [{ t: "plain", v: key + ": " }, { t: "number", v: ms.toFixed(2) + " ms" }] }],
      });
    },
  };

  // The three dialogs a beginner reaches for first. A worker has none of them, and a
  // bare ReferenceError teaches nothing, so they answer in the console instead.
  scope.alert = function (message: any) {
    emit({ t: "notice", text: "alert(" + String(message) + ")" });
  };
  scope.prompt = function () {
    emit({ t: "notice", text: "prompt() cannot open here — it returned null." });
    return null;
  };
  scope.confirm = function () {
    emit({ t: "notice", text: "confirm() cannot open here — it returned false." });
    return false;
  };

  // -------------------------------------------------------------------- errors

  function locate(stack: any) {
    if (!stack) return { line: null as number | null, column: null as number | null };
    const lines = String(stack).split("\n");
    const scan = function (onlyAnonymous: boolean) {
      for (let i = 0; i < lines.length; i++) {
        if (onlyAnonymous && lines[i].indexOf("anonymous") === -1) continue;
        const m = /:(\d+):(\d+)\)?\s*$/.exec(lines[i]);
        if (m) return { line: Number(m[1]) - lineOffset, column: Number(m[2]) };
      }
      return null;
    };
    const hit = scan(true) || scan(false);
    if (!hit || hit.line === null || hit.line < 1) return { line: null, column: null };
    return hit;
  }

  function describe(err: any) {
    if (err instanceof Error) {
      return { name: err.name || "Error", message: String(err.message), stack: err.stack };
    }
    resetBudget();
    const out: any[] = [];
    tokenize(err, out, 0, []);
    return {
      name: "Uncaught",
      message: out
        .map(function (tk: any) {
          return tk.v;
        })
        .join(""),
      stack: null,
    };
  }

  function fail(err: any, phase: string) {
    const d = describe(err);
    const at = phase === "syntax" ? { line: null, column: null } : locate(d.stack);
    emit({ t: "error", name: d.name, message: d.message, line: at.line, column: at.column, phase: phase });
  }

  scope.addEventListener("unhandledrejection", function (event: any) {
    if (event.preventDefault) event.preventDefault();
    fail(event.reason, "rejection");
  });
  scope.addEventListener("error", function (event: any) {
    if (event.preventDefault) event.preventDefault();
    fail(event.error || new Error(event.message), "runtime");
  });

  /**
   * How many lines the `AsyncFunction` wrapper adds before the user's first line.
   * Measured rather than assumed, because the number differs between engines — and
   * measuring it with the same `locate()` that reads real stacks keeps the two in step
   * whatever the engine's stack format turns out to be.
   */
  const ready = new Promise<void>(function (resolve) {
    let probe;
    try {
      probe = new AsyncFunction("throw new Error('probe')");
    } catch {
      resolve();
      return;
    }
    probe().then(
      function () {
        resolve();
      },
      function (err: any) {
        const at = locate(err && err.stack);
        if (at.line !== null) lineOffset = at.line - 1;
        resolve();
      },
    );
  });

  // ---------------------------------------------------------------------- run

  scope.onmessage = function (event: any) {
    const data = event.data;
    if (!data || data.t !== "run") return;
    ready.then(function () {
      let fn;
      try {
        // No "use strict" prefix: it would shift every line number by one, and sloppy
        // mode is what a playground snippet expects anyway.
        fn = new AsyncFunction(data.code);
      } catch (err) {
        fail(err, "syntax");
        emit({ t: "done", ms: 0 });
        return;
      }
      const start = now();
      const settle = function () {
        emit({ t: "done", ms: now() - start });
      };
      let result;
      try {
        result = fn();
      } catch (err) {
        fail(err, "runtime");
        settle();
        return;
      }
      // Returning from here means the synchronous part is over: the code either finished
      // or reached an await. Either way it handed control back, which is the one thing a
      // loop never does — and the only way the watchdog can tell the two apart, since by
      // the time it fires there is nobody left in the thread to ask.
      emit({ t: "yield" });
      Promise.resolve(result).then(settle, function (err: any) {
        fail(err, "runtime");
        settle();
      });
    });
  };
}

/** The worker's whole program, ready for a blob URL. */
export const WORKER_SOURCE = "(" + workerMain.toString() + ")();";
