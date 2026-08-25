Reflect.set(process.env, "NODE_ENV", "test");

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // stub guard server-only (RSC) agar modul bisa dimuat di environment node vitest
      "server-only": path.resolve(__dirname, "tests/stubs/server-only-empty.js"),
    },
  },
  test: {
    environment: "node",
  },
});
