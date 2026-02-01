import type { BotState } from "../types.js";
import type { Config } from "../config.js";

/**
 * Check if cooldown period has elapsed
 */
export function checkCooldown(
  state: BotState,
  config: Config
): boolean {
  if (!state.lastTradeTime) {
    return true;
  }
  
  const cooldownMs =
    config.mode === "live" ? config.cooldownMsLive : config.cooldownMsPaper;
  const elapsed = Date.now() - state.lastTradeTime.getTime();
  
  return elapsed >= cooldownMs;
}

/**
 * Reset hourly counters if needed
 */
export function resetHourlyCounters(state: BotState): void {
  const now = new Date();
  const elapsed = now.getTime() - state.hourStartTime.getTime();
  
  if (elapsed >= 3600000) {
    // 1 hour
    state.tradesThisHour = 0;
    state.hourStartTime = now;
  }
}

/**
 * Reset daily counters if needed
 */
export function resetDailyCounters(state: BotState): void {
  const now = new Date();
  const elapsed = now.getTime() - state.dailyStartTime.getTime();
  
  if (elapsed >= 86400000) {
    // 24 hours
    state.dailyStartEquity = state.currentEquity;
    state.dailyStartTime = now;
  }
}
