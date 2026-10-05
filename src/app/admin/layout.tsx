import { requireRole } from "@/lib/auth/session";
import { StaffShell } from "@/components/StaffShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");
  return <StaffShell user={user}>{children}</StaffShell>;
}
