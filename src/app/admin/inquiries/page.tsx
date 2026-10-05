import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { markInquiryHandledAction } from "../actions";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, formatDateTime } from "@/components/ui";

export default async function InquiriesPage() {
  const user = await requireRole("admin");
  const rows = await asUser(user.id, async (tx) =>
    (await tx.query<{ id: string; name: string; phone: string; topic: string; message: string; handled_at: Date | null; created_at: Date }>(
      "select id, name, phone, topic, message, handled_at, created_at from inquiries order by handled_at nulls first, created_at desc limit 300",
    )).rows,
  );
  return (
    <>
      <PageTitle>상담신청 <span className="text-base font-normal text-gray-500">사이트 /qa에서 접수</span></PageTitle>
      <Table head={["접수", "이름", "연락처", "종류", "내용", "상태"]}>
        {rows.map((r) => (
          <tr key={r.id} className={r.handled_at ? "text-gray-400" : ""}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.created_at)}</td>
            <td className={td}>{r.name}</td>
            <td className={`${td} whitespace-nowrap`}><a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a></td>
            <td className={td}>{r.topic}</td>
            <td className={`${td} max-w-md whitespace-pre-line`}>{r.message}</td>
            <td className={td}>
              {r.handled_at ? <Badge tone="green">처리됨</Badge> : (
                <form action={markInquiryHandledAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton size="sm" tone="secondary">처리 완료</SubmitButton>
                </form>
              )}
            </td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">접수된 상담이 없습니다.</td></tr>}
      </Table>
    </>
  );
}
