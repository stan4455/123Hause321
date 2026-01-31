#!/usr/bin/env node

// Demonstration of the bot with more volatile price movements
import { loadConfig } from "./config.js";
import { RaydiumScalpingBot } from "./bot.js";

console.log("=== Raydium Scalping Bot Demo ===\n");
console.log("This demo shows the flip-on-loss strategy in action.");
console.log("We'll use tighter TP/SL to trigger more trades.\n");

// Override config for demonstration
process.env.TF_SECONDS = "1";
process.env.EMA_FAST = "3";
process.env.EMA_SLOW = "5";
process.env.TP_BPS = "5"; // 0.05% TP (tighter)
process.env.SL_BPS = "5"; // 0.05% SL (tighter)
process.env.COOLDOWN_MS_PAPER = "100";

const config = loadConfig();
const bot = new RaydiumScalpingBot(config, 10000);

// Run for 45 seconds
setTimeout(() => {
  bot.stop();
  
  const stats = bot.getStats();
  const state = bot.getState();
  
  console.log("\n" + "=".repeat(60));
  console.log("FINAL RESULTS");
  console.log("=".repeat(60));
  console.log(`Total trades: ${stats.totalTrades}`);
  console.log(`Winning trades: ${stats.winningTrades}`);
  console.log(`Losing trades: ${stats.losingTrades}`);
  console.log(`Win rate: ${stats.winRate.toFixed(2)}%`);
  console.log(`Total PnL: $${stats.totalPnL.toFixed(2)} (${stats.totalPnLPct.toFixed(2)}%)`);
  console.log(`Final equity: $${state.currentEquity.toFixed(2)}`);
  console.log(`Consecutive losses: ${state.consecLosses}`);
  console.log(`Current direction: ${state.currentDirection}`);
  console.log("=".repeat(60));
  
  if (stats.totalTrades > 0) {
    console.log("\n✓ Demo successful! The bot traded and managed positions.");
    
    // Show trade history
    console.log("\nTrade History:");
    state.trades.forEach((trade, i) => {
      const result = trade.hitTp ? "TP ✓" : "SL ✗";
      console.log(
        `  ${i + 1}. ${trade.direction} @ $${trade.entryPrice.toFixed(2)} -> $${trade.exitPrice.toFixed(2)} | ` +
        `${result} | PnL: $${trade.pnl.toFixed(2)}`
      );
    });
  } else {
    console.log("\nℹ No trades completed (price volatility may be too low)");
  }
  
  process.exit(0);
}, 45000);

bot.start().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
