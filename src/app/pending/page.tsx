import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/lib/auth/session";
import { logoutAction } from "../auth-actions";
import { HomeLogo } from "@/components/HomeLogo";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approved) redirect(homeFor(user.role));
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="absolute left-4 top-4"><HomeLogo /></div>
      <div className="max-w-md space-y-4 rounded-2xl bg-white p-8 text-center shadow">
        <div className="text-4xl">⏳</div>
        <h1 className="text-xl font-bold">원장님 승인을 기다리고 있어요</h1>
        <p className="text-gray-600">승인되면 학생 목록과 기록을 볼 수 있어요. 승인 전에는 학생 정보가 보이지 않습니다.</p>
        <form action={logoutAction}><Button tone="secondary">로그아웃</Button></form>
      </div>
    </main>
  );
}
