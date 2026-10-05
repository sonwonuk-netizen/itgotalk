import Link from "next/link";
import { logoutAction } from "@/app/auth-actions";
import { HomeLogo } from "./HomeLogo";
import { Avatar } from "./ui";

export function StudentHeader({ initial, orgName }: { initial: string; orgName?: string | null }) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
      <HomeLogo />
      <Avatar initial={initial} />
      {orgName && <span className="hidden text-sm text-gray-500 sm:inline">{orgName}</span>}
      <nav className="ml-auto flex items-center gap-1">
        <Link href="/s/home" className="whitespace-nowrap rounded-xl px-3 py-3 font-semibold text-gray-700 hover:bg-white sm:px-4">학습</Link>
        <Link href="/s/records" className="whitespace-nowrap rounded-xl px-3 py-3 font-semibold text-gray-700 hover:bg-white sm:px-4">내 기록</Link>
        <form action={logoutAction}>
          <button className="whitespace-nowrap rounded-xl px-3 py-3 text-gray-500 hover:bg-white sm:px-4">나가기</button>
        </form>
      </nav>
    </header>
  );
}
