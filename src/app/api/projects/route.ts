import { NextResponse } from "next/server";
import { getProgramOverview } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getProgramOverview());
}
