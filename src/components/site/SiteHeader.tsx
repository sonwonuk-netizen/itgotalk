import Link from "next/link";
import { logoutAction } from "@/app/auth-actions";
import { getSessionUser, homeFor } from "@/lib/auth/session";
import { BRAND, MENU } from "@/lib/site";

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 bg-site-purple/95 text-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:h-20 sm:px-6">
        <Link href="/" className="shrink-0" aria-label={`${BRAND} 홈`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/logo-white.png" alt={BRAND} className="h-10 w-auto sm:h-12" />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="주 메뉴">
          {MENU.map((m) => (
            <div key={m.href} className="group relative">
              <Link
                href={m.href}
                className={`block rounded-lg px-3 py-3 text-[15px] font-bold hover:bg-white/15 ${m.href === "/studyroom" ? "text-site-yellow" : ""}`}
              >
                {m.label}
              </Link>
              {m.children && (
                <div className="invisible absolute right-0 top-full min-w-36 rounded-xl bg-white py-2 text-gray-800 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  {m.children.map((c) => (
                    <Link key={c.href} href={c.href} className="block px-4 py-2 text-sm hover:bg-gray-100">{c.label}</Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 text-sm lg:ml-2">
          {user ? (
            <>
              <Link href={homeFor(user.role)} className="whitespace-nowrap rounded-lg px-3 py-2 font-semibold hover:bg-white/15">
                {user.role === "student" ? "학습하기" : "관리"}
              </Link>
              <form action={logoutAction}>
                <button className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-white/15">로그아웃</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="whitespace-nowrap rounded-lg px-3 py-2 hover:bg-white/15">로그인</Link>
              <Link href="/signup/student" className="hidden whitespace-nowrap rounded-lg px-3 py-2 hover:bg-white/15 sm:block">회원가입</Link>
            </>
          )}
          <details className="relative lg:hidden">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-2xl hover:bg-white/15" aria-label="메뉴">☰</summary>
            <nav className="absolute right-0 top-12 w-60 rounded-2xl bg-white p-2 text-gray-800 shadow-xl" aria-label="모바일 메뉴">
              {MENU.flatMap((m) => (m.children ? m.children : [m])).map((m) => (
                <Link key={m.href + m.label} href={m.href} className="block rounded-lg px-4 py-3 font-semibold hover:bg-gray-100">{m.label}</Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
