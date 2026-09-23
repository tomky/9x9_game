import { defineConfig } from 'vite';

// base 設為相對路徑，build 後放在任何子目錄（例如 GitHub Pages 的 /9x9_game/）都能執行。
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: {
    include: ['tests/**/*.test.ts'],
  },
} as any);
