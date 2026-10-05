/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { MouseEventHandler } from "react";
import { BRAND } from "@/lib/site";

/** Top-left logo on every screen: always goes to the site home. */
export function HomeLogo({ size = "md", onClick }: { size?: "sm" | "md"; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label={`${BRAND} 홈으로`}
      className="inline-flex shrink-0 items-center rounded-xl bg-site-purple px-2.5 py-1.5 hover:bg-site-purple-dark"
    >
      <img src="/site/logo-white.png" alt={BRAND} className={size === "sm" ? "h-7 w-auto" : "h-9 w-auto"} />
    </Link>
  );
}
