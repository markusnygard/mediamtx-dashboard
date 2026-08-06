import { NextRequest, NextResponse } from "next/server"
import { writeComment, removeComment } from "@/lib/server/comment-store"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  let body: { comment?: string } = {}
  try {
    body = await request.json()
  } catch {}
  const comments = writeComment(name, body.comment || "")
  return NextResponse.json({ comments })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const comments = removeComment(name)
  return NextResponse.json({ comments })
}
