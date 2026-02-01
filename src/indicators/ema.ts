import type { Candle } from "../types.js";

/**
 * Calculate Exponential Moving Average (EMA)
 * @param candles Array of candles (must be in chronological order)
 * @param period EMA period
 * @returns Current EMA value or null if insufficient data
 */
export function calculateEMA(candles: Candle[], period: number): number | null {
  if (candles.length < period) {
    return null;
  }
  
  // Calculate multiplier
  const multiplier = 2 / (period + 1);
  
  // Initialize with SMA for first 'period' values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].price;
  }
  let ema = sum / period;
  
  // Calculate EMA for remaining values
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].price - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Determine trend based on EMA values
 * @param emaFast Fast EMA value
 * @param emaSlow Slow EMA value
 * @returns "UP" if fast > slow, "DOWN" if fast < slow, "NEUTRAL" if equal
 */
export function determineTrend(
  emaFast: number | null,
  emaSlow: number | null
): "UP" | "DOWN" | "NEUTRAL" {
  if (emaFast === null || emaSlow === null) {
    return "NEUTRAL";
  }
  
  if (emaFast > emaSlow) {
    return "UP";
  } else if (emaFast < emaSlow) {
    return "DOWN";
  } else {
    return "NEUTRAL";
  }
}
