"use client";

import { Button } from "./ui";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      인쇄 / PDF 저장
    </Button>
  );
}
