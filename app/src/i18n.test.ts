import { describe, it, expect } from "vitest";
import { labels, tr } from "./i18n";

describe("i18n label parity", () => {
  const zhKeys = Object.keys(labels.zh).sort();
  const enKeys = Object.keys(labels.en).sort();
  const frKeys = Object.keys(labels.fr).sort();

  it("labels.en has the same keys as labels.zh", () => {
    expect(enKeys).toEqual(zhKeys);
  });

  it("labels.fr has the same keys as labels.zh", () => {
    expect(frKeys).toEqual(zhKeys);
  });

  it("no key present in en that is absent from zh", () => {
    const extra = enKeys.filter((k) => !Object.prototype.hasOwnProperty.call(labels.zh, k));
    expect(extra).toEqual([]);
  });

  it("no key present in fr that is absent from zh", () => {
    const extra = frKeys.filter((k) => !Object.prototype.hasOwnProperty.call(labels.zh, k));
    expect(extra).toEqual([]);
  });

  it("keeps all language dictionaries aligned after removing unused settings labels", () => {
    expect(new Set(enKeys).size).toBe(enKeys.length);
    expect(new Set(frKeys).size).toBe(frKeys.length);
  });
});

describe("localized LLM messages", () => {
  const languages = ["zh", "en", "fr"] as const;
  const keys = ["llmErrTimeout", "llmErrRateLimit", "llmErrAuth", "llmErrOther", "llmRetryIn"] as const;

  it.each(languages)("provides nonempty error and retry messages in %s", (language) => {
    for (const key of keys) {
      expect(tr(language, key), `${language}.${key}`).toEqual(expect.any(String));
      expect(tr(language, key).trim(), `${language}.${key}`).not.toBe("");
    }
  });

  it.each(languages)("interpolates retry seconds in %s", (language) => {
    const message = tr(language, "llmRetryIn", { sec: "5" });
    expect(message).toContain("5");
    expect(message).not.toContain("{sec}");
  });
});
