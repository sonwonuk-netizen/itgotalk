"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";
import type { ComponentProps } from "react";

export function SubmitButton({ children, pendingText = "처리 중…", ...rest }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || rest.disabled} {...rest}>
      {pending ? pendingText : children}
    </Button>
  );
}
