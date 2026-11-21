import { NextResponse } from "next/server"

// Dashboard-only API routes (comments, path metadata) have no data in
// MediaMTX, so they check the caller's login against MediaMTX itself: the
// browser sends the same Basic auth header it uses for the MediaMTX API, and
// we accept it only if MediaMTX accepts it for an API call. Successful checks
// are cached briefly so a page load does not hit MediaMTX for every request.

const CACHE_MS = 60_000
const okUntil = new Map<string, number>()

function apiBaseUrl() {
  const configured = process.env.MEDIAMTX_API_URL || "http://localhost:9997"
  return configured.trim().replace(/\/+$/, "").replace(/\/v3\/config$/i, "").replace(/\/v3$/i, "")
}

async function isValid(authorization: string): Promise<boolean> {
  const now = Date.now()
  const until = okUntil.get(authorization)
  if (until && until > now) return true
  try {
    const res = await fetch(`${apiBaseUrl()}/v3/paths/list?itemsPerPage=1`, {
      headers: { authorization },
      cache: "no-store",
    })
    if (res.ok) {
      if (okUntil.size > 1000) okUntil.clear()
      okUntil.set(authorization, now + CACHE_MS)
      return true
    }
  } catch {
    // MediaMTX unreachable: fail closed.
  }
  return false
}

// requireApiAuth returns a 401 response when the request is not signed in
// with MediaMTX API rights, or null when the handler may proceed.
export async function requireApiAuth(request: Request): Promise<NextResponse | null> {
  const authorization = request.headers.get("authorization") || ""
  if (!authorization.startsWith("Basic ") || !(await isValid(authorization))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return null
}
