import "server-only";

export interface ReportMessage {
  phone: string;
  studentInitial: string;
  organizationName: string;
  url: string;
}

/** Delivery channel for parent report links. Swap the implementation for KakaoTalk 알림톡 later. */
export interface ReportSender {
  readonly channel: string;
  send(message: ReportMessage): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** MVP: logs the message instead of sending it (PRD ST-30 allows mock delivery). */
export class ConsoleReportSender implements ReportSender {
  readonly channel = "console";
  async send(m: ReportMessage) {
    console.info(`[report] to ${m.phone}: [${m.organizationName}] ${m.studentInitial} 학생의 2주 학습 리포트가 도착했어요. ${m.url}`);
    return { ok: true as const };
  }
}

export function getReportSender(): ReportSender {
  return new ConsoleReportSender();
}
