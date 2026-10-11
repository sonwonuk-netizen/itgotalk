import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { asService } from "@/lib/db/client";
import { kstDay } from "@/lib/server/stats";

const COOKIE = "itgo_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Page view beacon from <PageViewTracker /> (browsers only, so most crawlers are not counted).
 * Records one view of the path and the visitor for today (Korea time).
 */
export async function POST(req: Request) {
  let path = "";
  try {
    path = String(((await req.json()) as { path?: unknown }).path ?? "");
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!path.startsWith("/") || path.length > 200 || /^\/(admin|api)(\/|$)/.test(path)) return new Response(null, { status: 204 });
  // One row per page, not per record: /notice/<uuid> → /notice/:id
  path = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");

  const jar = await cookies();
  let vid = jar.get(COOKIE)?.value ?? "";
  if (!/^[0-9a-f-]{36}$/.test(vid)) {
    vid = randomUUID();
    jar.set(COOKIE, vid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_YEAR });
  }
  const day = kstDay(new Date());
  // Salted with the day: the same browser gets a different key every day.
  const visitorKey = createHash("sha256").update(`${vid}:${day}`).digest("hex").slice(0, 32);

  await asService(async (tx) => {
    await tx.query("insert into site_visitors_daily (day, visitor_key) values ($1, $2) on conflict do nothing", [day, visitorKey]);
    await tx.query(
      "insert into site_page_views_daily (day, path, views) values ($1, $2, 1) on conflict (day, path) do update set views = views + 1",
      [day, path],
    );
  });
  return new Response(null, { status: 204 });
}
