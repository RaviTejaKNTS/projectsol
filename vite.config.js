import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT:
// If your GitHub repo name is not "tasksmint", change the base below to '/<your-repo-name>/'
export default defineConfig({
  base: '/tasksmint/',
  plugins: [react()],
})
