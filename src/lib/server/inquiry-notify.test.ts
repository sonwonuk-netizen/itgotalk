import { describe, expect, it } from "vitest";
import { buildInquiryEmail } from "./inquiry-notify";

describe("상담신청 email", () => {
  const raw = buildInquiryEmail(
    { name: "홍길동", phone: "010-1234-5678", topic: "학습 상담", message: "초등 2학년 연산 상담 원합니다.\n둘째 줄", createdAt: new Date("2026-10-05T05:00:00Z") },
    "noreply@notify.itgotalk.com",
    "wonukson@naver.com",
  );
  const [head, body] = raw.split("\r\n\r\n");

  it("has the headers Cloudflare and mail clients need, with Korean encoded", () => {
    expect(head).toMatch(/^From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <noreply@notify\.itgotalk\.com>$/m);
    expect(head).toMatch(/^To: <wonukson@naver\.com>$/m);
    expect(head).toMatch(/^Message-ID: <[0-9a-f-]+@notify\.itgotalk\.com>$/m);
    const subject = head!.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/m)![1]!;
    expect(Buffer.from(subject, "base64").toString("utf8")).toBe("[상담신청] 학습 상담 - 홍길동");
  });

  it("carries every field in a base64 UTF-8 body with short lines", () => {
    expect(body!.split("\r\n").every((l) => l.length <= 76)).toBe(true);
    const text = Buffer.from(body!.replace(/\r\n/g, ""), "base64").toString("utf8");
    for (const s of ["홍길동", "010-1234-5678", "학습 상담", "초등 2학년 연산 상담 원합니다.", "2026. 10. 5."]) expect(text).toContain(s);
  });
});
