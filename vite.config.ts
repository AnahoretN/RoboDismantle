import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 4100,
    host: '0.0.0.0',
    strictPort: false,
  },
  plugins: [react()],
  base: '/RoboDismantle/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    // Улучшенная оптимизация для лучшего разделения кода
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunk для внешних библиотек
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // Игровые системы в отдельный chunk
          if (id.includes('/game/systems/')) {
            return 'gameSystems';
          }
          // Рендереры в отдельный chunk
          if (id.includes('/game/renderers/')) {
            return 'renderers';
          }
          // Утилиты тоже в отдельный chunk
          if (id.includes('/game/utils/') || id.includes('/game/hooks/')) {
            return 'gameUtils';
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
