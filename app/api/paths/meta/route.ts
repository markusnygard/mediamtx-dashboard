import { NextResponse } from "next/server"
import { readPathMeta } from "@/lib/server/path-meta"

export async function GET() {
  const meta = readPathMeta()
  return NextResponse.json({ meta })
}
