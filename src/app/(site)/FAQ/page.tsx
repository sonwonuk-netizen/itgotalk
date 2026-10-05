import type { Metadata } from "next";
import { EmptyBoard } from "@/components/site/EmptyBoard";

export const metadata: Metadata = { title: "자주하는 질문" };

export default function FaqPage() {
  return <EmptyBoard title="자주하는 질문" />;
}
