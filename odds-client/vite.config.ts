import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/odds/',
  server: {
    proxy: {
      '/api/odds': {
        target: 'http://localhost:3001',
      },
    },
  },
});
