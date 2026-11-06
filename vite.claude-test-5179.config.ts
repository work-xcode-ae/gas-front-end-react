// Test-only Vite config (used by _test/START_TEST_PORTAL_5179.bat): portal on http://localhost:5179, /api forwarded to the
// test API on localhost:5102. VITE_API_URL must be a FULL url (the portal builds requests with new URL(...)). Safe to delete.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: 5179, strictPort: true, proxy: { '/api': 'http://localhost:5103' } },
})
