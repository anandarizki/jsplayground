/**
 * The sandbox, as a function that is stringified into a blob Worker.
 *
 * It runs in its own thread with no DOM, so the worst a snippet can do is burn one
 * core until the watchdog on the main thread calls `terminate()` — which is the only
 * thing that actually stops `while (true) {}`. Nothing here may reference a module
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
  const INLINE_WIDTH = 72; // a container wider than this collapses behind a toggle
  const PREVIEW_WIDTH = 96; // characters of a collapsed container's summary line
  const NEST = 2; // columns the view indents each open level by
  const MAX_NODES = 4000; // members serialised per console call

  const scope: any = self;
  let sent = 0;
  let nodes = 0;
  let capped = false;
  let lineOffset = 0;

  // Opaque to the bundler on purpose: writing `async function () {}` out here would
  // hand a downlevelling compiler something to rewrite.
  const AsyncFunction = new Function("return Object.getPrototypeOf(async function () {}).constructor")();

  function now(): number {
    return scope.performance && scope.performance.now ? scope.performance.now() : Date.now();
  }

  function emit(msg: any) {
    if (msg.t === "log") {
      if (capped) return;
      sent += 1;
      if (sent > MAX_ENTRIES) {
        capped = true;
        scope.postMessage({ t: "notice", text: "Output stopped after " + MAX_ENTRIES + " entries." });
        return;
      }
    }
    scope.postMessage(msg);
  }

  // ---------------------------------------------------------------- formatting

  function push(out: any[], t: string, v: string) {
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

  /** Printed width of one member, or Infinity once it has broken over lines itself —
   *  a container holding a broken member has to break too, whatever its own width. */
  function measure(tokens: any[]) {
    let n = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].v.indexOf("\n") !== -1) return Infinity;
      n += tokens[i].v.length;
    }
    return n;
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
      const item: any[] = [];
      if (i in value) tokenize(value[i], item, depth + 1, seen);
      else push(item, "dim", "<empty>");
      items.push(item);
    }
    assemble(out, label, "[", "]", items, false, length - shown);
  }

  function pairTokens(value: any, out: any[], depth: number, seen: any[]) {
    const items: any[] = [];
    let i = 0;
    value.forEach(function (v: any, k: any) {
      if (i < MAX_ITEMS) {
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
      if (i < MAX_ITEMS) {
        const item: any[] = [];
        tokenize(v, item, depth + 1, seen);
        items.push(item);
      }
      i += 1;
    });
    assemble(out, "Set(" + value.size + ") ", "{", "}", items, true, value.size - items.length);
  }

  function objectTokens(value: any, out: any[], depth: number, seen: any[], kind: string) {
    let prefix = "";
    try {
      if (Object.getPrototypeOf(value) === null) prefix = "[null prototype] ";
      else if (value.constructor && value.constructor.name && value.constructor.name !== "Object") {
        prefix = value.constructor.name + " ";
      } else if (kind !== "Object") prefix = kind + " ";
    } catch {
      /* exotic prototypes */
    }

    let keys: string[] = [];
    try {
      keys = Object.keys(value);
    } catch {
      /* revoked proxy */
    }
    const items: any[] = [];
    const shown = Math.min(keys.length, MAX_ITEMS);
    for (let i = 0; i < shown; i++) {
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
    assemble(out, prefix, "{", "}", items, true, keys.length - shown);
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
        if (i < MAX_ITEMS) {
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
        if (i < MAX_ITEMS) list.push(member(indexKey(i), toNode(v, depth + 1, seen)));
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
   * and carries a one-line summary plus its members. Which one a value gets is decided
   * by width alone: anything that fits on a line stays on the line, because a disclosure
   * triangle on `{ a: 1 }` is a click that buys nothing. Everything wider collapses —
   * the whole point being that a huge object costs one line until it is asked for.
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

    if (!opens(value, kind) || seen.indexOf(value) !== -1 || depth >= MAX_DEPTH || nodes >= MAX_NODES) {
      return flat();
    }

    // Wide containers skip the inline attempt: rendering one only to measure it and
    // throw it away is the expensive half of formatting a big value.
    const size = count(value, kind);
    if (size <= 16) {
      const inline = flat();
      if (measure(inline.tokens) <= Math.max(24, INLINE_WIDTH - depth * NEST)) return inline;
    }

    const preview: any[] = [];
    // Length first, because a shut array's summary is truncated long before its end and
    // "how many" is the thing you actually wanted. Map and Set already say their own.
    if (Array.isArray(value)) push(preview, "dim", "(" + size + ") ");
    // One level only: members show as `{…}` in the summary, the way devtools does it.
    tokenize(value, preview, MAX_DEPTH - 1, seen);

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
      preview: truncate(preview, PREVIEW_WIDTH),
      members: list,
      hidden: Math.max(0, size - list.length),
    };
  }

  function argsToNodes(args: any): any[] {
    nodes = 0;
    const parts = [];
    for (let i = 0; i < args.length; i++) {
      // A top-level string argument prints bare, the way a devtools console does.
      if (typeof args[i] === "string") {
        const s: string = args[i];
        parts.push({ n: "v", tokens: [{ t: "plain", v: s.length > MAX_STRING ? s.slice(0, MAX_STRING) + "…" : s }] });
      } else {
        parts.push(toNode(args[i], 0, []));
      }
    }
    return parts;
  }

  // ------------------------------------------------------------------- console

  function logger(level: string) {
    return function (...args: any[]) {
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
      const rest = argsToNodes(rest_);
      emit({ t: "log", level: "error", parts: [{ n: "v", tokens: [{ t: "error", v: "Assertion failed" }] }].concat(rest) });
    },
    count: function (label: any) {
      const key = label === undefined ? "default" : String(label);
      counters[key] = (counters[key] || 0) + 1;
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
      Promise.resolve(result).then(settle, function (err: any) {
        fail(err, "runtime");
        settle();
      });
    });
  };
}

/** The worker's whole program, ready for a blob URL. */
export const WORKER_SOURCE = "(" + workerMain.toString() + ")();";
