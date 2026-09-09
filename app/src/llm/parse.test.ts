import { describe, expect, it } from "vitest";
import { parsePriorityResponse } from "./parse";

describe("priority response parsing", () => {
  it("preserves priority suggestions from a valid JSON array", () => {
    const suggestions = [
      { priority: "exercise", reason: "keep health", tag: "fitness" },
      { priority: "read", reason: "learn more", tag: "education" },
    ];
    expect(parsePriorityResponse(JSON.stringify(suggestions))).toEqual(suggestions);
  });

  it("accepts a JSON array inside a markdown code fence", () => {
    const raw = '```json\n[{"priority":"run","reason":"health","tag":"sport"}]\n```';
    expect(parsePriorityResponse(raw)).toEqual([
      { priority: "run", reason: "health", tag: "sport" },
    ]);
  });

  it("defaults a missing reason and leaves an absent tag unset", () => {
    expect(parsePriorityResponse('[{"priority":"sleep"}]')).toEqual([
      { priority: "sleep", reason: "", tag: undefined },
    ]);
  });

  it("rejects a response with no parseable suggestions", () => {
    expect(() => parsePriorityResponse("not json")).toThrow(/Cannot parse JSON/);
  });

  it("recovers complete suggestions before a truncated final object", () => {
    const raw = '[{"priority":"alpha","reason":"first"},{"priority":"beta","reason":"second"';
    expect(parsePriorityResponse(raw)).toEqual([
      { priority: "alpha", reason: "first", tag: undefined },
    ]);
  });

  it("ignores malformed entries while retaining valid suggestions", () => {
    const raw = JSON.stringify([null, { reason: "no priority" }, { priority: 123 }, { priority: "read" }]);
    expect(parsePriorityResponse(raw)).toEqual([
      { priority: "read", reason: "", tag: undefined },
    ]);
  });
});
