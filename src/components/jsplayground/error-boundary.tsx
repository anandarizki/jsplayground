import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback: ReactNode };
type State = { failed: boolean };

/**
 * The last guard around the output pane.
 *
 * Everything the console draws has been checked on the way in, so nothing here is
 * expected to fire. It exists for the case the checking misses: React unmounts the whole
 * root when a render throws, and this app's root is the app, so one bad row would
 * otherwise cost the editor, the rail and whatever was typed into it. Contained here,
 * the damage is one pane saying it cannot draw itself.
 *
 * Recovery is by remount rather than by a reset method: the caller keys this on the
 * runner's generation, so erasing the output or starting a run gives it a new instance
 * and a clean state. There is nothing to un-break in place — the entry that could not be
 * drawn is gone by then.
 *
 * A class because `getDerivedStateFromError` has no hook form.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nothing is shown to the person beyond the fallback, but a developer opening the
    // console should find what happened rather than an empty pane and no explanation.
    console.error("The output pane failed to render.", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
