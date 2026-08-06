import { getAuthHeader } from "./auth"
import { buildMediaMtxApiUrl } from "./mediamtx-url.mjs"

// Public host used to build SRT/RTMP/RTSP connection URLs in the Add Path dialog.
const MEDIAMTX_HOST = process.env.NEXT_PUBLIC_MEDIAMTX_HOST || ""

export interface GeneratedUrl {
  label: string
  url: string
}

// buildConnectionUrls builds the publish and read URLs for a path based on the
// protocol in the source box ("srt", "rtmp", "rtsp"). Returns empty if the
// host or protocol is unknown.
export function buildConnectionUrls(pathName: string, source: string): GeneratedUrl[] {
  if (!MEDIAMTX_HOST) return []
  const name = pathName.trim()
  if (!name) return []
  const proto = source.trim().toLowerCase()

  switch (proto) {
    case "srt":
      return [
        { label: "SRT publish", url: `srt://${MEDIAMTX_HOST}:8890?mode=caller&streamid=publish:${name}` },
        { label: "SRT read", url: `srt://${MEDIAMTX_HOST}:8890?mode=caller&streamid=read:${name}` },
      ]
    case "rtmp":
      return [
        { label: "RTMP publish", url: `rtmp://${MEDIAMTX_HOST}:1935/${name}` },
        { label: "RTMP read", url: `rtmp://${MEDIAMTX_HOST}:1935/${name}` },
      ]
    case "rtsp":
      return [
        { label: "RTSP publish", url: `rtsp://${MEDIAMTX_HOST}:8554/${name}` },
        { label: "RTSP read", url: `rtsp://${MEDIAMTX_HOST}:8554/${name}` },
      ]
    default:
      return []
  }
}

export interface PathConfig {
  name: string
  source: string
  comment?: string
  sourceFingerprint?: string
  sourceOnDemand?: boolean
  sourceOnDemandStartTimeout?: string
  sourceOnDemandCloseAfter?: string
  maxReaders?: number
  record?: boolean
  recordPath?: string
  recordFormat?: string
  recordPartDuration?: string
  recordSegmentDuration?: string
  recordDeleteAfter?: string
  overridePublisher?: boolean
}

export interface PathSource {
  type: string
  id: string
}

export interface PathReader {
  type: string
  id: string
}

export interface Path {
  name: string
  confName: string
  source: PathSource | null
  ready: boolean
  readyTime: string | null
  tracks: string[]
  bytesReceived: number
  bytesSent: number
  readers: PathReader[]
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const authHeader = getAuthHeader()

  const response = await fetch(buildMediaMtxApiUrl(endpoint), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...options.headers,
    },
  })

  const contentType = response.headers.get("content-type") || ""

  if (!response.ok) {
    let errorText = ""
    try {
      errorText = await response.text()
    } catch {}
    throw new Error(errorText || `API request failed: ${response.status} ${response.statusText}`)
  }

  if (response.status === 204) return null

  // Some MediaMTX endpoints return an empty body on success; avoid JSON parse errors
  const text = await response.text()
  if (!text) return null

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text)
    } catch (e) {
      throw new Error("Invalid JSON in response")
    }
  }

  return text
}

export async function getPathConfigs(): Promise<PathConfig[]> {
  const data = await fetchAPI("/v3/config/paths/list")
  return data.items || []
}

export async function getPaths(): Promise<Path[]> {
  const data = await fetchAPI("/v3/paths/list")
  return data.items || []
}

export async function addPath(config: PathConfig): Promise<void> {
  // Only send the fields that MediaMTX expects
  const payload: any = {
    name: config.name,
  }

  // Only add source if it's set; an empty source means "publisher" and
  // MediaMTX rejects an explicit empty string with "invalid source".
  if (config.source) {
    payload.source = config.source
  }

  // Only add optional fields if they have non-default values
  if (config.sourceFingerprint) {
    payload.sourceFingerprint = config.sourceFingerprint
  }

  if (config.sourceOnDemand !== undefined) {
    payload.sourceOnDemand = config.sourceOnDemand
  }

  if (config.sourceOnDemandStartTimeout) {
    payload.sourceOnDemandStartTimeout = config.sourceOnDemandStartTimeout
  }

  if (config.sourceOnDemandCloseAfter) {
    payload.sourceOnDemandCloseAfter = config.sourceOnDemandCloseAfter
  }

  if (config.maxReaders !== undefined && config.maxReaders !== 0) {
    payload.maxReaders = config.maxReaders
  }

  if (config.record !== undefined) {
    payload.record = config.record
  }

  if (config.record && config.recordPath) {
    payload.recordPath = config.recordPath
  }

  if (config.record && config.recordFormat) {
    payload.recordFormat = config.recordFormat
  }

  if (config.record && config.recordPartDuration) {
    payload.recordPartDuration = config.recordPartDuration
  }

  if (config.record && config.recordSegmentDuration) {
    payload.recordSegmentDuration = config.recordSegmentDuration
  }

  if (config.record && config.recordDeleteAfter) {
    payload.recordDeleteAfter = config.recordDeleteAfter
  }

  if (config.overridePublisher !== undefined) {
    payload.overridePublisher = config.overridePublisher
  }

  await fetchAPI(`/v3/config/paths/add/${encodeURIComponent(config.name)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updatePath(name: string, config: Partial<PathConfig>): Promise<void> {
  await fetchAPI(`/v3/config/paths/patch/${encodeURIComponent(name)}`, {
    method: "PATCH",
    body: JSON.stringify(config),
  })
}

export async function deletePath(name: string): Promise<void> {
  await fetchAPI(`/v3/config/paths/delete/${encodeURIComponent(name)}`, {
    method: "DELETE",
  })
}

// Comments are stored by the dashboard itself (MediaMTX has no comment field).
export interface CommentMap {
  [name: string]: string
}

export async function getComments(): Promise<CommentMap> {
  const res = await fetch(`/api/comments`, { cache: "no-store" })
  if (!res.ok) return {}
  const data = await res.json().catch(() => ({}))
  return data.comments || {}
}

export async function saveComment(name: string, comment: string): Promise<void> {
  await fetch(`/api/comments/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  })
}

export async function deleteComment(name: string): Promise<void> {
  await fetch(`/api/comments/${encodeURIComponent(name)}`, { method: "DELETE" })
}

