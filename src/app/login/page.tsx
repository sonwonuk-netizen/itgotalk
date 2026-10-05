import Link from "next/link";
import { DEMO_ACCOUNTS } from "@/lib/db/seed";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const showDemo = process.env.NODE_ENV !== "production";
  return (
    <main className="kid flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-block rounded-2xl bg-site-purple px-5 py-3" aria-label="책을 쓰는 아이들 홈">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/logo-white.png" alt="책을 쓰는 아이들" className="h-12 w-auto" />
          </Link>
          <p className="mt-3 text-lg font-bold text-gray-700">학습자료실 · 연산 훈련</p>
          <p className="text-gray-600">매일 조금씩, 한 단계씩 올라가는 연산</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <LoginForm />
          <div className="mt-6 flex justify-between text-sm">
            <Link href="/signup/student" className="font-semibold text-brand-600 hover:underline">학생 가입하기</Link>
            <Link href="/signup/teacher" className="text-gray-500 hover:underline">선생님 가입</Link>
          </div>
        </div>
        {showDemo && (
          <details className="rounded-2xl bg-white/70 p-4 text-sm text-gray-600">
            <summary className="cursor-pointer font-medium">개발용 데모 계정</summary>
            <table className="mt-2 w-full">
              <tbody>
                {DEMO_ACCOUNTS.map((a) => (
                  <tr key={a.loginId}>
                    <td className="py-0.5 font-mono">{a.loginId}</td>
                    <td className="font-mono">{a.password}</td>
                    <td>{a.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2">초대 코드: <span className="font-mono">ITGO2026</span></p>
          </details>
        )}
      </div>
    </main>
  );
}
