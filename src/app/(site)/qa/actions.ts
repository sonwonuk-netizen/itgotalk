"use server";

import { asService } from "@/lib/db/client";

export type InquiryState = { error?: string; ok?: boolean } | undefined;

const TOPICS = ["학습 상담", "교육원 가맹", "도서 구매", "기타"];

export async function submitInquiryAction(_: InquiryState, fd: FormData): Promise<InquiryState> {
  const name = String(fd.get("name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const topic = String(fd.get("topic") ?? "");
  const message = String(fd.get("message") ?? "").trim();
  if (fd.get("website")) return { ok: true }; // honeypot: bots fill hidden fields
  if (!name || name.length > 30) return { error: "이름을 입력해 주세요." };
  if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone)) return { error: "연락처를 확인해 주세요. 예) 010-1234-5678" };
  if (!TOPICS.includes(topic)) return { error: "문의 종류를 골라 주세요." };
  if (message.length < 5 || message.length > 2000) return { error: "문의 내용을 5자 이상 2000자 이하로 적어 주세요." };
  if (fd.get("consent") !== "on") return { error: "개인정보 수집·이용에 동의해 주세요." };
  await asService((tx) =>
    tx.query("insert into inquiries (name, phone, topic, message, consent_at) values ($1,$2,$3,$4, now())", [name, phone, topic, message]),
  );
  return { ok: true };
}
