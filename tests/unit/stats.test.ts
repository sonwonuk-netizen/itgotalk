import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { kstDay, loadSiteStats } from "@/lib/server/stats";

describe("방문 통계", () => {
  it("uses Korea time for the day boundary", () => {
    expect(kstDay(new Date("2026-10-07T14:59:00Z"))).toBe("2026-10-07"); // 23:59 KST
    expect(kstDay(new Date("2026-10-07T15:00:00Z"))).toBe("2026-10-08"); // 00:00 KST
  });

  it("returns every day in the range, zero-filled, oldest first", async () => {
    const db = await getDb();
    await db.query("insert into site_visitors_daily (day, visitor_key) values ('2026-10-06','a'), ('2026-10-06','b'), ('2026-10-08','a')");
    await db.query("insert into site_page_views_daily (day, path, views) values ('2026-10-06','/',5), ('2026-10-06','/notice',2), ('2026-10-08','/',1)");
    const { daily, topPages } = await loadSiteStats(3, new Date("2026-10-08T03:00:00Z"));
    expect(daily).toEqual([
      { day: "2026-10-06", visitors: 2, views: 7 },
      { day: "2026-10-07", visitors: 0, views: 0 },
      { day: "2026-10-08", visitors: 1, views: 1 },
    ]);
    expect(topPages[0]).toEqual({ path: "/", views: 6 });
  });
});
