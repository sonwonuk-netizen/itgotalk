import Link from "next/link";
import { requireRole, type Role } from "@/lib/auth/session";
import { asService } from "@/lib/db/client";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { Badge, formatDateTime } from "@/components/ui";

const ROLE_LABEL: Record<Role, string> = { student: "학생", teacher: "선생님", org_admin: "원장", admin: "본사 관리자" };
const ROLE_TONE: Record<Role, "blue" | "green" | "amber" | "gray"> = { student: "blue", teacher: "green", org_admin: "amber", admin: "gray" };
const ROLES = Object.keys(ROLE_LABEL) as Role[];
const LIMIT = 500;

/** 01012345678 → 010-1234-5678 (stored digits only). */
function formatPhone(d: string): string {
  const m = /^(\d{3})(\d{3,4})(\d{4})$/.exec(d);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : d;
}

interface Member {
  id: string;
  login_id: string;
  role: Role;
  display_initial: string;
  full_name: string | null;
  contact_email: string | null;
  phone: string | null;
  grade: number | null;
  school: string | null;
  org: string | null;
  is_approved: boolean;
  created_at: Date;
  last_attempt_at: Date | null;
}

/** 회원 관리: every account with its login id, organization and status (본사 관리자 only). */
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ role?: string; org?: string; q?: string; deleted?: string }> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const role = ROLES.includes(sp.role as Role) ? (sp.role as Role) : "";
  const org = sp.org ?? "";
  const q = (sp.q ?? "").trim().slice(0, 30);
  // Phones are stored as digits; "010-1234" also finds them. Needs 4+ digits so a short query does not match everyone.
  const digits = q.replace(/[\s-]/g, "");
  const phoneDigits = /^\d{4,11}$/.test(digits) ? digits : "";

  // Login ids live in user_credentials, which scoped (asUser) reads never expose;
  // requireRole("admin") above is the permission check for this read.
  const { members, orgs, counts } = await asService(async (tx) => ({
    members: (await tx.query<Member>(
      `select p.id, substr(u.email, 1, instr(u.email, '@') - 1) as login_id, p.role, p.display_initial, p.full_name, p.contact_email, p.grade,
              case when p.role = 'student'
                then (select g.phone from guardians g where g.student_id = p.id order by g.consent_at limit 1)
                else p.contact_phone end as phone,
              s.name as school, o.name as org, p.is_approved, p.created_at,
              (select max(a.created_at) from attempts a where a.student_id = p.id) as last_attempt_at
       from profiles p join user_credentials u on u.id = p.id
       left join schools s on s.id = p.school_id
       left join organizations o on o.id = p.organization_id
       where ($1 = '' or p.role = $1)
         and ($2 = '' or p.organization_id = $2 or ($2 = 'none' and p.organization_id is null))
         and ($3 = '' or u.email like $3 || '%' or p.full_name like '%' || $3 || '%' or p.display_initial like '%' || $3 || '%'
              or p.contact_email like '%' || $3 || '%'
              or ($4 <> '' and (p.contact_phone like '%' || $4 || '%'
                   or exists (select 1 from guardians g where g.student_id = p.id and g.phone like '%' || $4 || '%'))))
       order by p.created_at desc limit ${LIMIT}`,
      [role, org, q, phoneDigits],
    )).rows,
    orgs: (await tx.query<{ id: string; name: string }>("select id, name from organizations order by name")).rows,
    counts: (await tx.query<{ role: Role; n: number }>("select role, count(*) as n from profiles group by role")).rows,
  }));
  const total = counts.reduce((s, c) => s + c.n, 0);
  const filtered = Boolean(role || org || q);

  return (
    <>
      <PageTitle>회원 관리</PageTitle>
      {sp.deleted && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          회원 <b className="font-mono">{sp.deleted}</b> 을(를) 삭제했습니다.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Badge>전체 {total}명</Badge>
        {ROLES.map((r) => (
          <Badge key={r} tone={ROLE_TONE[r]}>
            {ROLE_LABEL[r]} {counts.find((c) => c.role === r)?.n ?? 0}명
          </Badge>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100" role="search">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-600">역할</span>
          <select name="role" defaultValue={role} className="min-h-11 rounded-lg border border-gray-300 px-3">
            <option value="">전체</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-gray-600">기관</span>
          <select name="org" defaultValue={org} className="min-h-11 max-w-56 rounded-lg border border-gray-300 px-3">
            <option value="">전체</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            <option value="none">소속 없음</option>
          </select>
        </label>
        <label className="min-w-48 flex-1 text-sm">
          <span className="mb-1 block font-semibold text-gray-600">검색</span>
          <input name="q" defaultValue={q} placeholder="아이디 · 이름 · 이니셜 · 이메일 · 휴대폰" className="min-h-11 w-full rounded-lg border border-gray-300 px-3" />
        </label>
        <button className="min-h-11 rounded-lg bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">조회</button>
        {filtered && <Link href="/admin/members" className="min-h-11 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100">초기화</Link>}
      </form>

      <p className="mb-2 text-sm text-gray-500">
        {filtered ? `조건에 맞는 회원 ${members.length}명` : `최근 가입 순`}
        {members.length === LIMIT && ` (최대 ${LIMIT}명까지 표시 — 조건을 좁혀 보세요)`}
      </p>

      <Table head={["", "역할", "아이디", "이름", "이니셜", "휴대폰", "이메일", "기관", "학교 · 학년", "상태", "최근 학습", "가입일"]}>
        {members.map((m) => (
          <tr key={m.id}>
            <td className={`${td} whitespace-nowrap`}>
              <Link href={`/admin/members/${m.id}`} className="rounded-lg px-2 py-1 font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">수정</Link>
            </td>
            <td className={`${td} whitespace-nowrap`}><Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge></td>
            <td className={`${td} whitespace-nowrap font-mono`}>{m.login_id}</td>
            {/* Students' names appear only here (본사 관리자); student and teacher screens show the initial (rule 5). */}
            <td className={`${td} whitespace-nowrap font-semibold`}>{m.full_name ?? <span className="font-normal text-gray-400">-</span>}</td>
            <td className={`${td} whitespace-nowrap`}>{m.display_initial}</td>
            <td className={`${td} whitespace-nowrap`}>
              {m.phone ? <>{formatPhone(m.phone)}{m.role === "student" && <span className="ml-1 text-xs text-gray-500">학부모</span>}</> : <span className="text-gray-400">-</span>}
            </td>
            <td className={`${td} break-all`}>{m.contact_email ? <a href={`mailto:${m.contact_email}`} className="text-brand-700 hover:underline">{m.contact_email}</a> : <span className="text-gray-400">-</span>}</td>
            <td className={`${td} whitespace-nowrap`}>{m.org ?? <span className="text-gray-400">-</span>}</td>
            <td className={td}>
              {m.role === "student" ? [m.school, m.grade ? `${m.grade}학년` : null].filter(Boolean).join(" · ") || "-" : <span className="text-gray-400">-</span>}
            </td>
            <td className={`${td} whitespace-nowrap`}>
              {m.role === "teacher" && !m.is_approved ? <Badge tone="red">승인 대기</Badge> : <Badge tone="green">활성</Badge>}
            </td>
            <td className={`${td} whitespace-nowrap`}>{m.last_attempt_at ? formatDateTime(m.last_attempt_at) : <span className="text-gray-400">-</span>}</td>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(m.created_at)}</td>
          </tr>
        ))}
        {members.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">조건에 맞는 회원이 없습니다.</td></tr>}
      </Table>
    </>
  );
}
