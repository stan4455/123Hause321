import type { Config } from "./config.js";
import type { BotState, Direction, Position } from "./types.js";

/**
 * Calculate TP and SL prices for a position
 */
export function calculateTPSL(
  direction: Direction,
  entryPrice: number,
  tpBps: number,
  slBps: number
): { tpPrice: number; slPrice: number } {
  if (direction === "LONG") {
    return {
      tpPrice: entryPrice * (1 + tpBps / 10000),
      slPrice: entryPrice * (1 - slBps / 10000),
    };
  } else {
    return {
      tpPrice: entryPrice * (1 - tpBps / 10000),
      slPrice: entryPrice * (1 + slBps / 10000),
    };
  }
}

/**
 * Calculate position size based on equity and margin percentage
 */
export function calculatePositionSize(
  equity: number,
  marginPct: number,
  leverage: number,
  price: number
): { margin: number; size: number } {
  const margin = (equity * marginPct) / 100;
  const notional = margin * leverage;
  const size = notional / price;
  
  return { margin, size };
}

/**
 * Calculate PnL for a position at a given exit price
 */
export function calculatePnL(
  position: Position,
  exitPrice: number,
  feeBps: number
): { pnl: number; pnlPct: number } {
  const notional = position.size * position.entryPrice;
  
  let priceDiff: number;
  if (position.direction === "LONG") {
    priceDiff = exitPrice - position.entryPrice;
  } else {
    priceDiff = position.entryPrice - exitPrice;
  }
  
  const grossPnl = priceDiff * position.size;
  
  // Deduct fees (entry + exit)
  const totalFees = (notional * 2 * feeBps) / 10000;
  const pnl = grossPnl - totalFees;
  
  // PnL percentage relative to margin
  const pnlPct = (pnl / position.margin) * 100;
  
  return { pnl, pnlPct };
}

/**
 * Check if TP or SL has been hit
 */
export function checkTPSL(
  position: Position,
  currentPrice: number
): { hitTp: boolean; hitSl: boolean } {
  if (position.direction === "LONG") {
    return {
      hitTp: currentPrice >= position.tpPrice,
      hitSl: currentPrice <= position.slPrice,
    };
  } else {
    return {
      hitTp: currentPrice <= position.tpPrice,
      hitSl: currentPrice >= position.slPrice,
    };
  }
}

/**
 * Flip direction (for flip-on-loss logic)
 */
export function flipDirection(direction: Direction): Direction {
  return direction === "LONG" ? "SHORT" : "LONG";
}

/**
 * Check if kill switch should be triggered
 */
export function checkKillSwitch(
  state: BotState,
  config: Config
): { triggered: boolean; reason: string | null } {
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
