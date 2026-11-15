// TEST-ONLY: serves the real app with synthetic data from ./public (port 5174) for layout checks.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true },
});
