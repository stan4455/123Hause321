import type { BotState } from "../types.js";
import type { Config } from "../config.js";

/**
 * Kill switch result
 */
export interface KillSwitchResult {
  triggered: boolean;
  reason: string | null;
}

/**
 * Check if kill switch should be triggered
 */
export function checkKillSwitch(
  state: BotState,
  config: Config
): KillSwitchResult {
  // Daily loss check
  const dailyLossPct =
    ((state.dailyStartEquity - state.currentEquity) / state.dailyStartEquity) *
    100;
  if (dailyLossPct >= config.maxDailyLossPct) {
    return {
      triggered: true,
      reason: `Daily loss ${dailyLossPct.toFixed(2)}% >= ${config.maxDailyLossPct}%`,
    };
  }
  
  // Consecutive losses check
  if (state.consecLosses >= config.maxConsecLosses) {
    return {
      triggered: true,
      reason: `Consecutive losses ${state.consecLosses} >= ${config.maxConsecLosses}`,
    };
  }
  
  // Consecutive errors check
  if (state.consecErrors >= config.maxConsecErrors) {
    return {
      triggered: true,
      reason: `Consecutive errors ${state.consecErrors} >= ${config.maxConsecErrors}`,
    };
  }
  
  // Trades per hour check
  if (state.tradesThisHour >= config.maxTradesPerHour) {
    return {
      triggered: true,
      reason: `Trades this hour ${state.tradesThisHour} >= ${config.maxTradesPerHour}`,
    };
  }
  
  return { triggered: false, reason: null };
}
