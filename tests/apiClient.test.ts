import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError, api, errorMessage } from "@/lib/apiClient";

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const stub = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  });
  vi.stubGlobal("fetch", stub);
  return stub;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api", () => {
  test("returns the parsed body on success", async () => {
    mockFetch({ json: async () => ({ _id: "1", title: "Task" }) });
    await expect(api("/api/todos")).resolves.toEqual({ _id: "1", title: "Task" });
  });

  test("sends JSON headers only when there is a body", async () => {
    const stub = mockFetch({});

    await api("/api/todos");
    expect(stub.mock.calls[0]![1]).toMatchObject({ headers: undefined });

    await api("/api/todos", { method: "POST", body: { title: "A" } });
    expect(stub.mock.calls[1]![1]).toMatchObject({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "A" }),
    });
  });

  test("returns undefined for a 204 without parsing a body", async () => {
    mockFetch({
      status: 204,
      json: async () => {
        throw new Error("204 has no body to parse");
      },
    });
    await expect(api("/api/todos/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  test("surfaces the server's message rather than a generic one", async () => {
    mockFetch({
      ok: false,
      status: 400,
      json: async () => ({ error: "Amount must be greater than zero", code: "bad_request" }),
    });

    await expect(api("/api/todos", { method: "POST", body: {} }))
      .rejects.toThrow("Amount must be greater than zero");
  });

  test("carries the status and code on the thrown error", async () => {
    mockFetch({ ok: false, status: 429, json: async () => ({ error: "Slow down", code: "rate_limited" }) });

    const caught: unknown = await api("/api/auth/verify-otp", {
      method: "POST",
      body: {},
    }).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(429);
    expect((caught as ApiError).code).toBe("rate_limited");
  });

  test("falls back to a readable message when the error body is not JSON", async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });

    await expect(api("/api/todos")).rejects.toThrow(/Something went wrong/);
  });

  test("reports a network failure distinctly from an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const caught: unknown = await api("/api/todos").catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe("network_error");
    expect((caught as ApiError).status).toBe(0);
  });

  test("re-throws an abort so callers can ignore cancelled requests", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    await expect(api("/api/todos")).rejects.toBe(abort);
  });
});

describe("errorMessage", () => {
  test("unwraps an ApiError", () => {
    expect(errorMessage(new ApiError("Nope", 400, "bad_request"))).toBe("Nope");
  });

  test("unwraps a plain Error", () => {
    expect(errorMessage(new Error("Boom"))).toBe("Boom");
  });

  test("gives a safe default for a non-Error throw", () => {
    expect(errorMessage("something odd")).toMatch(/Something went wrong/);
    expect(errorMessage(null)).toMatch(/Something went wrong/);
  });
});
