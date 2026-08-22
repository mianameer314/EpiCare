import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('framer-motion') || id.includes('gsap')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('react/') || id.includes('@tanstack')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
});
