import { javascript } from "@codemirror/lang-javascript";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo, useRef } from "react";

import { sandboxCompletion } from "./completion";
import { editorTheme } from "./editor-theme";
import type { CodeTheme } from "./themes";

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

export function Editor({
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
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: true,
        closeBrackets: true,
        tabSize: 2,
        bracketMatching: true,
        searchKeymap: false,
      }}
    />
  );
}
