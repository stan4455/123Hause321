import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateEMA, determineTrend } from "./ema.js";
import type { Candle } from "../types.js";

describe("EMA Indicator", () => {
  it("should return null when insufficient candles", () => {
    const candles: Candle[] = [
      { timestamp: new Date(), price: 100 },
      { timestamp: new Date(), price: 101 },
    ];
    
    const result = calculateEMA(candles, 5);
    assert.strictEqual(result, null);
  });
  
  it("should calculate EMA correctly with sufficient data", () => {
    const candles: Candle[] = [
      { timestamp: new Date(), price: 100 },
      { timestamp: new Date(), price: 102 },
      { timestamp: new Date(), price: 104 },
      { timestamp: new Date(), price: 103 },
      { timestamp: new Date(), price: 105 },
    ];
    
    const result = calculateEMA(candles, 3);
    assert.notStrictEqual(result, null);
    assert.ok(result! > 100 && result! < 110);
  });
  
  it("should handle price trends correctly", () => {
    // Uptrend
    const upCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(),
      price: 100 + i * 2,
    }));
    
    const upEma = calculateEMA(upCandles, 5);
    assert.ok(upEma! > 105);
  });
});

describe("Trend Determination", () => {
  it("should return NEUTRAL when either EMA is null", () => {
    assert.strictEqual(determineTrend(null, 100), "NEUTRAL");
    assert.strictEqual(determineTrend(100, null), "NEUTRAL");
    assert.strictEqual(determineTrend(null, null), "NEUTRAL");
  });
  
  it("should return UP when fast EMA > slow EMA", () => {
    assert.strictEqual(determineTrend(105, 100), "UP");
  });
  
  it("should return DOWN when fast EMA < slow EMA", () => {
    assert.strictEqual(determineTrend(95, 100), "DOWN");
  });
  
  it("should return NEUTRAL when fast EMA = slow EMA", () => {
    assert.strictEqual(determineTrend(100, 100), "NEUTRAL");
  });
});
