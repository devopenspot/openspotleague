import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "happy-dom",
    // Iframes (YouTube embeds) must not reach the network from unit tests.
    environmentOptions: {
      happyDOM: {
        settings: { navigation: { disableChildFrameNavigation: true } },
      },
    },
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./vitest.server-only.ts"),
    },
  },
})
