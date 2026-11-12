import { z } from "zod";
import { AI_SCAN_CONFIG, geminiConfig, groqConfig, type AiProviderName } from "./config";

export interface AiDetection {
  groupName: string;
  confidence: number;
  evidence: string;
}

export interface AiParsed {
  detections: AiDetection[];
  /** Template name from the library, or null if the model could not tell. */
  template: string | null;
}

export interface AiClassification extends AiParsed {
  provider: AiProviderName;
}

export interface AiClassifier {
  classify(input: { url: string; html: string }): Promise<AiClassification>;
}

export class AiProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

export interface ProviderCallOptions {
  /** Component group names from the library. AI output is limited to these. */
  allowedGroups: string[];
  /** Template names from the library. AI output is limited to these. */
  allowedTemplates: string[];
  fetchImpl?: typeof fetch;
  gemini?: { model: string; apiKey?: string };
  groq?: { model: string; apiKey?: string };
  timeoutMs?: number;
}

export function hasAiProviderKey(): boolean {
  return Boolean(geminiConfig().apiKey || groqConfig().apiKey);
}

export function configuredProviders(): AiProviderName[] {
  const out: AiProviderName[] = [];
  if (geminiConfig().apiKey) out.push("gemini");
  if (groqConfig().apiKey) out.push("groq");
  return out;
}

export function isQuotaError(err: unknown): boolean {
  return err instanceof AiProviderError && err.code.endsWith("_http_429");
}

export function buildPrompt(
  url: string,
  html: string,
  allowedGroups: string[],
  allowedTemplates: string[],
): string {
  return [
    "You are identifying UI components and the page template of a web page for a feasibility estimate.",
    "Return ONLY a JSON object, no prose, in this exact shape:",
    '{"template":"<exact template name or null>","components":[{"groupName":"<exact name from the list>","confidence":0.0-1.0,"evidence":"short reason"}]}',
    "Rules:",
    "- groupName must be copied exactly from the allowed component list. Do not invent names.",
    "- template must be copied exactly from the allowed template list, or null if none fits.",
    "- Only report components clearly present in the HTML. An empty list is a valid answer.",
    "- Confidence reflects how clearly the markup shows the component.",
    "",
    `Allowed component groups: ${JSON.stringify(allowedGroups)}`,
    `Allowed page templates: ${JSON.stringify(allowedTemplates)}`,
    "",
    `Page URL: ${url}`,
    "Page HTML (cleaned):",
    html,
  ].join("\n");
}

const responseSchema = z.object({
  template: z.string().nullable().optional(),
  components: z.array(
    z.object({
      groupName: z.string(),
      confidence: z.number().optional(),
      evidence: z.string().optional(),
    }),
  ),
});

/**
 * Parses and validates a model response. Unknown component groups and template names
 * are dropped, so the model cannot add items that are not in the library. Duplicate
 * components keep the highest confidence.
 */
export function parseAiResponse(
  text: string,
  allowedGroups: string[],
  allowedTemplates: string[],
): AiParsed {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new AiProviderError("invalid_ai_json", false);
  }
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new AiProviderError("invalid_ai_shape", false);

  const canonicalGroups = new Map(allowedGroups.map((g) => [g.toLowerCase(), g]));
  const byGroup = new Map<string, AiDetection>();
  for (const item of parsed.data.components) {
    const groupName = canonicalGroups.get(item.groupName.trim().toLowerCase());
    if (!groupName) continue;
    const confidence = clamp01(item.confidence ?? 0.7);
    const prev = byGroup.get(groupName);
    if (!prev || confidence > prev.confidence) {
      byGroup.set(groupName, {
        groupName,
        confidence,
        evidence: (item.evidence ?? "").slice(0, 200),
      });
    }
  }

  const templateName = parsed.data.template?.trim().toLowerCase();
  const canonicalTemplates = new Map(allowedTemplates.map((t) => [t.toLowerCase(), t]));
  const template = templateName ? canonicalTemplates.get(templateName) ?? null : null;

  return { detections: [...byGroup.values()], template };
}

/** Components only. Kept for callers that do not need the template. */
export function parseDetections(text: string, allowedGroups: string[]): AiDetection[] {
  return parseAiResponse(text, allowedGroups, []).detections;
}

/**
 * Calls one provider once. Throws AiProviderError on HTTP errors, empty responses or bad output.
 * The caller decides on fallback, so quota errors can be handled at job level.
 */
export async function classifyWithProvider(
  provider: AiProviderName,
  input: { url: string; html: string },
  options: ProviderCallOptions,
): Promise<AiParsed> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? AI_SCAN_CONFIG.aiRequestTimeoutMs;
  const prompt = buildPrompt(input.url, input.html, options.allowedGroups, options.allowedTemplates);

  let text: string;
  try {
    if (provider === "gemini") {
      const gemini = options.gemini ?? geminiConfig();
      if (!gemini.apiKey) throw new AiProviderError("gemini_not_configured", false);
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gemini.model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": gemini.apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!res.ok) throw httpError("gemini", res.status);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new AiProviderError("gemini_empty_response", true);
    } else {
      const groq = options.groq ?? groqConfig();
      if (!groq.apiKey) throw new AiProviderError("groq_not_configured", false);
      const res = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groq.apiKey}`,
        },
        body: JSON.stringify({
          model: groq.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw httpError("groq", res.status);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      text = data.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AiProviderError("groq_empty_response", true);
    }
  } catch (err) {
    // Timeouts and network failures are transient. Report them with a retryable code.
    if (err instanceof AiProviderError) throw err;
    throw new AiProviderError(`${provider}_request_failed`, true);
  }

  return parseAiResponse(text, options.allowedGroups, options.allowedTemplates);
}

/**
 * Classifier with automatic fallback: Gemini first, then Groq on any error.
 * Used by the single-page scan. The batch job uses classifyWithProvider directly.
 */
export function createAiClassifier(options: ProviderCallOptions): AiClassifier {
  const gemini = options.gemini ?? geminiConfig();
  const groq = options.groq ?? groqConfig();

  if (!gemini.apiKey && !groq.apiKey) {
    throw new AiProviderError("ai_not_configured", false);
  }

  return {
    async classify(input) {
      if (gemini.apiKey) {
        try {
          return { ...(await classifyWithProvider("gemini", input, options)), provider: "gemini" };
        } catch (err) {
          if (!groq.apiKey) throw err;
        }
      }
      return { ...(await classifyWithProvider("groq", input, options)), provider: "groq" };
    },
  };
}

function httpError(provider: string, status: number): AiProviderError {
  const retryable = status === 429 || status >= 500;
  return new AiProviderError(`${provider}_http_${status}`, retryable);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.7;
  return Math.min(1, Math.max(0, n));
}
