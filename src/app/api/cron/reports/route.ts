import { NextResponse } from "next/server";
import { generateReports } from "@/lib/server/reports";
import { baseUrl } from "@/lib/server/url";

/** Called by a scheduler every 14 days (PRD ST-30). Protected by CRON_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const created = await generateReports({ baseUrl: await baseUrl() });
  return NextResponse.json({ created: created.length });
}
