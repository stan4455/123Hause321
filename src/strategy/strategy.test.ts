import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateTPSL,
  calculatePositionSize,
  calculatePnL,
  checkTPSL,
  flipDirection,
} from "./strategy.js";
import type { Position } from "../types.js";

describe("TP/SL Calculation", () => {
  it("should calculate LONG TP/SL correctly", () => {
    const result = calculateTPSL("LONG", 100, 10, 10);
    
    // TP should be 0.10% above entry
    assert.strictEqual(result.tpPrice, 100.1);
    // SL should be 0.10% below entry
    assert.strictEqual(result.slPrice, 99.9);
  });
  
  it("should calculate SHORT TP/SL correctly", () => {
    const result = calculateTPSL("SHORT", 100, 10, 10);
    
    // TP should be 0.10% below entry
    assert.strictEqual(result.tpPrice, 99.9);
    // SL should be 0.10% above entry
    assert.strictEqual(result.slPrice, 100.1);
  });
});

describe("Position Size Calculation", () => {
  it("should calculate position size correctly", () => {
    const result = calculatePositionSize(10000, 2, 50, 100);
    
    // Margin should be 2% of equity
    assert.strictEqual(result.margin, 200);
    // Notional should be margin * leverage
    // Size should be notional / price = 200 * 50 / 100 = 100
    assert.strictEqual(result.size, 100);
  });
});

describe("PnL Calculation", () => {
  it("should calculate LONG profit correctly", () => {
    const position: Position = {
      direction: "LONG",
      entryPrice: 100,
      size: 10,
      margin: 200,
      leverage: 50,
      tpPrice: 100.1,
      slPrice: 99.9,
      openedAt: new Date(),
    };
    
    const result = calculatePnL(position, 100.1, 2.5);
    
    // Price diff: 0.1, size: 10 => gross PnL: 1
    // Fees: (100 * 10 * 2 * 2.5) / 10000 = 0.5
    // Net PnL: 1 - 0.5 = 0.5
    assert.ok(Math.abs(result.pnl - 0.5) < 0.01);
    
    // PnL %: (0.5 / 200) * 100 = 0.25%
    assert.ok(Math.abs(result.pnlPct - 0.25) < 0.01);
  });
  
  it("should calculate SHORT profit correctly", () => {
    const position: Position = {
      direction: "SHORT",
      entryPrice: 100,
      size: 10,
      margin: 200,
      leverage: 50,
      tpPrice: 99.9,
      slPrice: 100.1,
      openedAt: new Date(),
    };
    
    const result = calculatePnL(position, 99.9, 2.5);
    
    // Price diff: 0.1, size: 10 => gross PnL: 1
    // Fees: (100 * 10 * 2 * 2.5) / 10000 = 0.5
    // Net PnL: 1 - 0.5 = 0.5
    assert.ok(Math.abs(result.pnl - 0.5) < 0.01);
  });
});

describe("TP/SL Hit Check", () => {
  it("should detect LONG TP hit", () => {
    const position: Position = {
      direction: "LONG",
      entryPrice: 100,
      size: 10,
      margin: 200,
      leverage: 50,
      tpPrice: 100.1,
      slPrice: 99.9,
      openedAt: new Date(),
    };
    
    const result = checkTPSL(position, 100.15);
    assert.strictEqual(result.hitTp, true);
    assert.strictEqual(result.hitSl, false);
  });
  
  it("should detect LONG SL hit", () => {
    const position: Position = {
      direction: "LONG",
      entryPrice: 100,
      size: 10,
      margin: 200,
      leverage: 50,
      tpPrice: 100.1,
      slPrice: 99.9,
      openedAt: new Date(),
    };
    
    const result = checkTPSL(position, 99.85);
    assert.strictEqual(result.hitTp, false);
    assert.strictEqual(result.hitSl, true);
  });
  
  it("should detect SHORT TP hit", () => {
    const position: Position = {
      direction: "SHORT",
      entryPrice: 100,
      size: 10,
      margin: 200,
      leverage: 50,
      tpPrice: 99.9,
      slPrice: 100.1,
      openedAt: new Date(),
    };
    
    const result = checkTPSL(position, 99.85);
    assert.strictEqual(result.hitTp, true);
    assert.strictEqual(result.hitSl, false);
  });
});

describe("Direction Flip", () => {
  it("should flip LONG to SHORT", () => {
    assert.strictEqual(flipDirection("LONG"), "SHORT");
  });
  
  it("should flip SHORT to LONG", () => {
    assert.strictEqual(flipDirection("SHORT"), "LONG");
  });
});
