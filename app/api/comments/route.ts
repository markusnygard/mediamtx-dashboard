import { NextRequest, NextResponse } from "next/server"
import { readComments } from "@/lib/server/comment-store"

export async function GET() {
  const comments = readComments()
  return NextResponse.json({ comments })
}
