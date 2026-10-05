"use client";

import { useRouter } from "next/navigation";
import { Player } from "@/components/Player";

export function DiagnosticRunner({ setId, initial, title }: { setId: string; initial: string; title: string }) {
  const router = useRouter();
  return <Player setId={setId} mode="diagnostic" initial={initial} title={title} onDiagnosticFinished={() => router.refresh()} />;
}
