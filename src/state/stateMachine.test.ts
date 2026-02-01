import { describe, it } from "node:test";
import assert from "node:assert";
import { checkCooldown, resetHourlyCounters, resetDailyCounters } from "./stateMachine.js";
import type { BotState } from "../types.js";
import type { Config } from "../config.js";

describe("State Machine - Cooldown", () => {
  const baseConfig: Config = {
    rpcUrl: "test",
    mode: "paper",
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
  
  it("should allow trade when no previous trade", () => {
    const state: BotState = {
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
    
    const result = checkCooldown(state, baseConfig);
    assert.strictEqual(result, true);
  });
  
  it("should enforce paper mode cooldown", () => {
    const state: BotState = {
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
      lastTradeTime: new Date(Date.now() - 100), // 100ms ago
      tradingEnabled: true,
      killSwitchReason: null,
    };
    
    const result = checkCooldown(state, baseConfig);
    assert.strictEqual(result, false);
  });
  
  it("should allow trade after cooldown elapsed", () => {
    const state: BotState = {
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
      lastTradeTime: new Date(Date.now() - 300), // 300ms ago
      tradingEnabled: true,
      killSwitchReason: null,
    };
    
    const result = checkCooldown(state, baseConfig);
    assert.strictEqual(result, true);
  });
});

describe("State Machine - Counter Resets", () => {
  it("should reset hourly counters after 1 hour", () => {
    const state: BotState = {
      position: null,
      trades: [],
      currentDirection: "LONG",
      initialEquity: 10000,
      currentEquity: 10000,
      dailyStartEquity: 10000,
      dailyStartTime: new Date(),
      consecLosses: 0,
      consecErrors: 0,
      tradesThisHour: 50,
      hourStartTime: new Date(Date.now() - 3600001), // Just over 1 hour ago
      lastTradeTime: null,
      tradingEnabled: true,
      killSwitchReason: null,
    };
    
    resetHourlyCounters(state);
    assert.strictEqual(state.tradesThisHour, 0);
  });
  
  it("should not reset hourly counters before 1 hour", () => {
    const state: BotState = {
      position: null,
      trades: [],
      currentDirection: "LONG",
      initialEquity: 10000,
      currentEquity: 10000,
      dailyStartEquity: 10000,
      dailyStartTime: new Date(),
      consecLosses: 0,
      consecErrors: 0,
      tradesThisHour: 50,
      hourStartTime: new Date(Date.now() - 1800000), // 30 minutes ago
      lastTradeTime: null,
      tradingEnabled: true,
      killSwitchReason: null,
    };
    
    resetHourlyCounters(state);
    assert.strictEqual(state.tradesThisHour, 50);
  });
  
  it("should reset daily equity after 24 hours", () => {
    const state: BotState = {
      position: null,
      trades: [],
      currentDirection: "LONG",
      initialEquity: 10000,
      currentEquity: 10500,
      dailyStartEquity: 10000,
      dailyStartTime: new Date(Date.now() - 86400001), // Just over 24 hours ago
      consecLosses: 0,
      consecErrors: 0,
      tradesThisHour: 0,
      hourStartTime: new Date(),
      lastTradeTime: null,
      tradingEnabled: true,
      killSwitchReason: null,
    };
    
    resetDailyCounters(state);
    assert.strictEqual(state.dailyStartEquity, 10500);
  });
});
