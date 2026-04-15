import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite Configuration
 * Stable for Vite v5 and Node 18 LTS
 * Production-ready for Netlify deployment
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  build: {
    // ── Rollup Options for Stable Splitting ─────────────────────────────────
    rollupOptions: {
      output: {
        // Correctly using Function format for manualChunks to avoid Vite/Rollup errors
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React core — always needed
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-core';
            }
            // Charts — only used on Analytics page
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
              return 'vendor-charts';
            }
            // PDF / canvas export — only used on bill-print / report pages
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('html-to-image')) {
              return 'vendor-pdf';
            }
            // UI icons + realtime — lightweight but shared
            if (id.includes('lucide-react') || id.includes('socket.io-client')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },

    // ── Build Settings ──────────────────────────────────────────────────────
    target: 'es2020', // High compatibility with Node 18 and modern browsers
    sourcemap: false, // Smaller builds, better for production
    minify: 'esbuild',
    chunkSizeWarningLimit: 1200,
  },

  // ── Optimization for Production ──────────────────────────────────────────
  esbuild: {
    // Drop console and debugger in production builds
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },

  server: {
    port: 5173,
    host: true,
    strictPort: true,
    hmr: true,
  },
}));
