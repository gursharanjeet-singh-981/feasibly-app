import { describe, expect, it } from "vitest";
import { AiProviderError, classifyWithProvider } from "./provider";
import { isTransientProviderCode } from "./browserJob";

const options = {
  allowedGroups: ["CTA"],
  allowedTemplates: [],
  gemini: { model: "m", apiKey: "k" },
};
const input = { url: "https://x.test/", html: "<html></html>" };

describe("provider request errors", () => {
  it("reports a network failure as a retryable provider error", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const err = await classifyWithProvider("gemini", input, { ...options, fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err).toMatchObject({ code: "gemini_request_failed", retryable: true });
  });

  it("reports a 503 as a retryable provider error", async () => {
    const fetchImpl = (async () => new Response("busy", { status: 503 })) as unknown as typeof fetch;
    const err = await classifyWithProvider("gemini", input, { ...options, fetchImpl }).catch((e) => e);
    expect(err).toMatchObject({ code: "gemini_http_503", retryable: true });
  });

  it("treats 5xx, empty replies and request failures as transient for the job", () => {
    expect(isTransientProviderCode("gemini_http_503")).toBe(true);
    expect(isTransientProviderCode("groq_request_failed")).toBe(true);
    expect(isTransientProviderCode("gemini_empty_response")).toBe(true);
    expect(isTransientProviderCode("gemini_http_429")).toBe(false);
    expect(isTransientProviderCode("ai_unknown_error")).toBe(false);
  });
});
