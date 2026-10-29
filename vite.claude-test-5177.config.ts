// Test-only Vite config (used by _test/START_TEST_PORTAL_5177.bat): portal on http://localhost:5177, /api forwarded to the
// test API on localhost:5091. VITE_API_URL must be a FULL url (the portal builds requests with new URL(...)). Safe to delete.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: 5177, strictPort: true, proxy: { '/api': 'http://localhost:5091' } },
})
