import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err: any, _req, _res) => {
            // Suppress proxy errors when backend is not available
            // The frontend code handles these gracefully with mock data
            if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
              // Silently ignore connection refused/reset errors
              // These are expected when the backend isn't running
              return;
            }
            // Log other proxy errors (vite.config only runs in dev/build)
            console.error('Proxy error:', err);
          });
        },
      },
    },
  },
})

