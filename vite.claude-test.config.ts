// Test-only Vite config (used by _test/START_TEST_PORTAL.bat): serves the portal on port 5175 and forwards /api to the
// test API on localhost:5090, so the browser only talks to one address. Safe to delete; the normal config is vite.config.ts.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true, proxy: { '/api': 'http://localhost:5090' } },
})
