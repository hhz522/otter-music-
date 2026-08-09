import { app } from '../functions/app'

const API_PREFIXES = ['/music-api', '/auth', '/proxy', '/sync', '/update', '/podcast-api']

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (API_PREFIXES.some(p => url.pathname.startsWith(p))) {
      return app.fetch(request, env)
    }

    try {
      const asset = await env.ASSETS.fetch(request)
      return asset
    } catch {
      return env.ASSETS.fetch('/index.html')
    }
  },
}
