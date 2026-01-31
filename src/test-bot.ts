#!/usr/bin/env node

// Quick test to verify the bot logic works correctly
import { loadConfig } from "./config.js";
import { RaydiumScalpingBot } from "./bot.js";

console.log("=== Quick Bot Test (fast mode) ===\n");

// Override config for faster testing
process.env.TF_SECONDS = "1"; // 1 second candles
process.env.EMA_FAST = "3";
process.env.EMA_SLOW = "5";
process.env.COOLDOWN_MS_PAPER = "100";

const config = loadConfig();
const bot = new RaydiumScalpingBot(config, 10000);

// Run for 30 seconds
setTimeout(() => {
  bot.stop();
  
  const stats = bot.getStats();
  console.log("\n=== Test Results ===");
  console.log(`Total trades: ${stats.totalTrades}`);
  console.log(`Win rate: ${stats.winRate.toFixed(2)}%`);
  console.log(`Total PnL: $${stats.totalPnL.toFixed(2)} (${stats.totalPnLPct.toFixed(2)}%)`);
  
  if (stats.totalTrades > 0) {
    console.log("✓ Bot is trading successfully!");
  } else {
    console.log("ℹ No trades yet (may need more time for EMAs to form trend)");
  }
  
  process.exit(0);
}, 30000);

bot.start().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
