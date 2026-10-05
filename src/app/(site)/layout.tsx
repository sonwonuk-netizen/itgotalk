import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` } };
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
