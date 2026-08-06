import fs from "fs"
import path from "path"

export interface CommentMap {
  [name: string]: string
}

const COMMENTS_FILE = process.env.COMMENTS_FILE || "/data/comments.json"

function ensureFile(): string {
  const dir = path.dirname(COMMENTS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(COMMENTS_FILE)) {
    fs.writeFileSync(COMMENTS_FILE, "{}")
  }
  return COMMENTS_FILE
}

export function readComments(): CommentMap {
  try {
    ensureFile()
    const raw = fs.readFileSync(COMMENTS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function writeComment(name: string, comment: string): CommentMap {
  const comments = readComments()
  if (comment.trim()) {
    comments[name] = comment.trim()
  } else {
    delete comments[name]
  }
  ensureFile()
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2))
  return comments
}

export function removeComment(name: string): CommentMap {
  const comments = readComments()
  delete comments[name]
  ensureFile()
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2))
  return comments
}
