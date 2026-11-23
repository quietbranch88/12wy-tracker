import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backoffDelay,
  classify,
  isTransient,
  JITTER_MAX,
  LlmError,
  MAX_RETRIES,
  nextRetryDelayMs,
  RETRY_AFTER_CAP_MS,
} from "./resilience";

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function abortError(): Error {
  return Object.assign(new Error("aborted"), { name: "AbortError" });
}

function rateLimitError(retryAfterMs?: number): LlmError {
  return new LlmError({
    class: "rate-limit",
    message: "rate limit exceeded",
    rawDetail: "provider rate limit",
    displayKey: "llmErrRateLimit",
    status: 429,
    retryAfterMs,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("provider error classification", () => {
  it.each([
    [httpError(429), "rate-limit"],
    [httpError(401), "auth"],
    [abortError(), "timeout"],
    [httpError(500), "other"],
    [httpError(400), "other"],
    [new Error("unexpected failure"), "other"],
  ] as const)("classifies %s as %s and preserves internal detail", (error, errorClass) => {
    expect(classify(error)).toEqual({ class: errorClass, rawDetail: error.message });
  });

  it.each([
    [httpError(429), true],
    [httpError(500), true],
    [httpError(503), true],
    [new TypeError("Failed to fetch"), true],
    [new TypeError("Network error"), true],
    [abortError(), false],
    [httpError(401), false],
    [httpError(400), false],
    [new TypeError("invalid argument"), false],
    [new Error("unexpected failure"), false],
  ] as const)("decides whether %s is transient: %s", (error, expected) => {
    expect(isTransient(error)).toBe(expected);
  });
});

describe("bounded retries", () => {
  it.each([0, 0.5, 0.999999])("keeps exponential delay within its jitter bounds at random=%s", (random) => {
    vi.spyOn(Math, "random").mockReturnValue(random);
    for (const [attempt, base] of [[0, 1000], [1, 2000], [2, 4000]]) {
      const delay = backoffDelay(attempt);
      expect(delay).toBeGreaterThanOrEqual(base);
      expect(delay).toBeLessThan(base + JITTER_MAX);
    }
  });

  it.each([httpError(503), new TypeError("Failed to fetch"), rateLimitError()])(
    "backs off transient %s and stops after the retry budget",
    (error) => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      expect(nextRetryDelayMs(error, 0)).toBe(1000);
      expect(nextRetryDelayMs(error, 1)).toBe(2000);
      expect(nextRetryDelayMs(error, MAX_RETRIES)).toBeNull();
      expect(nextRetryDelayMs(error, MAX_RETRIES + 1)).toBeNull();
    },
  );

  it.each([0, 5000, RETRY_AFTER_CAP_MS])("honors a Retry-After of %s ms within the cap", (delay) => {
    expect(nextRetryDelayMs(rateLimitError(delay), 0)).toBe(delay);
  });

  it("gives up when Retry-After exceeds the cap or the retry budget is exhausted", () => {
    expect(nextRetryDelayMs(rateLimitError(RETRY_AFTER_CAP_MS + 1), 0)).toBeNull();
    expect(nextRetryDelayMs(rateLimitError(5000), MAX_RETRIES)).toBeNull();
  });

  it.each([
    abortError(),
    httpError(400),
    new LlmError({
      class: "timeout", message: "request timed out", rawDetail: "timeout",
      displayKey: "llmErrTimeout",
    }),
    new LlmError({
      class: "auth", message: "authentication failed", rawDetail: "unauthorized",
      displayKey: "llmErrAuth", status: 401,
    }),
  ])("does not retry permanent or timeout errors: %s", (error) => {
    expect(nextRetryDelayMs(error, 0)).toBeNull();
  });
});
