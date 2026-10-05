import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/auth-actions";
import { HomeLogo } from "./HomeLogo";
import type { SessionUser } from "@/lib/auth/session";

const TEACHER_NAV = [
  { href: "/t/students", label: "학생" },
  { href: "/t/alerts", label: "알림" },
];
const ADMIN_NAV = [
  { href: "/admin/regions", label: "지역·학교" },
  { href: "/admin/orgs", label: "기관" },
  { href: "/admin/content", label: "콘텐츠" },
  { href: "/admin/reports", label: "리포트" },
  { href: "/admin/inquiries", label: "상담신청" },
];

export function StaffShell({ user, children, alertCount }: { user: SessionUser; children: ReactNode; alertCount?: number }) {
  const nav = user.role === "admin" ? ADMIN_NAV : user.role === "org_admin" ? [...TEACHER_NAV, { href: "/t/org", label: "기관 설정" }] : TEACHER_NAV;
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="no-print border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <HomeLogo size="sm" />
          <span className="mr-4 text-sm font-bold text-gray-500">{user.role === "admin" ? "관리자" : user.role === "org_admin" ? "원장님" : "선생님"}</span>
          <nav className="flex flex-1 flex-wrap gap-1">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                {n.label}
                {n.href === "/t/alerts" && alertCount ? (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 text-xs text-white">{alertCount}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          <span className="text-sm text-gray-500">{user.fullName}</span>
          <form action={logoutAction}>
            <button className="rounded-lg px-3 py-3 text-sm text-gray-500 hover:bg-gray-100">로그아웃</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h1 className="flex-1 text-2xl font-bold">{children}</h1>
      {actions}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-4 py-3 align-top";
