import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

// The public pages share their header, footer and dialogs: each page writes
// <!-- @include header.html --> and the markup in partials/ is set in its
// place, in development and in the build alike.
const includes = {
  name: 'baba-includes',
  transformIndexHtml: {
    order: 'pre',
    handler: html => html.replace(/<!--\s*@include\s+([\w.-]+)\s*-->/g, (_, file) => readFileSync(resolve(root, 'partials', file), 'utf8')),
  },
};

export default defineConfig({
  plugins: [includes],
  build: {
    rollupOptions: {
      // Keep licence banners (/*! … */), such as React Bits' (NOTICE.md).
      output: { comments: { legal: true, annotation: false, jsdoc: false } },
      input: {
        main: resolve(root, 'index.html'),
        collection: resolve(root, 'collection/index.html'),
        car: resolve(root, 'car/index.html'),
        concierge: resolve(root, 'concierge/index.html'),
        about: resolve(root, 'about/index.html'),
        sell: resolve(root, 'sell/index.html'),
        consultation: resolve(root, 'consultation/index.html'),
        admin: resolve(root, 'admin/index.html'),
      },
    },
  },
});
