import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { REPORT_LINK_DAYS, REPORT_PERIOD_DAYS } from "@/lib/server/reports";
import { generateAllReportsAction } from "../actions";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, formatDateTime } from "@/components/ui";

export default async function AdminReportsPage() {
  const user = await requireRole("admin");
  const rows = await asUser(user.id, async (tx) =>
    (await tx.query<{ id: string; created_at: Date; channel: string; recipient: string; status: string; initial: string; org: string | null; token: string; expires_at: Date }>(
      `select d.id, d.created_at, d.channel, d.recipient, d.status, p.display_initial as initial, o.name as org, r.share_token as token, r.expires_at
       from report_deliveries d join reports r on r.id = d.report_id join profiles p on p.id = r.student_id
       left join organizations o on o.id = p.organization_id order by d.created_at desc limit 200`,
    )).rows,
  );
  return (
    <>
      <PageTitle>학부모 리포트</PageTitle>
      <Card className="mb-4 flex flex-wrap items-center gap-4">
        <p className="flex-1 text-sm text-gray-600">
          {REPORT_PERIOD_DAYS}일마다 학생별 리포트를 만들고 학부모 번호로 링크를 보냅니다 (링크 {REPORT_LINK_DAYS}일 후 만료).
          지금은 발송을 서버 콘솔 로그로 대신합니다. 자동 실행: <code>POST /api/cron/reports</code> (헤더 <code>Authorization: Bearer $CRON_SECRET</code>).
        </p>
        <form action={generateAllReportsAction}><SubmitButton>지금 전체 생성·발송</SubmitButton></form>
      </Card>
      <Table head={["발송 시각", "기관", "학생", "채널", "수신", "상태", "링크"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td}>{formatDateTime(r.created_at)}</td>
            <td className={td}>{r.org}</td>
            <td className={td}>{r.initial}</td>
            <td className={td}>{r.channel}</td>
            <td className={td}>{r.recipient.replace(/(\d{3})\d+(\d{4})/, "$1-****-$2")}</td>
            <td className={td}>{r.status === "sent" ? <Badge tone="green">발송</Badge> : <Badge tone="red">실패</Badge>}</td>
            <td className={td}><Link href={`/r/${r.token}`} target="_blank" className="text-brand-600 hover:underline">열기</Link></td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">발송 기록이 없습니다.</td></tr>}
      </Table>
    </>
  );
}
