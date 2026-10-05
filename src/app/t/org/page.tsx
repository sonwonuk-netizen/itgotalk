import { requireStaff } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { reissueInviteAction, setTeacherApprovalAction } from "../actions";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, formatDateTime } from "@/components/ui";

export default async function OrgPage() {
  const user = await requireStaff({ orgAdmin: true });
  const { org, teachers } = await asUser(user.id, async (tx) => ({
    org: (await tx.query<{ name: string; invite_code: string; kind: string }>("select name, invite_code, kind from organizations where id = $1", [user.organizationId])).rows[0],
    teachers: (await tx.query<{ id: string; full_name: string | null; is_approved: boolean; created_at: Date }>(
      "select id, full_name, is_approved, created_at from profiles where role = 'teacher' and organization_id = $1 order by is_approved, created_at desc",
      [user.organizationId],
    )).rows,
  }));
  if (!org) return null;
  return (
    <>
      <PageTitle>기관 설정 · {org.name}</PageTitle>
      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <div className="text-sm text-gray-500">초대 코드 (학생·선생님 가입용)</div>
          <div className="font-mono text-3xl font-bold tracking-widest">{org.invite_code}</div>
        </div>
        <form action={reissueInviteAction}>
          <SubmitButton tone="secondary">초대 코드 재발급</SubmitButton>
        </form>
      </Card>
      <h2 className="mb-2 text-lg font-bold">선생님 승인</h2>
      <Table head={["이름", "가입일", "상태", ""]}>
        {teachers.map((t) => (
          <tr key={t.id}>
            <td className={td}>{t.full_name}</td>
            <td className={td}>{formatDateTime(t.created_at)}</td>
            <td className={td}>{t.is_approved ? <Badge tone="green">승인됨</Badge> : <Badge tone="amber">승인 대기</Badge>}</td>
            <td className={td}>
              <form action={setTeacherApprovalAction}>
                <input type="hidden" name="teacherId" value={t.id} />
                <input type="hidden" name="approve" value={t.is_approved ? "0" : "1"} />
                <SubmitButton size="sm" tone={t.is_approved ? "danger" : "primary"}>{t.is_approved ? "승인 취소" : "승인"}</SubmitButton>
              </form>
            </td>
          </tr>
        ))}
        {teachers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">선생님이 없어요.</td></tr>}
      </Table>
    </>
  );
}
