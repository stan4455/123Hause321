import { loadConfig } from "./config.js";
import { RaydiumScalpingBot } from "./bot.js";

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Raydium Perps Scalping Bot");
  console.log("=".repeat(60));
  
  try {
    // Load configuration
    const config = loadConfig();
    
    // Create bot instance
    const bot = new RaydiumScalpingBot(config);
    
    // Handle graceful shutdown
    const shutdown = (): void => {
      console.log("\nShutdown signal received...");
      bot.stop();
      
      // Print final stats
      const stats = bot.getStats();
      console.log("\n" + "=".repeat(60));
      console.log("Final Statistics");
      console.log("=".repeat(60));
      console.log(`Total trades: ${stats.totalTrades}`);
      console.log(`Winning trades: ${stats.winningTrades}`);
      console.log(`Losing trades: ${stats.losingTrades}`);
      console.log(`Win rate: ${stats.winRate.toFixed(2)}%`);
      console.log(`Total PnL: $${stats.totalPnL.toFixed(2)} (${stats.totalPnLPct.toFixed(2)}%)`);
      console.log("=".repeat(60));
      
      process.exit(0);
    };
    
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    
    // Start bot
    await bot.start();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();

