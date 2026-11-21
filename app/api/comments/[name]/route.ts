import { NextRequest, NextResponse } from "next/server"
import { writeComment, removeComment } from "@/lib/server/comment-store"
import { requireApiAuth } from "@/lib/server/require-api-auth"

const MAX_COMMENT_LENGTH = 2000

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const denied = await requireApiAuth(request)
  if (denied) return denied
  const { name } = await params
  let body: { comment?: string } = {}
  try {
    body = await request.json()
  } catch {}
  const comment = String(body.comment || "").slice(0, MAX_COMMENT_LENGTH)
  const comments = writeComment(name, comment)
  return NextResponse.json({ comments })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const denied = await requireApiAuth(request)
  if (denied) return denied
  const { name } = await params
  const comments = removeComment(name)
  return NextResponse.json({ comments })
}
