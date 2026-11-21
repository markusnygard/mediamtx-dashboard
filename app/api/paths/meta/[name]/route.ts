import { NextRequest, NextResponse } from "next/server"
import { rememberCreatedAt } from "@/lib/server/path-meta"
import { requireApiAuth } from "@/lib/server/require-api-auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const denied = await requireApiAuth(request)
  if (denied) return denied
  const { name } = await params
  const meta = rememberCreatedAt(name)
  return NextResponse.json({ meta })
}
