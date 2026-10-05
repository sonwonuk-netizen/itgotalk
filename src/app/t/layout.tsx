import { requireStaff } from "@/lib/auth/session";
import { unreadAlertCount } from "@/lib/server/teacher";
import { StaffShell } from "@/components/StaffShell";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <StaffShell user={user} alertCount={await unreadAlertCount(user.id)}>
      {children}
    </StaffShell>
  );
}
