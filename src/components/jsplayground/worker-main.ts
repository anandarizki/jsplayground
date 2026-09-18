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

  const scope: any = self;
  let sent = 0;
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
    if (label) push(out, "dim", label);
    push(out, "punct", "[");
    const shown = Math.min(length, MAX_ITEMS);
    for (let i = 0; i < shown; i++) {
      if (i) push(out, "punct", ", ");
      if (!(i in value)) {
        push(out, "dim", "<empty>");
        continue;
      }
      tokenize(value[i], out, depth + 1, seen);
    }
    if (length > shown) push(out, "dim", (shown ? ", " : "") + "… " + (length - shown) + " more");
    push(out, "punct", "]");
  }

  function pairTokens(value: any, out: any[], depth: number, seen: any[]) {
    push(out, "dim", "Map(" + value.size + ") ");
    push(out, "punct", "{");
    let i = 0;
    value.forEach(function (v: any, k: any) {
      if (i >= MAX_ITEMS) {
        i += 1;
        return;
      }
      if (i) push(out, "punct", ", ");
      tokenize(k, out, depth + 1, seen);
      push(out, "punct", " => ");
      tokenize(v, out, depth + 1, seen);
      i += 1;
    });
    if (value.size > MAX_ITEMS) push(out, "dim", ", … " + (value.size - MAX_ITEMS) + " more");
    push(out, "punct", "}");
  }

  function setTokens(value: any, out: any[], depth: number, seen: any[]) {
    push(out, "dim", "Set(" + value.size + ") ");
    push(out, "punct", "{");
    let i = 0;
    value.forEach(function (v: any) {
      if (i >= MAX_ITEMS) {
        i += 1;
        return;
      }
      if (i) push(out, "punct", ", ");
      tokenize(v, out, depth + 1, seen);
      i += 1;
    });
    if (value.size > MAX_ITEMS) push(out, "dim", ", … " + (value.size - MAX_ITEMS) + " more");
    push(out, "punct", "}");
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
    if (prefix) push(out, "dim", prefix);

    let keys: string[] = [];
    try {
      keys = Object.keys(value);
    } catch {
      /* revoked proxy */
    }
    push(out, "punct", "{");
    const shown = Math.min(keys.length, MAX_ITEMS);
    for (let i = 0; i < shown; i++) {
      if (i) push(out, "punct", ",");
      push(out, "punct", " ");
      push(out, "key", isIdent(keys[i]) ? keys[i] : quote(keys[i]));
      push(out, "punct", ": ");
      // Reading through a getter would run user code inside the formatter, which can
      // throw, recurse, or take a second. Name it and move on.
      let d;
      try {
        d = Object.getOwnPropertyDescriptor(value, keys[i]);
      } catch {
        d = null;
      }
      if (d && (d.get || d.set)) push(out, "dim", d.get ? "[Getter]" : "[Setter]");
      else tokenize(d ? d.value : undefined, out, depth + 1, seen);
    }
    if (keys.length > shown) push(out, "dim", ", … " + (keys.length - shown) + " more");
    push(out, "punct", shown ? " }" : "}");
  }

  function argsToParts(args: any): any[] {
    const parts = [];
    for (let i = 0; i < args.length; i++) {
      const out: any[] = [];
      // A top-level string argument prints bare, the way a devtools console does.
      if (typeof args[i] === "string") {
        const s: string = args[i];
        push(out, "plain", s.length > MAX_STRING ? s.slice(0, MAX_STRING) + "…" : s);
      } else {
        tokenize(args[i], out, 0, []);
      }
      parts.push(out);
    }
    return parts;
  }

  // ------------------------------------------------------------------- console

  function logger(level: string) {
    return function (...args: any[]) {
      emit({ t: "log", level: level, parts: argsToParts(args) });
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
      const rest = argsToParts(rest_);
      emit({ t: "log", level: "error", parts: [[{ t: "error", v: "Assertion failed" }]].concat(rest) });
    },
    count: function (label: any) {
      const key = label === undefined ? "default" : String(label);
      counters[key] = (counters[key] || 0) + 1;
      emit({ t: "log", level: "log", parts: [[{ t: "plain", v: key + ": " + counters[key] }]] });
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
        parts: [[{ t: "plain", v: key + ": " }, { t: "number", v: ms.toFixed(2) + " ms" }]],
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
