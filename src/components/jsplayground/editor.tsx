import { javascript } from "@codemirror/lang-javascript";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { memo, useMemo, useRef } from "react";

import { sandboxCompletion } from "./completion";
import { editorTheme } from "./editor-theme";
import type { CodeTheme } from "./themes";

/**
 * Hoisted, and that is the whole point of it.
 *
 * `@uiw/react-codemirror` keys its reconfigure effect on this object's identity, so an
 * inline literal — a new object every render — dispatched a full `StateEffect.reconfigure`
 * of the editor on every keystroke, every divider mousemove and every status change. The
 * careful work elsewhere in this file to keep the extension array stable was being undone
 * by the one prop beside it. It never changes, so it is written where it cannot.
 */
const BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: false,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  autocompletion: true,
  closeBrackets: true,
  tabSize: 2,
  bracketMatching: true,
  searchKeymap: false,
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Bound to Mod-Enter, whatever the current run mode is. */
  onRun: () => void;
  code: CodeTheme;
  /** Text size in pixels. Part of the theme, not of the element around it. */
  size: number;
  className?: string;
  /** Passed straight through to CodeMirror. "100%" fills a flex pane; "auto" grows
   *  with the document, which is what the notebook variant wants. */
  height?: string;
  minHeight?: string;
  maxHeight?: string;
};

function EditorInner({
  value,
  onChange,
  onRun,
  code,
  size,
  className,
  height = "100%",
  minHeight,
  maxHeight,
}: Props) {
  // Held in a ref so a changing callback does not rebuild the extension array, which
  // would reconfigure the editor on every keystroke.
  const runRef = useRef(onRun);
  runRef.current = onRun;

  const extensions = useMemo(
    () => [
      javascript(),
      sandboxCompletion(),
      EditorView.lineWrapping,
      keymap.of([
        {
          key: "Mod-Enter",
          preventDefault: true,
          run: () => {
            runRef.current();
            return true;
          },
        },
      ]),
      ...editorTheme(code, size),
    ],
    [code, size],
  );

  return (
    <CodeMirror
      className={className}
      value={value}
      onChange={onChange}
      height={height}
      minHeight={minHeight}
      maxHeight={maxHeight}
      theme="none"
      extensions={extensions}
      basicSetup={BASIC_SETUP}
    />
  );
}

/** Memoised because the page re-renders on every console message and every drag frame,
 *  and none of those are about the editor. Its props are all stable or change only when
 *  the editor really should be told. */
export const Editor = memo(EditorInner);
