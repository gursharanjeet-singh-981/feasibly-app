import { AI_SCAN_CONFIG, type AiProviderName } from "./config";

// Daily AI-call counters per provider. Held in memory, so they are per server instance and
// reset on restart. Good enough for testing; a shared store is needed before production.
// Stored on globalThis so every route bundle counts against the same budget. A module-level
// variable would be a separate copy in each route, and each route would get its own daily cap.
interface BudgetState {
  currentDay: string;
  usedToday: Record<AiProviderName, number>;
}
const globalBudget = globalThis as typeof globalThis & { __feasiblyAiBudget?: BudgetState };
if (!globalBudget.__feasiblyAiBudget) {
  globalBudget.__feasiblyAiBudget = { currentDay: "", usedToday: { gemini: 0, groq: 0 } };
}
const budget: BudgetState = globalBudget.__feasiblyAiBudget;

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function roll(now: Date): void {
  const day = utcDay(now);
  if (day !== budget.currentDay) {
    budget.currentDay = day;
    budget.usedToday.gemini = 0;
    budget.usedToday.groq = 0;
  }
}

/** True if the provider still has budget today. Does not reserve anything. */
export function hasAiBudget(provider: AiProviderName, now: Date = new Date()): boolean {
  roll(now);
  return budget.usedToday[provider] < AI_SCAN_CONFIG.dailyAiCallCaps[provider];
}

/** Reserves one call for the provider from today's budget. Returns false when the cap is reached. */
export function reserveDailyAiCall(provider: AiProviderName, now: Date = new Date()): boolean {
  roll(now);
  if (budget.usedToday[provider] >= AI_SCAN_CONFIG.dailyAiCallCaps[provider]) return false;
  budget.usedToday[provider] += 1;
  return true;
}

export function dailyAiCallsUsed(provider: AiProviderName, now: Date = new Date()): number {
  roll(now);
  return budget.usedToday[provider];
}

/** Test helper. */
export function resetDailyAiBudget(): void {
  budget.currentDay = "";
  budget.usedToday.gemini = 0;
  budget.usedToday.groq = 0;
}
