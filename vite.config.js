import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { pages, headTags } from './src/seo.js';

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

// Each public page's title, description, canonical address, link previews
// and structured data (src/seo.js), set into its head so they are in the
// HTML crawlers read; the page's own <title> and description give way.
const seo = {
  name: 'baba-seo',
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => {
      const path = ctx.path.replace(/index\.html$/, '');
      const page = pages[path];
      if (!page) return html;
      return html
        .replace('<html lang="en">', '<html lang="en-IN">')
        .replace(/\s*<title>[\s\S]*?<\/title>/, '')
        .replace(/\s*<meta name="description"[^>]*>/, '')
        .replace(/(<meta name="theme-color"[^>]*>\n)/, `$1${headTags(path, page, html)}`);
    },
  },
};

export default defineConfig({
  plugins: [includes, seo],
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
        privacy: resolve(root, 'privacy/index.html'),
        terms: resolve(root, 'terms/index.html'),
        notFound: resolve(root, '404.html'),
        admin: resolve(root, 'admin/index.html'),
      },
    },
  },
});
