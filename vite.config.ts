import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5210,
    proxy: {
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tiptap') || id.includes('tiptap-markdown') || id.includes('prosemirror')) {
              return 'vendor-tiptap';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('zustand')) {
              return 'vendor-zustand';
            }
            if (id.includes('d3-force') || id.includes('d3-zoom') || id.includes('d3-drag') || id.includes('d3-selection') || id.includes('d3-dispatch') || id.includes('d3-timer')) {
              return 'vendor-d3';
            }
            if (id.includes('@dnd-kit')) {
              return 'vendor-dnd';
            }
            if (id.includes('zod') || id.includes('express')) {
              return 'vendor-utils';
            }
          }
        },
      },
    },
    target: 'es2020',
    cssMinify: true,
  },
})
