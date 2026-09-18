import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

/** The Night theme's background, which is also the first frame's — see `index.css`. */
const BACKGROUND = "#0a0a0b"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // `prompt`, not `autoUpdate`: the editor's buffer lives in memory and nowhere else,
      // so a new build must never reload the tab out from under someone's half-written
      // code. A waiting worker takes over the next time the app is opened fresh.
      registerType: "prompt",
      workbox: {
        // Everything the app can ask for, including the three Prettier chunks that Format
        // imports lazily — miss those and the button is the one thing that breaks offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        navigateFallback: "index.html",
        // Analytics is served by the host, not by the build: offline it should fail as a
        // request rather than be answered with the app's own HTML.
        navigateFallbackDenylist: [/^\/_vercel\//],
        // The first worker has no predecessor to wait for, so this makes the very first
        // visit a controlled one — offline works without a second load to arm it.
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "JSPlayground",
        short_name: "JSPlayground",
        description:
          "A two-pane JavaScript playground: write JavaScript in one pane, watch it run in the other — in a worker that can be killed.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: BACKGROUND,
        theme_color: BACKGROUND,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          // Kept separate from the two above: a launcher that crops to a circle would eat
          // the corners of the square mark, so this one is drawn with room to lose.
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
