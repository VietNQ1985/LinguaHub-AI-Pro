import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(import.meta.dirname, 'tauri-ui'),
  plugins: [react()],
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'dist-tauri'),
    emptyOutDir: true,
  },
  server: { port: 1420, strictPort: true },
})
