import { getAuthHeader } from "./auth"
import { buildMediaMtxApiUrl } from "./mediamtx-url.mjs"

// Public host used to build connection URLs shown in the path URL popup.
const MEDIAMTX_HOST = process.env.NEXT_PUBLIC_MEDIAMTX_HOST || ""
const MEDIAMTX_SRT_PORT = process.env.NEXT_PUBLIC_MEDIAMTX_SRT_PORT || "8890"
const MEDIAMTX_RTMP_PORT = process.env.NEXT_PUBLIC_MEDIAMTX_RTMP_PORT || "1935"
const MEDIAMTX_RTSP_PORT = process.env.NEXT_PUBLIC_MEDIAMTX_RTSP_PORT || "8554"
const MEDIAMTX_HLS_PORT = process.env.NEXT_PUBLIC_MEDIAMTX_HLS_PORT || "8888"
// Media-over-QUIC: browser page + WebTransport on moqHTTP2/HTTP3 port (TCP+UDP),
// native MoQ-over-QUIC clients on moqQUICAddress (UDP).
const MEDIAMTX_MOQ_PORT = process.env.NEXT_PUBLIC_MEDIAMTX_MOQ_PORT || "8892"
const MEDIAMTX_MOQ_QUIC_PORT = process.env.NEXT_PUBLIC_MEDIAMTX_MOQ_QUIC_PORT || "8893"
// Optional public base URLs when HLS / WebRTC sit behind a TLS reverse proxy,
// e.g. https://hls.example.com and https://webrtc.example.com. When set they
// replace the plain http://host:port links.
const MEDIAMTX_HLS_PUBLIC_URL = (process.env.NEXT_PUBLIC_MEDIAMTX_HLS_PUBLIC_URL || "").replace(/\/+$/, "")
const MEDIAMTX_WEBRTC_PUBLIC_URL = (process.env.NEXT_PUBLIC_MEDIAMTX_WEBRTC_PUBLIC_URL || "").replace(/\/+$/, "")
// Set NEXT_PUBLIC_MEDIAMTX_RTSP_PORT=off to hide RTSP links when RTSP is not exposed.
const RTSP_ENABLED = MEDIAMTX_RTSP_PORT !== "off"

export interface GeneratedUrl {
  label: string
  url: string
  // Which group this URL belongs to in the popup: "source" (publish) or "destination" (read).
  group: "source" | "destination"
}

// buildPathUrls builds all shareable source/destination URLs for a path.
// Returns an empty array if no public host is configured.
export function buildPathUrls(pathName: string): GeneratedUrl[] {
  if (!MEDIAMTX_HOST) return []
  const name = pathName.trim()
  if (!name) return []
  const host = MEDIAMTX_HOST
  const hlsBase = MEDIAMTX_HLS_PUBLIC_URL || `http://${host}:${MEDIAMTX_HLS_PORT}`

  const urls: (GeneratedUrl | false)[] = [
    // Source (publish) URLs.
    { label: "SRT source", url: `srt://${host}:${MEDIAMTX_SRT_PORT}?mode=caller&streamid=publish:${name}`, group: "source" },
    { label: "RTMP source", url: `rtmp://${host}:${MEDIAMTX_RTMP_PORT}/${name}`, group: "source" },
    RTSP_ENABLED && { label: "RTSP source", url: `rtsp://${host}:${MEDIAMTX_RTSP_PORT}/${name}`, group: "source" },
    !!MEDIAMTX_WEBRTC_PUBLIC_URL && { label: "WebRTC source (browser)", url: `${MEDIAMTX_WEBRTC_PUBLIC_URL}/${name}/publish`, group: "source" },
    !!MEDIAMTX_WEBRTC_PUBLIC_URL && { label: "WHIP source (OBS)", url: `${MEDIAMTX_WEBRTC_PUBLIC_URL}/${name}/whip`, group: "source" },
    { label: "MoQ source (browser, Chrome)", url: `https://${host}:${MEDIAMTX_MOQ_PORT}/${name}/publish`, group: "source" },
    { label: "MoQ source (native QUIC)", url: `moqt://${host}:${MEDIAMTX_MOQ_QUIC_PORT}/${name}`, group: "source" },
    // Destination (read) URLs.
    { label: "SRT destination", url: `srt://${host}:${MEDIAMTX_SRT_PORT}?mode=caller&streamid=read:${name}`, group: "destination" },
    RTSP_ENABLED && { label: "RTSP destination", url: `rtsp://${host}:${MEDIAMTX_RTSP_PORT}/${name}`, group: "destination" },
    { label: "HLS destination", url: `${hlsBase}/${name}/index.m3u8`, group: "destination" },
    !!MEDIAMTX_WEBRTC_PUBLIC_URL && { label: "WebRTC destination (browser)", url: `${MEDIAMTX_WEBRTC_PUBLIC_URL}/${name}`, group: "destination" },
    !!MEDIAMTX_WEBRTC_PUBLIC_URL && { label: "WHEP destination", url: `${MEDIAMTX_WEBRTC_PUBLIC_URL}/${name}/whep`, group: "destination" },
    { label: "MoQ destination (browser)", url: `https://${host}:${MEDIAMTX_MOQ_PORT}/${name}`, group: "destination" },
    { label: "MoQ destination (native QUIC)", url: `moqt://${host}:${MEDIAMTX_MOQ_QUIC_PORT}/${name}`, group: "destination" },
  ]
  return urls.filter((u): u is GeneratedUrl => Boolean(u))
}

export interface PathConfig {
  name: string
  source: string
  comment?: string
  createdAt?: string
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

// Path metadata (creation times) stored by the dashboard.
export interface PathMetaMap {
  [name: string]: string
}

export async function getPathMeta(): Promise<PathMetaMap> {
  const res = await fetch(`/api/paths/meta`, { cache: "no-store" })
  if (!res.ok) return {}
  const data = await res.json().catch(() => ({}))
  return data.meta || {}
}

export async function rememberPathCreated(name: string): Promise<void> {
  await fetch(`/api/paths/meta/${encodeURIComponent(name)}`, { method: "PUT" })
}

