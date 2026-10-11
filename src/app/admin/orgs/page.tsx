import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { setOrgSchoolAction } from "../actions";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDateTime } from "@/components/ui";
import { CreateOrgForm } from "./CreateOrgForm";
import { DeleteOrgForm } from "./DeleteOrgForm";

export default async function OrgsPage({ searchParams }: { searchParams: Promise<{ deleted?: string; staff?: string; students?: string }> }) {
  const user = await requireRole("admin");
  const { deleted, staff, students } = await searchParams;
  const { orgs, regions, schools } = await asUser(user.id, async (tx) => ({
    orgs: (await tx.query<{ id: string; name: string; kind: string; invite_code: string; school_id: string | null; created_at: Date; students: number; teachers: number }>(
      `select o.id, o.name, o.kind, o.invite_code, o.school_id, o.created_at,
              count(p.id) filter (where p.role = 'student') as students,
              count(p.id) filter (where p.role in ('teacher','org_admin')) as teachers
       from organizations o left join profiles p on p.organization_id = o.id
       group by o.id order by o.created_at`,
    )).rows,
    regions: (await tx.query<{ id: string; name: string }>("select id, name from regions where is_active order by name")).rows,
    schools: (await tx.query<{ id: string; name: string; region_id: string; region: string }>(
      "select s.id, s.name, s.region_id, r.name as region from schools s join regions r on r.id = s.region_id where s.is_active order by r.name, s.name",
    )).rows,
  }));
  const unlinked = orgs.filter((o) => !o.school_id).length;
  return (
    <>
      <PageTitle>기관 관리</PageTitle>
      {deleted && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {deleted} 기관을 삭제했습니다. 원장·선생님 계정 {Number(staff) || 0}개를 지웠고, 학생 {Number(students) || 0}명은 소속 없음으로 남겼습니다.
        </p>
      )}
      <CreateOrgForm regions={regions} schools={schools} />
      {unlinked > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          학교가 지정되지 않은 기관이 {unlinked}곳 있습니다. 학교를 지정해야 학생이 가입할 때 그 기관으로 연결됩니다.
        </p>
      )}
      <Table head={["기관", "종류", "지역 · 학교 (학생 가입 연결)", "기관 코드 (선생님 가입)", "학생", "교사", "생성일", ""]}>
        {orgs.map((o) => (
          <tr key={o.id}>
            <td className={`${td} font-semibold`}>{o.name}</td>
            <td className={td}>{o.kind === "academy" ? "학원" : "공부방"}</td>
            <td className={td}>
              <form action={setOrgSchoolAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={o.id} />
                <select
                  name="schoolId"
                  aria-label={`${o.name} 학교`}
                  defaultValue={o.school_id ?? ""}
                  className={`min-h-10 max-w-64 rounded-lg border px-2 ${o.school_id ? "border-gray-300" : "border-amber-400 bg-amber-50"}`}
                >
                  <option value="">미지정</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.region} · {s.name}</option>)}
                </select>
                <SubmitButton size="sm" tone="secondary">저장</SubmitButton>
              </form>
            </td>
            <td className={`${td} font-mono`}>{o.invite_code}</td>
            <td className={td}>{o.students}</td>
            <td className={td}>{o.teachers}</td>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(o.created_at)}</td>
            <td className={td}><DeleteOrgForm id={o.id} name={o.name} students={o.students} staff={o.teachers} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
