import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'

/**
 * Serves api/<name>.ts in `npm run dev` the way Vercel does in production:
 * call the exported GET/POST/... handler with a Web Request, stream back the Response.
 */
function apiRoutes(): Plugin {
  return {
    name: 'api-routes',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        handle(server, req, res).catch(next)
      })
    },
  }
}

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  // Mounted at /api, so req.url is "/<name>?query".
  const url = new URL(req.url ?? '/', 'http://localhost')
  const name = url.pathname.slice(1)
  // No traversal, and `_lib` style helpers are not routes (same as Vercel).
  if (!/^[a-z0-9-]+$/i.test(name))
    return send(res, 404, { error: { code: 'NOT_FOUND', message: 'No such endpoint' } })

  if (!existsSync(`${server.config.root}/api/${name}.ts`))
    return send(res, 404, { error: { code: 'NOT_FOUND', message: 'No such endpoint' } })
  // A handler that fails to load or throws surfaces as a dev-server 500 via next(err).
  const mod = await server.ssrLoadModule(`/api/${name}.ts`)
  const handler = mod[req.method ?? 'GET']
  if (typeof handler !== 'function') {
    return send(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' },
    })
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && chunks.length > 0
  const request = new Request(`http://${req.headers.host ?? 'localhost'}/api${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  })

  const response = (await handler(request)) as Response
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Handlers read secrets from process.env, as on Vercel. '' prefix = load every key, not just VITE_*.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return { plugins: [react(), tailwindcss(), apiRoutes()] }
})
