import { javascript } from "@codemirror/lang-javascript";
import { selectNextOccurrence } from "@codemirror/search";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { memo, useEffect, useMemo, useRef } from "react";

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
/** Which modifier `Mod` means, for the one binding handled outside CodeMirror. On a Mac
 *  that is ⌘; `Ctrl-d` there is delete-forward and is not ours to take. */
const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: false,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  autocompletion: true,
  closeBrackets: true,
  tabSize: 2,
  bracketMatching: true,
  // The search panel and its bindings are not wanted, but one command out of that keymap
  // is: `Mod-d`, below. Taking the binding rather than the panel is why this stays off.
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

  const viewRef = useRef<EditorView | null>(null);

  // `Mod-d` above only ever sees the key when the editor has focus, and CodeMirror can
  // only prevent what reaches it. Click the output, press ⌘D, and Chrome bookmarks the
  // page — over an app whose one job is the editor. So the key is caught for the whole
  // window and handed to the editor wherever it was pressed.
  //
  // Not while a dialog is open: the keyboard belongs to the dialog then, and pulling
  // focus to an editor nobody is looking at would be worse than a bookmark. Fields are
  // left alone for the same reason, and a key the editor has already handled arrives
  // here marked as such.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if (event.key !== "d" || !(MAC ? event.metaKey : event.ctrlKey)) return;
      const view = viewRef.current;
      if (!view || document.querySelector("[role=dialog]")) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      view.focus();
      selectNextOccurrence(view);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const extensions = useMemo(
    () => [
      javascript(),
      sandboxCompletion(),
      EditorView.lineWrapping,
      // `Prec.highest`, and it is load-bearing. `basicSetup` is spread into the
      // configuration ahead of these extensions, so its `defaultKeymap` was asked first
      // and answered first: `Mod-Enter` is bound there to `insertBlankLine`, which
      // handles the key, returns true and stops the chain. Pressing it ran nothing and
      // quietly added a blank line instead. Precedence is the only thing that decides
      // which of two bindings for one key wins, so this says which.
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              runRef.current();
              return true;
            },
          },
          {
            // Selects the word under the cursor, then a further occurrence of it on each
            // press, each with a cursor of its own — the editor everyone arrives from.
            // `Mod-d` rather than `Ctrl-d`: on a Mac the latter is delete-forward, which
            // `defaultKeymap` binds and which people do use.
            key: "Mod-d",
            preventDefault: true,
            run: selectNextOccurrence,
          },
        ]),
      ),
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
      onCreateEditor={(view) => {
        viewRef.current = view;
      }}
    />
  );
}

/** Memoised because the page re-renders on every console message and every drag frame,
 *  and none of those are about the editor. Its props are all stable or change only when
 *  the editor really should be told. */
export const Editor = memo(EditorInner);
