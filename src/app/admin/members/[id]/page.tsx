import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, type Role } from "@/lib/auth/session";
import { asService } from "@/lib/db/client";
import { PageTitle } from "@/components/StaffShell";
import { formatDateTime } from "@/components/ui";
import { DeleteMemberForm } from "./DeleteMemberForm";
import { EditMemberForm, type MemberData } from "./EditMemberForm";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("admin");
  const { id } = await params;
  // requireRole("admin") is the permission check; login ids are only readable with asService.
  const data = await asService(async (tx) => {
    const m = (await tx.query<{
      id: string; login_id: string; role: Role; full_name: string | null; display_initial: string; contact_email: string | null;
      contact_phone: string | null; guardian_phone: string | null; organization_id: string | null; school_id: string | null;
      grade: number | null; is_approved: boolean; created_at: Date;
    }>(
      `select p.id, substr(u.email, 1, instr(u.email, '@') - 1) as login_id, p.role, p.full_name, p.display_initial, p.contact_email,
              p.contact_phone, (select g.phone from guardians g where g.student_id = p.id order by g.consent_at limit 1) as guardian_phone,
              p.organization_id, p.school_id, p.grade, p.is_approved, p.created_at
       from profiles p join user_credentials u on u.id = p.id where p.id = $1`,
      [id],
    )).rows[0];
    if (!m) return null;
    const orgs = (await tx.query<{ id: string; name: string }>("select id, name from organizations order by name")).rows;
    const schools = (await tx.query<{ id: string; label: string }>(
      "select s.id, r.name || ' · ' || s.name as label from schools s join regions r on r.id = s.region_id order by r.name, s.name",
    )).rows;
    return { m, orgs, schools };
  });
  if (!data) notFound();
  const { m, orgs, schools } = data;

  const member: MemberData = {
    id: m.id,
    role: m.role,
    fullName: m.full_name ?? "",
    initial: m.display_initial,
    email: m.contact_email ?? "",
    phone: formatPhone((m.role === "student" ? m.guardian_phone : m.contact_phone) ?? ""),
    organizationId: m.organization_id ?? "",
    schoolId: m.school_id ?? "",
    grade: m.grade ? String(m.grade) : "",
    approved: m.is_approved,
  };

  return (
    <>
      <PageTitle actions={<Link href="/admin/members" className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">← 회원 목록</Link>}>
        회원 정보 수정 <span className="font-mono text-base font-normal text-gray-500">{m.login_id}</span>
      </PageTitle>
      <p className="mb-4 text-sm text-gray-500">가입일 {formatDateTime(m.created_at)} · 아이디와 역할은 바꿀 수 없습니다.</p>
      <EditMemberForm member={member} orgs={orgs} schools={schools} />
      <DeleteMemberForm id={m.id} loginId={m.login_id} isStudent={m.role === "student"} isSelf={m.id === admin.id} />
    </>
  );
}

function formatPhone(d: string): string {
  const m = /^(\d{3})(\d{3,4})(\d{4})$/.exec(d);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : d;
}
