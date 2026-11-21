import { readPathStore, storeExists, writePathStore, type PathStore, type StoredPathConfig } from "./path-store"

// Background reconciler: makes sure every path stored by the dashboard exists
// in MediaMTX. Adding a path through the MediaMTX API is a hot reload that does
// not disturb other paths or their ongoing streams, so this is safe to run
// continuously. It mainly matters right after MediaMTX (re)starts, which wipes
// all API-added paths.
//
// Env:
//   MEDIAMTX_API_URL           upstream API (same as the proxy), e.g. http://mediamtx:9997
//   MEDIAMTX_SYNC_USER/PASS    MediaMTX user with the "api" permission
//   MEDIAMTX_SYNC_INTERVAL     seconds between checks (default 10, 0 disables)

// Names that are catch-alls / defaults rather than real streams.
const IGNORED_NAMES = new Set(["all", "all_others"])

function apiBase(): string {
  const configured =
    process.env.MEDIAMTX_API_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_SERVER_API_URL ||
    "http://localhost:9997"
  return configured.trim().replace(/\/+$/, "").replace(/\/v3\/config$/i, "").replace(/\/v3$/i, "")
}

function authHeaders(): Record<string, string> {
  const user = process.env.MEDIAMTX_SYNC_USER
  const pass = process.env.MEDIAMTX_SYNC_PASS || ""
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (user) headers.Authorization = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64")
  return headers
}

async function api(endpoint: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${apiBase()}${endpoint}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string>) },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method || "GET"} ${endpoint}: ${res.status} ${text.trim()}`)
  return text ? JSON.parse(text) : null
}

async function listConfiguredPaths(): Promise<any[]> {
  const items: any[] = []
  for (let page = 0; ; page++) {
    const data = await api(`/v3/config/paths/list?itemsPerPage=1000&page=${page}`)
    items.push(...(data?.items || []))
    if (!data || page + 1 >= (data.pageCount || 1)) break
  }
  return items
}

// Reduce a fully resolved MediaMTX path config to the fields that differ from
// the path defaults, i.e. what a user actually configured.
function diffFromDefaults(conf: StoredPathConfig, defaults: StoredPathConfig): StoredPathConfig {
  const out: StoredPathConfig = {}
  for (const [key, value] of Object.entries(conf)) {
    if (key === "name") continue
    if (JSON.stringify(value) !== JSON.stringify(defaults[key])) out[key] = value
  }
  return out
}

// First run on an install that has no store yet: adopt the paths MediaMTX
// currently has so nothing configured before this feature is lost.
async function seedStore(): Promise<void> {
  const [paths, defaults] = await Promise.all([listConfiguredPaths(), api("/v3/config/pathdefaults/get")])
  const store: PathStore = {}
  for (const p of paths) {
    if (!p?.name || IGNORED_NAMES.has(p.name) || p.name.startsWith("~")) continue
    store[p.name] = diffFromDefaults(p, defaults || {})
  }
  writePathStore(store)
  console.log(`[path-sync] created path store with ${Object.keys(store).length} existing path(s)`)
}

let running = false

export async function syncPathsOnce(): Promise<void> {
  if (running) return
  running = true
  try {
    if (!storeExists()) await seedStore()
    const store = readPathStore()
    const names = Object.keys(store)
    if (names.length === 0) return

    const existing = new Set((await listConfiguredPaths()).map((p) => p.name))
    for (const name of names) {
      if (existing.has(name)) continue
      try {
        await api(`/v3/config/paths/add/${encodeURIComponent(name)}`, {
          method: "POST",
          body: JSON.stringify(store[name]),
        })
        console.log(`[path-sync] restored path "${name}" in MediaMTX`)
      } catch (err) {
        console.error(`[path-sync] could not restore path "${name}": ${(err as Error).message}`)
      }
    }
  } catch (err) {
    // MediaMTX down or restarting: try again on the next tick.
    console.warn(`[path-sync] MediaMTX not reachable: ${(err as Error).message}`)
  } finally {
    running = false
  }
}

export function startPathSync(): void {
  const g = globalThis as any
  if (g.__pathSyncStarted) return
  g.__pathSyncStarted = true

  const seconds = Number(process.env.MEDIAMTX_SYNC_INTERVAL ?? "10")
  if (!Number.isFinite(seconds) || seconds <= 0) {
    console.log("[path-sync] disabled (MEDIAMTX_SYNC_INTERVAL=0)")
    return
  }
  console.log(`[path-sync] keeping MediaMTX paths in sync every ${seconds}s via ${apiBase()}`)
  void syncPathsOnce()
  setInterval(() => void syncPathsOnce(), seconds * 1000).unref?.()
}
