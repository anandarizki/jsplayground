/**
 * Two palettes, deliberately separate.
 *
 * An **app theme** paints every surface: the rail, the headers, the footer, the dialogs
 * and the two panes alike, so the window reads as one thing. A **code theme** paints only
 * what is written on them — the editor's syntax and the console's output both come from
 * it, which is what keeps a string the same green whether you are writing it or reading
 * what it printed.
 *
 * They are separate values but not free ones: only code themes of the app theme's own
 * brightness are offered, because a light code surface under dark chrome is legible and
 * still looks like a mistake. Changing the app theme carries the code theme to the same
 * slot in the other list, which is what makes that move reversible.
 */

export type AppTheme = {
  id: string;
  name: string;
  /** Drives `color-scheme`, so scrollbars and form controls match. */
  dark: boolean;
  /** Page background, behind the rail and footer. */
  bg: string;
  /** Dialogs and anything raised above the page. */
  panel: string;
  border: string;
  /** Primary text. */
  text: string;
  /** Pane headers, footer, secondary labels. */
  muted: string;
  /** Hints and placeholders — the quietest thing still meant to be read. */
  faint: string;
  hover: string;
  /** A control that is currently on. */
  active: string;
  /** The live-run accent. */
  accent: string;
  accentBg: string;
  warn: string;
  warnBg: string;
  error: string;
  errorBg: string;
};

export const APP_THEMES: AppTheme[] = [
  {
    id: "sunny",
    name: "Sunny",
    dark: false,
    bg: "#fffefb",
    panel: "#ffffff",
    border: "#e8e3d9",
    text: "#2b2a26",
    muted: "#6b6760",
    faint: "#a8a39a",
    hover: "#f2ede3",
    active: "#e6dfd1",
    accent: "#047857",
    accentBg: "#d1fae5",
    warn: "#92400e",
    warnBg: "#fef3c7",
    error: "#b91c1c",
    errorBg: "#fee2e2",
  },
  {
    id: "calm",
    name: "Calm",
    dark: false,
    bg: "#f6f8fb",
    panel: "#ffffff",
    border: "#dfe5ee",
    text: "#253044",
    muted: "#5b6880",
    faint: "#9aa5b8",
    hover: "#e9eef6",
    active: "#dbe3f0",
    accent: "#0369a1",
    accentBg: "#dbeafe",
    warn: "#9a5b00",
    warnBg: "#fdf0d5",
    error: "#b3261e",
    errorBg: "#fde8e6",
  },
  {
    id: "paper",
    name: "Paper",
    dark: false,
    bg: "#faf5ec",
    panel: "#fffdf8",
    border: "#e5dcc9",
    text: "#3b352a",
    muted: "#71685a",
    faint: "#a89f8d",
    hover: "#f0e8d8",
    active: "#e5dac3",
    accent: "#7c5b12",
    accentBg: "#f5e6c0",
    warn: "#8a5a00",
    warnBg: "#f6e7c4",
    error: "#a93226",
    errorBg: "#f7ddd8",
  },
  {
    id: "night",
    name: "Night",
    dark: true,
    bg: "#0a0a0b",
    panel: "#141416",
    border: "#26262b",
    text: "#e8e8ea",
    muted: "#9a9aa2",
    faint: "#5f5f68",
    hover: "#1d1d21",
    active: "#2a2a30",
    accent: "#34d399",
    accentBg: "#0b3b2c",
    warn: "#fcd34d",
    warnBg: "#332a0c",
    error: "#f87171",
    errorBg: "#3a1416",
  },
  {
    id: "dusk",
    name: "Dusk",
    dark: true,
    bg: "#101019",
    panel: "#161623",
    border: "#262640",
    text: "#e4e4f0",
    muted: "#9b9bb5",
    faint: "#626280",
    hover: "#1e1e30",
    active: "#2a2a45",
    accent: "#a5b4fc",
    accentBg: "#2a2760",
    warn: "#fcd34d",
    warnBg: "#332b12",
    error: "#fca5a5",
    errorBg: "#3d161c",
  },
  {
    id: "forest",
    name: "Forest",
    dark: true,
    bg: "#0b1210",
    panel: "#121b18",
    border: "#1f2d28",
    text: "#e2eae6",
    muted: "#94a8a0",
    faint: "#5d716a",
    hover: "#16211d",
    active: "#1f2f29",
    accent: "#6ee7b7",
    accentBg: "#0a3b2c",
    warn: "#fcd34d",
    warnBg: "#2e2b0f",
    error: "#fca5a5",
    errorBg: "#331a1a",
  },
];

export type CodeTheme = {
  id: string;
  name: string;
  dark: boolean;
  /** No background of its own: the panes show the app theme's, so the two halves of the
   *  window are one surface. That is also why the list is filtered by brightness — a
   *  code theme has nothing to sit on but the chrome. */
  text: string;
  caret: string;
  selection: string;
  gutter: string;
  gutterActive: string;
  /** Deliberately an alpha colour: it has to sit over `bg` without being told what it is. */
  activeLine: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  def: string;
  property: string;
  type: string;
  operator: string;
  error: string;
};

export const CODE_THEMES: CodeTheme[] = [
  {
    id: "plain",
    name: "Plain",
    dark: false,
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
    error: "#dc2626",
  },
  {
    id: "sepia",
    name: "Sepia",
    dark: false,
    text: "#3a3327",
    caret: "#b45309",
    selection: "#f5e0b8",
    gutter: "#cfc4ab",
    gutterActive: "#8a7c62",
    activeLine: "#00000008",
    keyword: "#9a3412",
    string: "#4d7c0f",
    number: "#b45309",
    comment: "#a8a08c",
    def: "#a16207",
    property: "#0f766e",
    type: "#9f1239",
    operator: "#7c7361",
    error: "#b91c1c",
  },
  {
    id: "meadow",
    name: "Meadow",
    dark: false,
    text: "#24302a",
    caret: "#059669",
    selection: "#bbf7d0",
    gutter: "#c3d6c8",
    gutterActive: "#4d7c5f",
    activeLine: "#00000006",
    keyword: "#7c3aed",
    string: "#15803d",
    number: "#0369a1",
    comment: "#9db3a4",
    def: "#a16207",
    property: "#0f766e",
    type: "#be123c",
    operator: "#6b7f72",
    error: "#dc2626",
  },
  {
    id: "frost",
    name: "Frost",
    dark: false,
    text: "#1f2a37",
    caret: "#0284c7",
    selection: "#cfe6fb",
    gutter: "#c4d3e0",
    gutterActive: "#55708a",
    activeLine: "#00000006",
    keyword: "#6d28d9",
    string: "#0f766e",
    number: "#1d4ed8",
    comment: "#9fb0c0",
    def: "#b45309",
    property: "#0369a1",
    type: "#9d174d",
    operator: "#6b7f91",
    error: "#be123c",
  },
  {
    id: "mono",
    name: "Mono",
    dark: false,
    text: "#1f1f1f",
    caret: "#1f1f1f",
    selection: "#e0e0e0",
    gutter: "#cccccc",
    gutterActive: "#666666",
    activeLine: "#00000005",
    keyword: "#111111",
    string: "#5a5a5a",
    number: "#333333",
    comment: "#a3a3a3",
    def: "#222222",
    property: "#484848",
    type: "#333333",
    operator: "#7a7a7a",
    error: "#8a1f1f",
  },
  {
    id: "ink",
    name: "Ink",
    dark: true,
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
    error: "#f87171",
  },
  {
    id: "ember",
    name: "Ember",
    dark: true,
    text: "#f0e6df",
    caret: "#fb923c",
    selection: "#7c2d12",
    gutter: "#4a3b33",
    gutterActive: "#b8a094",
    activeLine: "#ffffff08",
    keyword: "#fb923c",
    string: "#fcd34d",
    number: "#fdba74",
    comment: "#8a7268",
    def: "#f59e0b",
    property: "#fca5a5",
    type: "#f87171",
    operator: "#a89086",
    error: "#ef4444",
  },
  {
    id: "orchid",
    name: "Orchid",
    dark: true,
    text: "#ece6f5",
    caret: "#c084fc",
    selection: "#4c1d95",
    gutter: "#453a5c",
    gutterActive: "#b3a3cc",
    activeLine: "#ffffff08",
    keyword: "#d8b4fe",
    string: "#86efac",
    number: "#a5b4fc",
    comment: "#7e6f99",
    def: "#f0abfc",
    property: "#93c5fd",
    type: "#f9a8d4",
    operator: "#a795c4",
    error: "#fb7185",
  },
  {
    id: "neon",
    name: "Neon",
    dark: true,
    text: "#e6f6ff",
    caret: "#22d3ee",
    selection: "#0e7490",
    gutter: "#2b4450",
    gutterActive: "#7dd3fc",
    activeLine: "#ffffff0a",
    keyword: "#f472b6",
    string: "#4ade80",
    number: "#22d3ee",
    comment: "#5b7a8a",
    def: "#facc15",
    property: "#38bdf8",
    type: "#fb7185",
    operator: "#7fa8bb",
    error: "#ff5470",
  },
  {
    id: "contrast",
    name: "Contrast",
    dark: true,
    text: "#ffffff",
    caret: "#ffff00",
    selection: "#0057b7",
    gutter: "#6b6b6b",
    gutterActive: "#ffffff",
    activeLine: "#ffffff10",
    keyword: "#d0a0ff",
    string: "#7dff9a",
    number: "#8ecbff",
    comment: "#b0b0b0",
    def: "#ffd45e",
    property: "#8ecbff",
    type: "#ff9aa8",
    operator: "#dddddd",
    error: "#ff6b6b",
  },
];

export const appTheme = (id: string): AppTheme => APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[3];
export const codeTheme = (id: string): CodeTheme => CODE_THEMES.find((t) => t.id === id) ?? CODE_THEMES[5];

/** The two halves of `CODE_THEMES`, which are the same length and in the same order. */
const LIGHT_CODE = CODE_THEMES.filter((t) => !t.dark);
const DARK_CODE = CODE_THEMES.filter((t) => t.dark);

/** Only the code themes that belong under chrome of this brightness. Pairing a light
 *  code surface with dark chrome is legible but looks like a mistake, so it is not
 *  offered — the two lists are the choice, and the app theme picks which one. */
export const codeThemesFor = (dark: boolean): CodeTheme[] => (dark ? DARK_CODE : LIGHT_CODE);

/**
 * The same slot in the other list.
 *
 * Switching the app between light and dark has to move the code theme with it, and
 * moving it by position rather than to a fixed default is what makes the move
 * reversible: going dark and back again returns the theme you started on.
 */
export function matchCode(id: string, dark: boolean): string {
  const target = codeThemesFor(dark);
  if (target.some((t) => t.id === id)) return id;
  const index = codeThemesFor(!dark).findIndex((t) => t.id === id);
  return (index >= 0 ? (target[index] ?? target[0]) : target[0]).id;
}

/**
 * Both palettes as custom properties on one element.
 *
 * Every colour in the app reads one of these rather than naming a Tailwind shade, which
 * is the only reason a theme can be a value chosen at runtime instead of a second set of
 * classes written next to the first.
 */
export function cssVars(app: AppTheme, code: CodeTheme): Record<string, string> {
  return {
    "--jp-bg": app.bg,
    "--jp-panel": app.panel,
    "--jp-border": app.border,
    "--jp-text": app.text,
    "--jp-muted": app.muted,
    "--jp-faint": app.faint,
    "--jp-hover": app.hover,
    "--jp-active": app.active,
    "--jp-accent": app.accent,
    "--jp-accent-bg": app.accentBg,
    "--jp-warn": app.warn,
    "--jp-warn-bg": app.warnBg,
    "--jp-error": app.error,
    "--jp-error-bg": app.errorBg,

    "--jp-code-text": code.text,
    "--jp-code-keyword": code.keyword,
    "--jp-code-string": code.string,
    "--jp-code-number": code.number,
    "--jp-code-comment": code.comment,
    "--jp-code-def": code.def,
    "--jp-code-property": code.property,
    "--jp-code-type": code.type,
    "--jp-code-operator": code.operator,
    "--jp-code-error": code.error,
  };
}
