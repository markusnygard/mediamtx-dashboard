import { NextRequest, NextResponse } from "next/server"
import { rememberCreatedAt } from "@/lib/server/path-meta"

export async function PUT(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const meta = rememberCreatedAt(name)
  return NextResponse.json({ meta })
}
