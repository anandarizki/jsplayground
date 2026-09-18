/**
 * Formatting, borrowed from Prettier.
 *
 * Imported on the click rather than at the top of the file: the parser and the printer
 * together are the largest thing this app can load, and most sessions never press the
 * button. Vite splits them into their own chunks, so the first paint never waits on them.
 */
export async function formatCode(code: string): Promise<string> {
  const [standalone, babel, estree] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
  ]);

  return standalone.format(code, {
    // `babel` over `acorn` because the editor accepts modern syntax — top-level `await`
    // among it, which is what half the async snippets are written with.
    parser: "babel",
    plugins: [babel, estree],
    printWidth: 80,
    tabWidth: 2,
    semi: true,
    singleQuote: false,
  });
}
