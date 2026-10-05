import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { markAlertReadAction } from "../actions";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, formatDateTime } from "@/components/ui";

export default async function AlertsPage() {
  const user = await requireStaff();
  const alerts = await asUser(user.id, async (tx) =>
    (await tx.query<{ id: string; student_id: string; initial: string; skill: string; created_at: Date; read_at: Date | null }>(
      `select t.id, t.student_id, p.display_initial as initial, k.name as skill, t.created_at, t.read_at
       from teacher_alerts t join profiles p on p.id = t.student_id join skills k on k.id = t.skill_id
       order by t.read_at nulls first, t.created_at desc limit 200`,
    )).rows,
  );
  return (
    <>
      <PageTitle>알림 <span className="text-base font-normal text-gray-500">테스트 3회 연속 미통과 학생 — 직전 단계 복습 세트가 자동 배정됐어요</span></PageTitle>
      <Table head={["일시", "학생", "단계", "상태", ""]}>
        {alerts.map((a) => (
          <tr key={a.id} className={a.read_at ? "text-gray-400" : ""}>
            <td className={td}>{formatDateTime(a.created_at)}</td>
            <td className={td}><Link href={`/t/students/${a.student_id}`} className="font-semibold text-brand-700 hover:underline">{a.initial}</Link></td>
            <td className={td}>{a.skill}</td>
            <td className={td}>{a.read_at ? "확인함" : <Badge tone="red">새 알림</Badge>}</td>
            <td className={td}>
              {!a.read_at && (
                <form action={markAlertReadAction}>
                  <input type="hidden" name="alertId" value={a.id} />
                  <SubmitButton size="sm" tone="secondary">확인</SubmitButton>
                </form>
              )}
            </td>
          </tr>
        ))}
        {alerts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">알림이 없어요.</td></tr>}
      </Table>
    </>
  );
}
