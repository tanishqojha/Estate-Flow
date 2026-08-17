"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <ErrorState
      description="The page hit an unexpected error. Your data is safe — try again."
      onRetry={reset}
    />
  );
}
