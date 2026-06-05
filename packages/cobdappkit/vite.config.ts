import { defineConfig } from "vite";

// Empty Capacitor shell: build the web assets into `dist`, which capacitor.config
// points at as `webDir`.
export default defineConfig({
  build: {
    outDir: "dist",
  },
});
