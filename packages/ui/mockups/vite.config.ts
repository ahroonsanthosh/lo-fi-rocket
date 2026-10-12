import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Builds the mockup screens of docs/ui/redesign.md from the library itself (plan UI-0001). */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
