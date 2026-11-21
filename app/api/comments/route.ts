import { NextRequest, NextResponse } from "next/server"
import { readComments } from "@/lib/server/comment-store"
import { requireApiAuth } from "@/lib/server/require-api-auth"

export async function GET(request: NextRequest) {
  const denied = await requireApiAuth(request)
  if (denied) return denied
  const comments = readComments()
  return NextResponse.json({ comments })
}
