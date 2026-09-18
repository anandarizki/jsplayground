import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

import type { CodeTheme } from "./themes";

/**
 * A CodeMirror theme built from one of the code palettes.
 *
 * The same palette drives the console's tones, so a string is the same green whether you
 * are writing it or reading what it printed. Built per palette and cached, because the
 * extension array must be stable across renders or the editor reconfigures on every
 * keystroke.
 */
function build(c: CodeTheme, size: number): Extension[] {
  const theme = EditorView.theme(
    {
      // Transparent throughout: the pane shows the app theme's background, so the two
      // halves of the window are one surface rather than two that nearly match.
      "&": { color: c.text, backgroundColor: "transparent", fontSize: `${size}px` },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        lineHeight: "1.65",
      },
      ".cm-content": { caretColor: c.caret, padding: "16px 0" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: c.caret, borderLeftWidth: "2px" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: c.selection,
      },
      ".cm-gutters": {
        backgroundColor: "transparent",
        color: c.gutter,
        border: "none",
        paddingRight: "12px",
        paddingLeft: "16px",
      },
      ".cm-activeLine": { backgroundColor: c.activeLine },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: c.gutterActive },
      ".cm-lineNumbers .cm-gutterElement": { minWidth: "20px" },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "transparent",
        color: c.def,
        fontWeight: "600",
      },
      ".cm-tooltip": {
        // The app theme's raised surface, read at use — the editor has no background of
        // its own to match, and completion has to sit on something opaque.
        border: "1px solid var(--jp-border)",
        borderRadius: "8px",
        backgroundColor: "var(--jp-panel)",
        color: "var(--jp-text)",
        boxShadow: "0 8px 24px rgba(0,0,0,.14)",
      },
    },
    { dark: c.dark },
  );

  const highlight = HighlightStyle.define([
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword], color: c.keyword },
    { tag: [t.string, t.special(t.string), t.regexp], color: c.string },
    { tag: [t.number, t.bool, t.null, t.atom], color: c.number },
    { tag: [t.comment, t.lineComment, t.blockComment], color: c.comment, fontStyle: "italic" },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))],
      color: c.def,
    },
    { tag: [t.propertyName, t.attributeName], color: c.property },
    { tag: [t.typeName, t.className, t.namespace], color: c.type },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: c.operator },
    { tag: [t.variableName, t.definition(t.variableName)], color: c.text },
    { tag: t.invalid, color: c.error },
  ]);

  return [theme, syntaxHighlighting(highlight)];
}

const cache = new Map<string, Extension[]>();

/**
 * Size belongs in here rather than on the element around the editor.
 *
 * CodeMirror measures a line once and gives every gutter element that height, so text
 * scaled underneath it by an inherited `font-size` leaves the numbers behind — by a
 * pixel a line, which is a whole line by the bottom of a long document. Passing the size
 * through the theme makes it a reconfiguration, and a reconfiguration is measured again.
 * The cache key carries it, so the array is still stable across every render that did
 * not change it.
 */
export function editorTheme(code: CodeTheme, size: number): Extension[] {
  const key = `${code.id}:${size}`;
  let built = cache.get(key);
  if (!built) {
    built = build(code, size);
    cache.set(key, built);
  }
  return built;
}
