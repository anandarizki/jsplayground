import { javascriptLanguage, scopeCompletionSource } from "@codemirror/lang-javascript";
import type { Extension } from "@codemirror/state";

/**
 * Completion that describes the sandbox, not the page.
 *
 * `scopeCompletionSource` walks a real object, so handing it `globalThis` would be the
 * easy move — and would offer `document`, `localStorage` and `window`, none of which
 * exist in a worker. Every suggestion here is something the snippet can actually call.
 *
 * Built lazily and defensively: this module is evaluated during SSR too, and a global
 * missing from the server's runtime should cost a completion, not the render.
 */
function sandboxScope(): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  const globals = globalThis as unknown as Record<string, unknown>;

  const expose = (names: string[]) => {
    for (const name of names) {
      if (typeof globals[name] !== "undefined") scope[name] = globals[name];
    }
  };

  expose([
    // language
    "Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt", "Function",
    "Math", "JSON", "Date", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Promise",
    "Proxy", "Reflect", "Intl", "globalThis",
    "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "EvalError", "URIError",
    "ArrayBuffer", "SharedArrayBuffer", "DataView", "Int8Array", "Uint8Array", "Uint8ClampedArray",
    "Int16Array", "Uint16Array", "Int32Array", "Uint32Array", "Float32Array", "Float64Array",
    "BigInt64Array", "BigUint64Array",
    "parseInt", "parseFloat", "isNaN", "isFinite", "NaN", "Infinity", "undefined",
    "encodeURI", "encodeURIComponent", "decodeURI", "decodeURIComponent",
    // host surface the worker really has
    "setTimeout", "setInterval", "clearTimeout", "clearInterval", "queueMicrotask",
    "structuredClone", "atob", "btoa", "crypto", "performance",
    "fetch", "Request", "Response", "Headers", "AbortController", "AbortSignal",
    "URL", "URLSearchParams", "TextEncoder", "TextDecoder", "Blob", "FormData",
  ]);

  // The worker installs its own console and dialog shims, so describe those rather
  // than the browser's — the two are not the same object.
  const noop = () => {};
  scope.console = {
    log: noop, info: noop, warn: noop, error: noop, debug: noop, trace: noop,
    dir: noop, table: noop, group: noop, groupCollapsed: noop, groupEnd: noop,
    clear: noop, assert: noop, count: noop, time: noop, timeEnd: noop,
  };
  scope.alert = noop;
  scope.prompt = noop;
  scope.confirm = noop;

  return scope;
}

let cached: Extension | null = null;

/**
 * Property and global completion, on top of the keyword, snippet and local-scope
 * sources `javascript()` already registers.
 */
export function sandboxCompletion(): Extension {
  if (!cached) {
    cached = javascriptLanguage.data.of({ autocomplete: scopeCompletionSource(sandboxScope()) });
  }
  return cached;
}
