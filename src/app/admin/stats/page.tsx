import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { loadSiteStats, type DayStat } from "@/lib/server/stats";
import { PageTitle, Table, td } from "@/components/StaffShell";

const RANGES = [7, 30, 90] as const;
const nf = new Intl.NumberFormat("ko-KR");
const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
// Noon UTC of that calendar date always falls on the same weekday.
const weekday = (day: string) => "일월화수목금토"[new Date(`${day}T12:00:00Z`).getUTCDay()];

/** 방문 통계: daily visitors and page views (Korea time), collected by /api/track. */
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireRole("admin");
  const asked = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const { daily, topPages } = await loadSiteStats(days);

  const today = daily[daily.length - 1]!;
  const yesterday = daily[daily.length - 2];
  const totalViews = daily.reduce((s, d) => s + d.views, 0);
  const avgVisitors = daily.reduce((s, d) => s + d.visitors, 0) / daily.length;

  return (
    <>
      <PageTitle>방문 통계</PageTitle>

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="기간">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/stats?days=${r}`}
            aria-current={r === days ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${r === days ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"}`}
          >
            최근 {r}일
          </Link>
        ))}
        <span className="ml-auto text-xs text-gray-500">한국 시간 기준 · 관리자 화면 접속은 제외 · 브라우저 방문만 집계</span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Tile label="오늘 방문자" value={today.visitors} sub={yesterday ? `어제 ${nf.format(yesterday.visitors)}` : undefined} />
        <Tile label="오늘 페이지뷰" value={today.views} sub={yesterday ? `어제 ${nf.format(yesterday.views)}` : undefined} />
        <Tile label={`일 평균 방문자 (${days}일)`} value={Math.round(avgVisitors * 10) / 10} />
        <Tile label={`페이지뷰 합계 (${days}일)`} value={totalViews} />
      </div>

      {/* Two measures of different scale → two charts, never one dual-axis chart. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <BarChart title="일별 방문자 수" unit="명" data={daily} pick={(d) => d.visitors} />
        <BarChart title="일별 페이지뷰" unit="회" data={daily} pick={(d) => d.views} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <section>
          <h2 className="mb-2 font-bold">많이 본 페이지 <span className="text-sm font-normal text-gray-500">(최근 {days}일)</span></h2>
          <Table head={["페이지", "페이지뷰"]}>
            {topPages.map((p) => (
              <tr key={p.path}>
                <td className={`${td} break-all font-mono text-xs`}>{p.path}</td>
                <td className={`${td} text-right tabular-nums`}>{nf.format(p.views)}</td>
              </tr>
            ))}
            {topPages.length === 0 && <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-500">아직 기록이 없습니다.</td></tr>}
          </Table>
        </section>
        <section>
          <h2 className="mb-2 font-bold">날짜별</h2>
          <Table head={["날짜", "방문자", "페이지뷰", "방문자당 페이지뷰"]}>
            {[...daily].reverse().map((d) => (
              <tr key={d.day}>
                <td className={`${td} whitespace-nowrap`}>{d.day} ({weekday(d.day)})</td>
                <td className={`${td} text-right tabular-nums`}>{nf.format(d.visitors)}</td>
                <td className={`${td} text-right tabular-nums`}>{nf.format(d.views)}</td>
                <td className={`${td} text-right tabular-nums text-gray-600`}>{d.visitors ? (d.views / d.visitors).toFixed(1) : "-"}</td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{nf.format(value)}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

/** One series per chart: thin bars from a shared baseline, hover shows the exact value. */
function BarChart({ title, unit, data, pick }: { title: string; unit: string; data: DayStat[]; pick: (d: DayStat) => number }) {
  const values = data.map(pick);
  const max = Math.max(1, ...values);
  const ticks = [max, Math.round(max / 2)].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const labelEvery = data.length <= 7 ? 1 : data.length <= 30 ? 5 : 15;
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100" aria-label={title}>
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="relative h-48 pl-8">
        {/* recessive grid + y labels */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-gray-200" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -top-2 left-0 w-7 text-right text-[10px] tabular-nums text-gray-500">{nf.format(t)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 ml-8 border-t border-gray-300" />
        <div className="relative flex h-full items-end gap-[2px]">
          {data.map((d) => {
            const v = pick(d);
            return (
              <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
                <div
                  className="w-full max-w-4 rounded-t-[4px] bg-blue-600 group-hover:bg-blue-800 group-focus:bg-blue-800"
                  style={{ height: v ? `${Math.max(2, (v / max) * 100)}%` : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow group-hover:block group-focus:block">
                  {d.day} ({weekday(d.day)}) · {nf.format(v)}{unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-[2px] pl-8 text-[10px] text-gray-500">
        {data.map((d, i) => (
          <div key={d.day} className="flex flex-1 justify-center overflow-visible whitespace-nowrap tabular-nums">
            {(data.length - 1 - i) % labelEvery === 0 ? shortDay(d.day) : ""}
          </div>
        ))}
      </div>
    </section>
  );
}
