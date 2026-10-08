import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [basicSsl(), tailwindcss()],
  server: { https: true },
})