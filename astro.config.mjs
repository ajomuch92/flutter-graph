// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vue from '@astrojs/vue';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [vue()],
  output: 'server',

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: cloudflare()
});