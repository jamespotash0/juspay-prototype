import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
    // Sandbox tests call api/ handlers directly; they read keys from process.env like Vercel does.
    env: loadEnv('test', process.cwd(), ''),
    testTimeout: 30_000,
  },
})
