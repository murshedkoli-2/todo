/**
 * Thin fetch wrapper for the client.
 *
 * Every component previously hand-rolled `fetch` plus its own error extraction,
 * and most of them dropped the server's message in favour of a generic one.
 * This surfaces the real message and gives callers a single error type.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Network error — check your connection.", 0, "network_error");
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : null) ?? "Something went wrong. Please try again.";
    const code =
      payload && typeof payload === "object" && "code" in payload
        ? String((payload as { code: unknown }).code)
        : "unknown";
    throw new ApiError(message, response.status, code);
  }

  return payload as T;
}

/** Normalises anything thrown into a message safe to show the user. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
