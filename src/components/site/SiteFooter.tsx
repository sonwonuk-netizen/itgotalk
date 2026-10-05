import { BRAND, COMPANY } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-[#363636] text-gray-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[auto_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/logo-white.png" alt={BRAND} className="h-12 w-auto" />
        <div className="space-y-1 md:text-right">
          <p>
            <a href="https://ilgotalk.com/?mode=privacy" target="_blank" rel="noreferrer" className="font-semibold text-white hover:underline">개인정보처리방침</a>
            <span className="mx-2">·</span>
            <a href="https://ilgotalk.com/?mode=policy" target="_blank" rel="noreferrer" className="hover:underline">이용약관</a>
          </p>
          <p>{COMPANY.address}</p>
          <p>Tel. <a href={`tel:${COMPANY.tel}`} className="hover:underline">{COMPANY.tel}</a> / Email. <a href={`mailto:${COMPANY.email}`} className="hover:underline">{COMPANY.email}</a></p>
          <p>대표자: {COMPANY.ceo}</p>
          <p className="text-gray-400">
            출판사 신고번호: {COMPANY.publisherNo} │ 사업자등록번호: {COMPANY.bizNo}{" "}
            <a href={COMPANY.bizCheckUrl} target="_blank" rel="noreferrer" className="underline">[사업자등록정보조회]</a> │ 통신판매업: {COMPANY.mailOrderNo} │ 신고기관명: {COMPANY.authority}
          </p>
          <p className="text-gray-500">{COMPANY.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
