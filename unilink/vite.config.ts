import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Use type assertion on process to ensure TypeScript recognizes cwd() in the Vite config context.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'terser',
    },
    define: {
      // Expose the API_KEY to the application code via process.env
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    }
  };
});
