import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'

// engineering.md §9 reviewer checklist. No browser; paths are relative to the repo root.
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))

test('no VITE_ prefix anywhere under api/', () => {
  const hits = files('api').filter((f) => readFileSync(f, 'utf8').includes('VITE_'))
  expect(hits).toEqual([])
})

test('after npm run build, the secret key is not in dist/', () => {
  test.setTimeout(180_000)
  const key = parseEnv(readFileSync('.env', 'utf8')).JUSPAY_API_TEST_KEY
  expect(key, 'JUSPAY_API_TEST_KEY in .env').toBeTruthy()
  execSync('npm run build', { stdio: 'ignore' })
  // Boolean only: the key itself is never printed.
  const leaked = files('dist').filter((f) => readFileSync(f).includes(key!))
  expect(leaked).toEqual([])
})

test('CheckoutRequest has no amount field', () => {
  const types = readFileSync('src/shared/types.ts', 'utf8')
  const body = types.match(/export interface CheckoutRequest \{([\s\S]*?)\n\}/)?.[1]
  expect(body, 'CheckoutRequest in types.ts').toBeTruthy()
  expect(body!.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toMatch(/\bamount\b/i)
})
