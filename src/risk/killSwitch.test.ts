import { describe, it } from "node:test";
import assert from "node:assert";
import { checkKillSwitch } from "./killSwitch.js";
import type { BotState } from "../types.js";
import type { Config } from "../config.js";

describe("Kill Switch", () => {
  const baseState: BotState = {
    position: null,
    trades: [],
    currentDirection: "LONG",
    initialEquity: 10000,
    currentEquity: 10000,
    dailyStartEquity: 10000,
    dailyStartTime: new Date(),
    consecLosses: 0,
    consecErrors: 0,
    tradesThisHour: 0,
    hourStartTime: new Date(),
    lastTradeTime: null,
    tradingEnabled: true,
    killSwitchReason: null,
  };
  
  const baseConfig: Config = {
    rpcUrl: "test",
    mode: "quote",
    market: "BTC-PERP",
    maxLeverage: 50,
    marginPct: 2,
    tpBps: 10,
    slBps: 10,
    feeBps: 2.5,
    emaFast: 9,
    emaSlow: 21,
    tfSeconds: 15,
    priceSource: "index",
    cooldownMsPaper: 200,
    cooldownMsLive: 2000,
    maxDailyLossPct: 1.0,
    maxConsecLosses: 10,
    maxTradesPerHour: 120,
    maxConsecErrors: 20,
  };
  
  it("should not trigger when no limits exceeded", () => {
    const result = checkKillSwitch(baseState, baseConfig);
    assert.strictEqual(result.triggered, false);
    assert.strictEqual(result.reason, null);
  });
  
  it("should trigger on daily loss limit", () => {
    const state = {
      ...baseState,
      currentEquity: 9890, // Lost 110 = 1.1%
    };
    
    const result = checkKillSwitch(state, baseConfig);
    assert.strictEqual(result.triggered, true);
    assert.ok(result.reason?.includes("Daily loss"));
  });
  
  it("should trigger on consecutive losses", () => {
    const state = {
      ...baseState,
      consecLosses: 10,
    };
    
    const result = checkKillSwitch(state, baseConfig);
    assert.strictEqual(result.triggered, true);
    assert.ok(result.reason?.includes("Consecutive losses"));
  });
  
  it("should trigger on consecutive errors", () => {
    const state = {
      ...baseState,
      consecErrors: 20,
    };
    
    const result = checkKillSwitch(state, baseConfig);
    assert.strictEqual(result.triggered, true);
    assert.ok(result.reason?.includes("Consecutive errors"));
  });
  
  it("should trigger on trades per hour limit", () => {
    const state = {
      ...baseState,
      tradesThisHour: 120,
    };
    
    const result = checkKillSwitch(state, baseConfig);
    assert.strictEqual(result.triggered, true);
    assert.ok(result.reason?.includes("Trades this hour"));
  });
});
