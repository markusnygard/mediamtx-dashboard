const DEFAULT_GRAFANA_URL = "http://grafana:3000"

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

function normalizeGrafanaUrl() {
  const configuredUrl = process.env.GRAFANA_URL || DEFAULT_GRAFANA_URL
  return configuredUrl.trim().replace(/\/+$/, "")
}

async function proxyGrafanaRequest(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  const upstream = new URL(path.map(encodeURIComponent).join("/"), `${normalizeGrafanaUrl()}/`)
  const incomingUrl = new URL(request.url)
  upstream.search = incomingUrl.search

  const method = request.method.toUpperCase()
  const headers = new Headers()
  for (const h of ["accept", "content-type", "cookie", "authorization"]) {
    const v = request.headers.get(h)
    if (v) headers.set(h, v)
  }

  const response = await fetch(upstream, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  })

  const responseHeaders = new Headers(response.headers)
  for (const h of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(h)
  }
  // Next.js fetch already decompresses the body; a stale content-encoding
  // header would make the browser try to gunzip plain data.
  responseHeaders.delete("content-encoding")
  responseHeaders.delete("content-length")
  // Let the proxy set cookies for Grafana sessions.
  responseHeaders.delete("x-frame-options")
  responseHeaders.delete("content-security-policy")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const GET = proxyGrafanaRequest
export const POST = proxyGrafanaRequest
export const PUT = proxyGrafanaRequest
export const PATCH = proxyGrafanaRequest
export const DELETE = proxyGrafanaRequest
