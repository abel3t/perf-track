import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  build: {
    emptyOutDir: false,
    outDir: '.output/public',
    lib: {
      entry: 'src/sw.ts',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'sw.js',
      },
    },
  },
})
