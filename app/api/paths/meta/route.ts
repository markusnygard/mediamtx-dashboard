import { NextRequest, NextResponse } from "next/server"
import { readPathMeta } from "@/lib/server/path-meta"
import { requireApiAuth } from "@/lib/server/require-api-auth"

export async function GET(request: NextRequest) {
  const denied = await requireApiAuth(request)
  if (denied) return denied
  const meta = readPathMeta()
  return NextResponse.json({ meta })
}
