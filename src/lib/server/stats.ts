import "server-only";
import { asService } from "@/lib/db/client";

const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
/** 'YYYY-MM-DD' in Korea time. */
export const kstDay = (d: Date) => kst.format(d);

export interface DayStat {
  day: string;
  visitors: number;
  views: number;
}

/**
 * Daily visitors and page views for the last `days` days (today included, oldest first; days with
 * no traffic are 0). Read with the service role — callers must be 본사 관리자.
 */
export async function loadSiteStats(days: number, now = new Date()) {
  const list = Array.from({ length: days }, (_, i) => kstDay(new Date(now.getTime() - (days - 1 - i) * 86_400_000)));
  const from = list[0]!;
  const to = list[list.length - 1]!;
  return asService(async (tx) => {
    const visitors = new Map(
      (await tx.query<{ day: string; n: number }>(
        "select day, count(*) as n from site_visitors_daily where day between $1 and $2 group by day",
        [from, to],
      )).rows.map((r) => [r.day, r.n]),
    );
    const views = new Map(
      (await tx.query<{ day: string; n: number }>(
        "select day, sum(views) as n from site_page_views_daily where day between $1 and $2 group by day",
        [from, to],
      )).rows.map((r) => [r.day, r.n]),
    );
    const topPages = (await tx.query<{ path: string; views: number }>(
      "select path, sum(views) as views from site_page_views_daily where day between $1 and $2 group by path order by views desc limit 15",
      [from, to],
    )).rows;
    const daily: DayStat[] = list.map((day) => ({ day, visitors: visitors.get(day) ?? 0, views: views.get(day) ?? 0 }));
    return { daily, topPages, from, to };
  });
}
