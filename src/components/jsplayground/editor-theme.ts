import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/**
 * Two themes built from one palette, shared with the console view's tones so a string
 * is the same green whether you are writing it or looking at what it printed.
 */
const PALETTE = {
  light: {
    text: "#27272a",
    caret: "#2563eb",
    selection: "#bfdbfe",
    gutter: "#d4d4d8",
    gutterActive: "#71717a",
    activeLine: "#00000006",
    keyword: "#7c3aed",
    string: "#059669",
    number: "#2563eb",
    comment: "#a1a1aa",
    def: "#b45309",
    property: "#0369a1",
    type: "#be123c",
    operator: "#71717a",
  },
  dark: {
    text: "#e4e4e7",
    caret: "#60a5fa",
    selection: "#1e40af",
    gutter: "#3f3f46",
    gutterActive: "#a1a1aa",
    activeLine: "#ffffff08",
    keyword: "#c4b5fd",
    string: "#6ee7b7",
    number: "#93c5fd",
    comment: "#71717a",
    def: "#fcd34d",
    property: "#7dd3fc",
    type: "#fda4af",
    operator: "#a1a1aa",
  },
};

function build(mode: "light" | "dark"): Extension[] {
  const c = PALETTE[mode];
  const theme = EditorView.theme(
    {
      "&": { color: c.text, backgroundColor: "transparent", fontSize: "13px" },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        fontFamily: "var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
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
        border: "none",
        borderRadius: "8px",
        backgroundColor: mode === "dark" ? "#27272a" : "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,.14)",
      },
    },
    { dark: mode === "dark" },
  );

  const highlight = HighlightStyle.define([
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword], color: c.keyword },
    { tag: [t.string, t.special(t.string), t.regexp], color: c.string },
    { tag: [t.number, t.bool, t.null, t.atom], color: c.number },
    { tag: [t.comment, t.lineComment, t.blockComment], color: c.comment, fontStyle: "italic" },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: c.def },
    { tag: [t.propertyName, t.attributeName], color: c.property },
    { tag: [t.typeName, t.className, t.namespace], color: c.type },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: c.operator },
    { tag: [t.variableName, t.definition(t.variableName)], color: c.text },
    { tag: t.invalid, color: "#ef4444" },
  ]);

  return [theme, syntaxHighlighting(highlight)];
}

const LIGHT = build("light");
const DARK = build("dark");

export const editorTheme = (dark: boolean): Extension[] => (dark ? DARK : LIGHT);
