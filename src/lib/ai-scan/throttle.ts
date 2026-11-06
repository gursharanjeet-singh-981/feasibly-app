import type { AiProviderName } from "./config";

export interface Throttle {
  /** Resolves when the next call to this provider is allowed. */
  waitTurn(provider: AiProviderName): Promise<void>;
}

/**
 * Spaces calls to each provider by at least its minimum interval, so requests-per-minute
 * limits are not exceeded. Calls are queued, so concurrent callers take turns.
 */
export function createThrottle(
  minIntervalMs: Record<AiProviderName, number>,
  options: { now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
): Throttle {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const nextAllowed: Record<AiProviderName, number> = { gemini: 0, groq: 0 };
  const queue: Record<AiProviderName, Promise<void>> = { gemini: Promise.resolve(), groq: Promise.resolve() };

  return {
    waitTurn(provider) {
      const turn = queue[provider].then(async () => {
        const wait = nextAllowed[provider] - now();
        if (wait > 0) await sleep(wait);
        nextAllowed[provider] = Math.max(now(), nextAllowed[provider]) + minIntervalMs[provider];
      });
      queue[provider] = turn.catch(() => undefined);
      return turn;
    },
  };
}
