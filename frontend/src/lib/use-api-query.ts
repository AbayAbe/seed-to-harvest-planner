"use client";

import { useEffect, useState } from "react";
import { requestApi } from "./api";

/** Keyed state hides stale data immediately, before the replacement effect runs. */
export function useApiQuery<T>(path: string, body?: string, validationError = "") {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([path, body, validationError, attempt]);
  const [state, setState] = useState<{ key: string; data: T | null; error: string } | null>(null);
  useEffect(() => {
    if (validationError) return;
    const controller = new AbortController();
    // Debounce manual typing; choosing another input cancels the previous request.
    const timer = setTimeout(() => {
      requestApi<T>(path, body, controller.signal)
        .then((data) => { if (!controller.signal.aborted) setState({ key, data, error: "" }); })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : "Data belum bisa dimuat." });
        });
    }, body === undefined ? 0 : 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, body, validationError, key]);
  const current = state?.key === key ? state : null;
  return {
    data: validationError ? null : current?.data ?? null,
    error: validationError || current?.error || "",
    loading: !validationError && !current,
    retry: () => setAttempt((value) => value + 1),
  };
}
