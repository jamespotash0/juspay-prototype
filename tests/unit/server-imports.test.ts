import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vercel compiles each api/*.ts file to .js but leaves import specifiers as written, then loads
// them under plain Node ESM. A relative import ending in ".ts" (or with no extension) resolves
// fine locally — Vite and Vitest rewrite it — but crashes the deployed function with
// ERR_MODULE_NOT_FOUND. That shipped once: every endpoint except /api/health returned 500.
// So the server import graph must use ".js" specifiers, which TypeScript maps back to the .ts file.

const SERVER_DIRS = ['api', 'src/shared']
const RELATIVE_FROM = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

describe('server import specifiers (Vercel runtime)', () => {
  const files = SERVER_DIRS.flatMap(walk).filter((f) => f.endsWith('.ts'))

  it('finds the server files', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s: every relative import ends in .js', (file) => {
    const bad = [...readFileSync(file, 'utf8').matchAll(RELATIVE_FROM)]
      .map((m) => m[1])
      .filter((spec) => !spec.endsWith('.js'))
    expect(bad).toEqual([])
  })
})
