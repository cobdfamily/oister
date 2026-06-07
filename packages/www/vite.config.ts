import { defineConfig } from 'vite';

// Self-contained: the package root is the Vite root, index.html is the entry,
// and everything the shell serves lives under public/ (the springboard child
// app, favicon, manifest). No external sibling repo, no static-copy step.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
