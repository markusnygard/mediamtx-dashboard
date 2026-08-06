import fs from "fs"
import path from "path"

export interface PathMeta {
  [name: string]: string // path name -> ISO creation time
}

const META_FILE = process.env.PATHS_META_FILE || "/data/paths-meta.json"

function ensureFile(): string {
  const dir = path.dirname(META_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(META_FILE)) {
    fs.writeFileSync(META_FILE, "{}")
  }
  return META_FILE
}

export function readPathMeta(): PathMeta {
  try {
    ensureFile()
    const raw = fs.readFileSync(META_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

// rememberCreatedAt records the creation time for a path only if it isn't
// already known (so it keeps the original creation time on re-adds).
export function rememberCreatedAt(name: string): PathMeta {
  const meta = readPathMeta()
  if (!meta[name]) {
    meta[name] = new Date().toISOString()
    ensureFile()
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2))
  }
  return meta
}
