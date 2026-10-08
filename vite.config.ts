import { defineConfig } from 'vite';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
  // Source maps so coverage points back at the .tsx files
  build: {
    sourcemap: true,
  },
  // Instrument src for Playwright coverage (prod builds stay uninstrumented)
  plugins: [
    istanbul({
      include: ['src/**/*'],
      exclude: ['node_modules'],
      requireEnv: false,
    }),
  ],
});
