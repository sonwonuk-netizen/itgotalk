import type { Metadata } from "next";
import { Section, SubHero } from "@/components/site/SubHero";
import { InquiryForm } from "./InquiryForm";

export const metadata: Metadata = { title: "상담신청" };

export default function QaPage() {
  return (
    <>
      <SubHero title="상담신청" subtitle="실력 테스트에서 맞춤형 과정 설계까지 친절하게 상담해 드리겠습니다." image="/site/banner-b.jpg" />
      <Section className="max-w-2xl">
        <InquiryForm />
      </Section>
    </>
  );
}
