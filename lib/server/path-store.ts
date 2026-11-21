import fs from "fs"
import path from "path"

// Persistent store of path configurations created through the dashboard.
//
// MediaMTX keeps paths added via its API in memory only, so they vanish when
// MediaMTX restarts. The dashboard is the source of truth instead: every
// successful add/patch/replace/delete that passes through the /api/mediamtx
// proxy is recorded here, and lib/server/path-sync.ts re-adds any stored path
// that MediaMTX is missing.
//
// Only the fields the user actually set are stored (not MediaMTX's resolved
// defaults), so stored paths stay valid across MediaMTX upgrades.

export interface StoredPathConfig {
  [field: string]: unknown
}

export interface PathStore {
  [name: string]: StoredPathConfig
}

const STORE_FILE = process.env.PATHS_CONFIG_FILE || "/data/paths-config.json"

export function storeExists(): boolean {
  return fs.existsSync(STORE_FILE)
}

export function readPathStore(): PathStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function writePathStore(store: PathStore): void {
  const dir = path.dirname(STORE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  // Write to a temp file and rename so a crash never leaves a half-written store.
  const tmp = `${STORE_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2))
  fs.renameSync(tmp, STORE_FILE)
}

function cleanConfig(conf: StoredPathConfig): StoredPathConfig {
  const out: StoredPathConfig = { ...conf }
  delete out.name // the name is the store key and goes in the API URL
  return out
}

export function storeSetPath(name: string, conf: StoredPathConfig): void {
  const store = readPathStore()
  store[name] = cleanConfig(conf)
  writePathStore(store)
}

export function storePatchPath(name: string, patch: StoredPathConfig): void {
  const store = readPathStore()
  store[name] = cleanConfig({ ...(store[name] || {}), ...patch })
  writePathStore(store)
}

export function storeDeletePath(name: string): void {
  const store = readPathStore()
  if (name in store) {
    delete store[name]
    writePathStore(store)
  }
}
