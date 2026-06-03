import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));

function copyManifestPlugin(): Plugin {
  return {
    name: 'copy-manifest',
    apply: 'build',
    writeBundle() {
      const src = resolve(projectRoot, 'manifest.json');
      const dest = resolve(projectRoot, 'dist/manifest.json');

      if (!existsSync(src)) {
        return;
      }

      mkdirSync(dirname(dest), { recursive: true });
      cpSync(src, dest);
    }
  };
}

function classicContentScriptPlugin(): Plugin {
  return {
    name: 'classic-content-script',
    apply: 'build',
    writeBundle() {
      const loaderPath = resolve(projectRoot, 'dist/content-loader.js');

      if (!existsSync(loaderPath)) {
        return;
      }

      const code = readFileSync(loaderPath, 'utf8');
      writeFileSync(loaderPath, code.replaceAll('import.meta.url', 'globalThis.location.href'));
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [copyManifestPlugin(), classicContentScriptPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(projectRoot, 'src/popup/index.html'),
        background: resolve(projectRoot, 'src/background/index.ts'),
        content: resolve(projectRoot, 'src/content/index.ts'),
        'content-loader': resolve(projectRoot, 'src/content/loader.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
