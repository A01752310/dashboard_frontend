import {defineConfig} from 'vite';
export default defineConfig({
  server: {host:'127.0.0.1'},
  preview: {host:'127.0.0.1'},
  // Production server.py owns /api. Vite is only a simulation development server.
  build: {outDir:'dist'}
});
