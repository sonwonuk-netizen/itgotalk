import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { formatDateTime } from "@/components/ui";
import { CreateOrgForm } from "./CreateOrgForm";

export default async function OrgsPage() {
  const user = await requireRole("admin");
  const orgs = await asUser(user.id, async (tx) =>
    (await tx.query<{ id: string; name: string; kind: string; invite_code: string; created_at: Date; students: number; teachers: number }>(
      `select o.id, o.name, o.kind, o.invite_code, o.created_at,
              count(p.id) filter (where p.role = 'student') as students,
              count(p.id) filter (where p.role in ('teacher','org_admin')) as teachers
       from organizations o left join profiles p on p.organization_id = o.id
       group by o.id order by o.created_at`,
    )).rows,
  );
  return (
    <>
      <PageTitle>기관 관리</PageTitle>
      <CreateOrgForm />
      <Table head={["기관", "종류", "초대 코드", "학생", "교사", "생성일"]}>
        {orgs.map((o) => (
          <tr key={o.id}>
            <td className={`${td} font-semibold`}>{o.name}</td>
            <td className={td}>{o.kind === "academy" ? "학원" : "공부방"}</td>
            <td className={`${td} font-mono`}>{o.invite_code}</td>
            <td className={td}>{o.students}</td>
            <td className={td}>{o.teachers}</td>
            <td className={td}>{formatDateTime(o.created_at)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
