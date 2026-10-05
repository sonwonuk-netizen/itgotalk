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
       where p.role = 'student' and ($1 is null or p.id in (select value from json_each($1)))`,
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
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [s.id, isoDate(periodStart), isoDate(periodEnd), JSON.stringify(lines), token, new Date(Date.now() + REPORT_LINK_DAYS * 86_400_000)],
      );
      out.push({ reportId: rows[0]!.id, token, student: s });
    }
    return out;
  });

  // Send after the reports are stored; log each delivery.
  for (const r of created) {
    const url = `${baseUrl}/r/${r.token}`;
    const result = await sender.send({ phone: r.student.phone, studentInitial: r.student.initial, organizationName: r.student.org ?? "", url });
    await asService(async (tx) => {
      await tx.query(
        "insert into report_deliveries (report_id, channel, recipient, status, detail) values ($1,$2,$3,$4,$5)",
        [r.reportId, sender.channel, r.student.phone, result.ok ? "sent" : "failed", result.ok ? url : result.error],
      );
      if (result.ok) await tx.query("update reports set sent_at = $2 where id = $1", [r.reportId, new Date()]);
    });
  }
  return created.map((r) => ({ reportId: r.reportId, url: `${baseUrl}/r/${r.token}` }));
}

/**
 * Parent link: the only way to read a report without logging in (rule 4). Matches the token and
 * expiry explicitly and returns only what the parent page shows.
 */
export async function loadReportByToken(token: string) {
  return asService(async (tx) => {
    const now = new Date();
    const report = (await tx.query<{ student_initial: string; organization_name: string | null; period_start: string; period_end: string; lines: string[]; expires_at: Date }>(
      `select p.display_initial as student_initial, o.name as organization_name, r.period_start, r.period_end, r.lines, r.expires_at
       from reports r join profiles p on p.id = r.student_id left join organizations o on o.id = p.organization_id
       where r.share_token = $1 and r.expires_at > $2`,
      [token, now],
    )).rows[0];
    if (!report) return null;
    const comments = (await tx.query<{ body: string; author_name: string | null; created_at: Date }>(
      `select c.body, a.full_name as author_name, c.created_at
       from reports r join comments c on c.report_id = r.id join profiles a on a.id = c.author_id
       where r.share_token = $1 and r.expires_at > $2 order by c.created_at`,
      [token, now],
    )).rows;
    return { r: report, comments };
  });
}
