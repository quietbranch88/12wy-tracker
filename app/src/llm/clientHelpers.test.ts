import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorFromResponse, fetchWithTimeout } from "./clientHelpers";
import { LlmError } from "./resilience";

describe("provider response errors", () => {
  it.each([
    ["Gemini", 429, "rate-limit", "llmErrRateLimit"],
    ["Anthropic", 401, "auth", "llmErrAuth"],
    ["DeepSeek", 500, "other", "llmErrOther"],
    ["Gemini", 400, "other", "llmErrOther"],
  ] as const)("classifies %s HTTP %s with a safe display key", (provider, status, errorClass, displayKey) => {
    const error = errorFromResponse(provider, status, "upstream detail", null);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ class: errorClass, status, displayKey });
    expect(error.rawDetail).toBe(`${provider} ${status}: upstream detail`);
    expect(error.message).not.toContain("upstream detail");
  });

  it("converts numeric Retry-After seconds to milliseconds", () => {
    expect(errorFromResponse("OpenAI", 429, "rate limited", "5").retryAfterMs).toBe(5000);
  });

  it.each([null, "Fri, 31 May 2026 00:00:00 GMT", "not a delay", "Infinity"])(
    "leaves absent or unsupported Retry-After %s unset",
    (header) => {
      expect(errorFromResponse("OpenAI", 429, "rate limited", header).retryAfterMs).toBeUndefined();
    },
  );

  it("sanitizes and bounds upstream detail before attaching it to the error", () => {
    const error = errorFromResponse("Gemini", 500, "\u0000\u202E" + "x".repeat(500), null);
    expect(error.rawDetail).not.toMatch(/[\u0000\u202E]/);
    expect(error.rawDetail).toContain("x".repeat(300));
    expect(error.rawDetail).not.toContain("x".repeat(301));
    expect(error.rawDetail).toContain("[truncated by local LLM guardrail]");
  });
});

describe("request timeout lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("passes through the response and request options without aborting a completed request later", async () => {
    const response = new Response("ok", { status: 200 });
    const fakeFetch = vi.fn(async (_url: string, _init: RequestInit) => response);
    const init = { method: "POST", body: "test request" };

    await expect(fetchWithTimeout("https://example.invalid", init, 5000, fakeFetch)).resolves.toBe(response);
    expect(fakeFetch).toHaveBeenCalledWith("https://example.invalid", {
      ...init, signal: expect.any(AbortSignal),
    });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fakeFetch.mock.calls[0][1].signal?.aborted).toBe(false);
  });

  it("aborts at the deadline and reports a timeout even when the transport rejects with a plain Error", async () => {
    const fakeFetch = vi.fn((_url: string, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(new Error("Request cancelled")), { once: true });
      }),
    );
    const request = fetchWithTimeout("https://example.invalid", {}, 5000, fakeFetch);
    // Attach the rejection handler before advancing time to avoid an unhandled rejection.
    const rejected = expect(request).rejects.toMatchObject({
      name: "LlmError", class: "timeout", displayKey: "llmErrTimeout",
    });
    const signal = fakeFetch.mock.calls[0][1].signal!;

    await vi.advanceTimersByTimeAsync(4999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves network errors for retry classification and clears their timeout", async () => {
    const networkError = new TypeError("Failed to fetch");
    const fakeFetch = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> => {
      throw networkError;
    });

    await expect(fetchWithTimeout("https://example.invalid", {}, 5000, fakeFetch)).rejects.toBe(networkError);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fakeFetch.mock.calls[0][1].signal?.aborted).toBe(false);
  });
});
