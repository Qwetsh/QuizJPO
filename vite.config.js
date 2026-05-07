import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le base path est défini par la variable d'env VITE_BASE en CI (ex: "/QuizzJPO/").
// En dev local, pas de variable → "/" → ça marche normalement.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  server: { host: true },
})
