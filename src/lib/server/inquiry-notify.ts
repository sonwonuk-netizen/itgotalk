import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface InquiryMessage {
  name: string;
  phone: string;
  topic: string;
  message: string;
  createdAt: Date;
}

/** Workers `send_email` binding (wrangler.jsonc "INQUIRY_EMAIL"). */
interface SendEmailBinding {
  send(message: unknown): Promise<void>;
}

interface InquiryEnv {
  INQUIRY_EMAIL?: SendEmailBinding;
  INQUIRY_EMAIL_FROM?: string;
  INQUIRY_EMAIL_TO?: string;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
/** RFC 2047 encoded word, so Korean subjects and names survive every mail client. */
const header = (s: string) => `=?UTF-8?B?${b64(s)}?=`;

export function buildInquiryEmail(m: InquiryMessage, from: string, to: string): string {
  const when = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(m.createdAt);
  const body = [
    "itgotalk.com 상담신청이 접수되었습니다.",
    "",
    `접수 시각: ${when}`,
    `이름: ${m.name}`,
    `연락처: ${m.phone}`,
    `문의 종류: ${m.topic}`,
    "",
    "[문의 내용]",
    m.message,
    "",
    "관리자 화면: https://itgotalk.com/admin/inquiries",
  ].join("\r\n");
  return [
    `From: ${header("잇고톡 상담신청")} <${from}>`,
    `To: <${to}>`,
    `Subject: ${header(`[상담신청] ${m.topic} - ${m.name}`)}`,
    `Date: ${m.createdAt.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split("@")[1]}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
}

/**
 * Emails a new 상담신청 to the address in wrangler.jsonc (Cloudflare Email Routing on
 * notify.itgotalk.com). Outside Cloudflare (next dev, tests) it only logs.
 * Never throws: the inquiry is already saved, and the admin list is the source of truth.
 */
export async function notifyInquiry(m: InquiryMessage): Promise<void> {
  let env: InquiryEnv = {};
  try {
    env = getCloudflareContext().env as InquiryEnv;
  } catch {
    // not running in a Worker
  }
  if (!env.INQUIRY_EMAIL || !env.INQUIRY_EMAIL_FROM || !env.INQUIRY_EMAIL_TO) {
    console.info(`[inquiry] email not configured here; saved inquiry from ${m.name} (${m.topic})`);
    return;
  }
  try {
    // Only exists in the Workers runtime; keep bundlers and tsc from resolving it.
    const workersEmailModule = "cloudflare:email";
    const { EmailMessage } = (await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ workersEmailModule)) as {
      EmailMessage: new (from: string, to: string, raw: string) => unknown;
    };
    const raw = buildInquiryEmail(m, env.INQUIRY_EMAIL_FROM, env.INQUIRY_EMAIL_TO);
    await env.INQUIRY_EMAIL.send(new EmailMessage(env.INQUIRY_EMAIL_FROM, env.INQUIRY_EMAIL_TO, raw));
  } catch (e) {
    console.error("[inquiry] email failed", e);
  }
}
