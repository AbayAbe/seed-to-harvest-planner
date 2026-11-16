import type { ApiErrorResponse, FormErrors } from "@agri/contracts";

export class ApiError extends Error {
  constructor(message: string, readonly fields?: FormErrors, readonly status = 0) { super(message); }
}
/** Same-origin URL; the Next.js proxy forwards this to the separate API service. */
export async function requestApi<T>(path: string, body?: string, signal?: AbortSignal): Promise<T> {
  if (process.env.NEXT_PUBLIC_DEMO_STATIC === "true") {
    signal?.throwIfAborted();
    const { requestDemo } = await import("./demo-api");
    signal?.throwIfAborted();
    try { return await requestDemo(path, body) as T; }
    catch (error) {
      if (error && typeof error === "object" && "fields" in error) {
        throw new ApiError(error instanceof Error ? error.message : "Periksa isian Anda.", (error as { fields?: FormErrors }).fields);
      }
      throw error;
    }
  }
  // AbortController dasar juga tersedia pada browser Android yang lebih lama.
  const controller = new AbortController();
  const batalkan = () => controller.abort();
  if (signal?.aborted) batalkan();
  signal?.addEventListener("abort", batalkan, { once: true });
  const timer = setTimeout(batalkan, 10_000);
  try {
    const response = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body }),
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid response");
    const payload: unknown = await response.json();
    if (!response.ok) {
      const failure = payload as ApiErrorResponse;
      if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("agri:sesi-berakhir"));
      throw new ApiError(failure.error?.message ?? "Permintaan belum berhasil. Coba lagi.", failure.error?.fields, response.status);
    }
    return payload as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError("Belum dapat terhubung ke layanan. Periksa koneksi, lalu coba lagi.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", batalkan);
  }
}
