import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { listStudents } from "@/lib/server/teacher";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { Badge, MODE_LABEL, formatDateTime, formatSec } from "@/components/ui";

export default async function StudentsPage() {
  const user = await requireStaff();
  const students = await listStudents(user.id);
  return (
    <>
      <PageTitle>학생 목록 <span className="text-base font-normal text-gray-500">({students.length}명)</span></PageTitle>
      <Table head={["이니셜", "학년·학교", "현재 단계", "최근 기록", "상태"]}>
        {students.map((s) => (
          <tr key={s.id} className="hover:bg-brand-50">
            <td className={td}>
              <Link href={`/t/students/${s.id}`} className="font-semibold text-brand-700 hover:underline">{s.display_initial}</Link>
            </td>
            <td className={td}>{s.grade ? `${s.grade}학년` : "-"} · {s.school ?? "-"}</td>
            <td className={td}>{s.current_skills ?? <span className="text-gray-400">진단 전 / 완료</span>}</td>
            <td className={td}>
              {s.last_at ? (
                <>
                  {formatDateTime(s.last_at)} · {MODE_LABEL[s.last_mode ?? ""]} {formatSec(s.last_elapsed)}
                  {s.last_passed === true && " ✅"}
                  {s.last_passed === false && " ❌"}
                </>
              ) : "-"}
            </td>
            <td className={td}>
              {s.open_alerts > 0 ? <Badge tone="red">정체 · 3회 연속 미통과</Badge>
                : (s.consecutive_fail ?? 0) > 0 ? <Badge tone="amber">연속 실패 {s.consecutive_fail}</Badge>
                : <Badge tone="green">정상</Badge>}
            </td>
          </tr>
        ))}
        {students.length === 0 && (
          <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">아직 학생이 없어요. 기관 초대 코드를 학생에게 알려 주세요.</td></tr>
        )}
      </Table>
    </>
  );
}
