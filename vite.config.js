import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    chunkSizeWarningLimit: 650, // Contexts + services are inherently bundled together
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':     ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase':  ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
          'vendor-capacitor': ['@capacitor/core', '@capacitor/browser', '@capacitor/app'],
          'vendor-icons':     ['lucide-react'],
        },
      },
    },
  },
})
