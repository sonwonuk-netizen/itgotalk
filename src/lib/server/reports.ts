import "server-only";
import { randomBytes } from "node:crypto";
import { asService } from "@/lib/db/client";
import { buildReportLines, type AttemptMode } from "@/lib/engine";
import { getReportSender, type ReportSender } from "./report-sender";

/** PRD Q2 default: a report every 14 days; links expire after 30 days. */
export const REPORT_PERIOD_DAYS = 14;
export const REPORT_LINK_DAYS = 30;

export interface GenerateOptions {
  /** Limit to these students (default: every student with an opted-in guardian). */
  studentIds?: string[];
  periodEnd?: Date;
  baseUrl: string;
  sender?: ReportSender;
}

function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

/** Builds report lines from Attempts (rule 4), stores the report, and sends the link. */
export async function generateReports({ studentIds, periodEnd = new Date(), baseUrl, sender = getReportSender() }: GenerateOptions) {
  const periodStart = new Date(periodEnd.getTime() - REPORT_PERIOD_DAYS * 86_400_000);
  const created = await asService(async (tx) => {
    const { rows: skillRows } = await tx.query<{ id: string; name: string; ord: number }>("select id, name, ord from skills");
    const skills = Object.fromEntries(skillRows.map((s) => [s.id, { name: s.name, ord: s.ord }]));
    const { rows: students } = await tx.query<{ id: string; initial: string; org: string | null; phone: string }>(
      `select p.id, p.display_initial as initial, o.name as org, g.phone
       from profiles p join guardians g on g.student_id = p.id and g.report_opt_in
       left join organizations o on o.id = p.organization_id
       where p.role = 'student' and ($1::uuid[] is null or p.id = any($1::uuid[]))`,
      [studentIds ?? null],
    );
    const out = [];
    for (const s of students) {
      const { rows: attempts } = await tx.query<{ skill_id: string; mode: AttemptMode; created_at: Date; item_count: number; elapsed_ms: number; passed: boolean | null }>(
        `select i.skill_id, a.mode, a.created_at, a.item_count, a.elapsed_ms, a.passed
         from attempts a join item_sets i on i.id = a.set_id
         where a.student_id = $1 and a.created_at > $2 and a.created_at <= $3`,
        [s.id, periodStart, periodEnd],
      );
      const lines = buildReportLines(
        skills,
        attempts.map((a) => ({ skillId: a.skill_id, mode: a.mode, createdAt: new Date(a.created_at), itemCount: a.item_count, elapsedMs: a.elapsed_ms, passed: a.passed })),
      );
      if (lines.length === 0) lines.push("이번 기간에는 테스트 기록이 없어요.");
      const token = randomBytes(24).toString("base64url");
      const { rows } = await tx.query<{ id: string }>(
        `insert into reports (student_id, period_start, period_end, lines, share_token, expires_at)
         values ($1,$2,$3,$4,$5, now() + make_interval(days => $6)) returning id`,
        [s.id, isoDate(periodStart), isoDate(periodEnd), JSON.stringify(lines), token, REPORT_LINK_DAYS],
      );
      out.push({ reportId: rows[0]!.id, token, student: s });
    }
    return out;
  });

  // Send outside the transaction; log each delivery.
  for (const r of created) {
    const url = `${baseUrl}/r/${r.token}`;
    const result = await sender.send({ phone: r.student.phone, studentInitial: r.student.initial, organizationName: r.student.org ?? "", url });
    await asService(async (tx) => {
      await tx.query(
        "insert into report_deliveries (report_id, channel, recipient, status, detail) values ($1,$2,$3,$4,$5)",
        [r.reportId, sender.channel, r.student.phone, result.ok ? "sent" : "failed", result.ok ? url : result.error],
      );
      if (result.ok) await tx.query("update reports set sent_at = now() where id = $1", [r.reportId]);
    });
  }
  return created.map((r) => ({ reportId: r.reportId, url: `${baseUrl}/r/${r.token}` }));
}
