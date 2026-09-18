import type { Runner } from "./use-runner";

/** One short string for the status line. Each variant decides where to put it. */
export function statusLabel(runner: Runner): string {
  switch (runner.status) {
    case "idle":
      return "ready";
    case "running":
      return "running…";
    case "ok":
      return runner.ms === null ? "done" : `${runner.ms < 10 ? runner.ms.toFixed(1) : Math.round(runner.ms)} ms`;
    case "error":
      return "error";
    case "timeout":
      return "timed out";
    case "unsupported":
      return "no sandbox";
  }
}

export function statusTone(runner: Runner): string {
  if (runner.status === "error" || runner.status === "timeout") return "text-red-500";
  if (runner.status === "running") return "text-amber-500";
  return "text-zinc-400 group-[.dark]:text-zinc-500";
}
