import type { Metadata } from "next";
import { EmptyBoard } from "@/components/site/EmptyBoard";

export const metadata: Metadata = { title: "공지사항" };

export default function NoticePage() {
  return <EmptyBoard title="공지사항" />;
}
