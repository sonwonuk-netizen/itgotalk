import Link from "next/link";
import { asAnon } from "@/lib/db/client";
import { HomeLogo } from "@/components/HomeLogo";
import { StudentSignupForm } from "./StudentSignupForm";

export const dynamic = "force-dynamic";

export default async function StudentSignupPage() {
  // Only regions/schools registered (and active) by the admin are offered (ST-01).
  const { regions, schools } = await asAnon(async (tx) => ({
    regions: (await tx.query<{ id: string; name: string }>("select id, name from regions where is_active order by name")).rows,
    schools: (await tx.query<{ id: string; name: string; region_id: string }>(
      "select id, name, region_id from schools where is_active order by name",
    )).rows,
  }));
  return (
    <main className="kid flex justify-center p-4">
      <div className="w-full max-w-xl space-y-4 py-6">
        <HomeLogo />
        <h1 className="text-3xl font-black text-brand-600">학생 가입</h1>
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <StudentSignupForm regions={regions} schools={schools} />
        </div>
        <Link href="/login" className="block text-center text-sm text-gray-500 hover:underline">로그인으로 돌아가기</Link>
      </div>
    </main>
  );
}
