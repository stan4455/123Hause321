import type { Config } from "./config.js";
import type { BotState, Candle, Direction, Position, Trade } from "./types.js";
import { calculateEMA, determineTrend } from "./indicators/ema.js";
import {
  calculateTPSL,
  calculatePositionSize,
  calculatePnL,
  checkTPSL,
  flipDirection,
} from "./strategy/strategy.js";
import { checkKillSwitch } from "./risk/killSwitch.js";
import { checkCooldown, resetHourlyCounters, resetDailyCounters } from "./state/stateMachine.js";
import type { ExchangeAdapter } from "./exchange/types.js";
import { QuoteExchangeAdapter } from "./exchange/quote.js";
import { PaperExchangeAdapter } from "./exchange/paper.js";
import { LiveExchangeAdapter } from "./exchange/live.js";

/**
 * Raydium Perps Scalping Bot
 * 
 * Strategy: Flip-on-loss EMA-based scalping
 * - Uses EMA fast/slow crossover to determine initial trend bias
 * - First trade: follows trend direction (UP=LONG, DOWN=SHORT)
 * - After TP: continues in SAME direction (ignores trend changes)
 * - After SL: flips direction LONG<->SHORT (ignores trend changes)
 * - This creates a "flip-on-loss" pattern that continues until a TP occurs
 * 
 * Safety features:
 * - Kill switch for daily loss, consecutive losses, consecutive errors
 * - Trading rate limiter
 * - Mandatory cooldown between trades
 * - TP/SL at configurable basis points (default: 10 bps = 0.10%)
 */
export class RaydiumScalpingBot {
  private config: Config;
  private state: BotState;
  private exchange: ExchangeAdapter;
  private candles: Candle[];
  private running: boolean;
  
  constructor(config: Config, initialEquity: number = 10000) {
    this.config = config;
    this.exchange = RaydiumScalpingBot.createExchange(config);
    this.candles = [];
    this.running = false;
    
    const now = new Date();
    this.state = {
      position: null,
      trades: [],
      currentDirection: "LONG", // Will be set based on first trend signal
      initialEquity,
      currentEquity: initialEquity,
      dailyStartEquity: initialEquity,
      dailyStartTime: now,
      consecLosses: 0,
      consecErrors: 0,
      tradesThisHour: 0,
      hourStartTime: now,
      lastTradeTime: null,
      tradingEnabled: true,
      killSwitchReason: null,
    };
    
    console.log(`Bot initialized in ${config.mode} mode`);
    console.log(`Initial equity: $${initialEquity}`);
    console.log(`Market: ${config.market}`);
    console.log(`Strategy: EMA(${config.emaFast})/EMA(${config.emaSlow}) on ${config.tfSeconds}s candles`);
    console.log(`TP: ${config.tpBps}bps, SL: ${config.slBps}bps`);
    console.log(`Max leverage: ${config.maxLeverage}x, Margin: ${config.marginPct}%`);
  }

  private static createExchange(config: Config): ExchangeAdapter {
    switch (config.mode) {
      case "quote":
        return new QuoteExchangeAdapter(config);
      case "paper":
        return new PaperExchangeAdapter(config);
      case "live":
        return new LiveExchangeAdapter(config);
      default:
        return new QuoteExchangeAdapter(config);
    }
  }
  
  /**
   * Start the bot
   */
  async start(): Promise<void> {
    this.running = true;
    console.log("\n=== Bot started ===\n");
    
    // Main loop
    while (this.running) {
      try {
        await this.tick();
      } catch (error) {
        console.error("Error in bot loop:", error);
        this.state.consecErrors++;
        
        // Check if we should kill switch due to errors
        const killSwitch = checkKillSwitch(this.state, this.config);
        if (killSwitch.triggered) {
          this.disableTrading(killSwitch.reason!);
        }
      }
      
      // Sleep for the configured timeframe
      await this.sleep(this.config.tfSeconds * 1000);
    }
    
    console.log("\n=== Bot stopped ===\n");
  }
  
  /**
   * Stop the bot
   */
  stop(): void {
    this.running = false;
  }
  
  /**
   * Main bot tick - executed every timeframe
   */
  private async tick(): Promise<void> {
    // Get current price
    const currentPrice = await this.exchange.getPrice();
    const now = new Date();
    
    // Add candle
    this.candles.push({ timestamp: now, price: currentPrice });
    
    // Keep only necessary candles (we need at least emaSlow candles)
    const maxCandles = Math.max(this.config.emaFast, this.config.emaSlow) * 2;
    if (this.candles.length > maxCandles) {
      this.candles = this.candles.slice(-maxCandles);
    }
    
    // Calculate EMAs
    const emaFast = calculateEMA(this.candles, this.config.emaFast);
    const emaSlow = calculateEMA(this.candles, this.config.emaSlow);
    const trend = determineTrend(emaFast, emaSlow);
    
    // Log current state
    this.logState(currentPrice, emaFast, emaSlow, trend);
    
    // Check if we have an open position
    if (this.state.position) {
      await this.managePosition(currentPrice);
    } else {
      // No position - check if we should open one
      if (this.state.tradingEnabled && trend !== "NEUTRAL") {
        await this.considerNewTrade(currentPrice, trend);
      }
    }
    
    // Reset hourly counters if needed
    resetHourlyCounters(this.state);
    
    // Reset daily counters if needed
    resetDailyCounters(this.state);
  }
  
  /**
   * Manage existing position - check TP/SL
   */
  private async managePosition(currentPrice: number): Promise<void> {
    const position = this.state.position!;
    const { hitTp, hitSl } = checkTPSL(position, currentPrice);
    
    if (hitTp) {
      await this.closePosition(currentPrice, true, false);
      // After TP, continue in same direction
      console.log(`✓ TP hit! Continuing in ${this.state.currentDirection} direction`);
    } else if (hitSl) {
      await this.closePosition(currentPrice, false, true);
      // After SL, flip direction
      this.state.currentDirection = flipDirection(this.state.currentDirection);
      console.log(`✗ SL hit! Flipping to ${this.state.currentDirection} direction`);
    }
  }
  
  /**
   * Consider opening a new trade
   */
  private async considerNewTrade(
    currentPrice: number,
    trend: "UP" | "DOWN" | "NEUTRAL"
  ): Promise<void> {
    // Check cooldown
    if (!checkCooldown(this.state, this.config)) {
      return;
    }
    
    // Check kill switch
    const killSwitch = checkKillSwitch(this.state, this.config);
    if (killSwitch.triggered) {
      this.disableTrading(killSwitch.reason!);
      return;
    }
    
    // Determine direction based on strategy:
    // - First trade: use trend direction
    // - After TP: continue in same direction (ignore trend)
    // - After SL: use flipped direction (ignore trend)
    let direction: Direction;
    
    if (this.state.trades.length === 0) {
      // First trade: use trend
      direction = trend === "UP" ? "LONG" : "SHORT";
      this.state.currentDirection = direction;
    } else {
      // Subsequent trades: use currentDirection (set by flip-on-loss logic)
      direction = this.state.currentDirection;
    }
    
    await this.openPosition(currentPrice, direction);
  }
  
  /**
   * Open a new position
   */
  private async openPosition(price: number, direction: Direction): Promise<void> {
    const { margin, size } = calculatePositionSize(
      this.state.currentEquity,
      this.config.marginPct,
      this.config.maxLeverage,
      price
    );
    
    const { tpPrice, slPrice } = calculateTPSL(
      direction,
      price,
      this.config.tpBps,
      this.config.slBps
    );
    
    const orderResult = await this.exchange.placeMarketOrder(
      direction,
      size,
      this.config.maxLeverage
    );
    const entryPrice = orderResult.fillPrice;
    const adjustedTargets = calculateTPSL(
      direction,
      entryPrice,
      this.config.tpBps,
      this.config.slBps
    );

    this.state.position = {
      direction,
      entryPrice,
      size,
      margin,
      leverage: this.config.maxLeverage,
      tpPrice: adjustedTargets.tpPrice,
      slPrice: adjustedTargets.slPrice,
      openedAt: new Date(),
    };
    
    this.state.lastTradeTime = new Date();
    this.state.tradesThisHour++;
    
    console.log(`\n>>> OPEN ${direction} position @ $${entryPrice.toFixed(2)}`);
    console.log(`    Size: ${size.toFixed(6)}, Margin: $${margin.toFixed(2)}, Leverage: ${this.config.maxLeverage}x`);
    console.log(
      `    TP: $${adjustedTargets.tpPrice.toFixed(2)}, SL: $${adjustedTargets.slPrice.toFixed(2)}`
    );
  }
  
  /**
   * Close current position
   */
  private async closePosition(
    exitPrice: number,
    hitTp: boolean,
    hitSl: boolean
  ): Promise<void> {
    const position = this.state.position!;
    const closeResult = await this.exchange.closePosition(position);
    const exitFillPrice = closeResult.fillPrice;
    const { pnl, pnlPct } = calculatePnL(position, exitFillPrice, this.config.feeBps);
    
    // Update equity
    this.state.currentEquity += pnl;
    
    // Record trade
    const trade: Trade = {
      direction: position.direction,
      entryPrice: position.entryPrice,
      exitPrice,
      size: position.size,
      pnl,
      pnlPct,
      hitTp,
      hitSl,
      timestamp: new Date(),
    };
    this.state.trades.push(trade);
    
    // Update consecutive losses counter
    if (hitTp) {
      this.state.consecLosses = 0;
      this.state.consecErrors = 0; // Reset errors on success
    } else if (hitSl) {
      this.state.consecLosses++;
    }
    
    console.log(
      `\n<<< CLOSE ${position.direction} position @ $${exitFillPrice.toFixed(2)}`
    );
    console.log(`    PnL: $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`);
    console.log(`    Equity: $${this.state.currentEquity.toFixed(2)}`);
    console.log(`    ${hitTp ? "✓ TP" : "✗ SL"} | Consec losses: ${this.state.consecLosses}`);
    
    // Clear position
    this.state.position = null;
    this.state.lastTradeTime = new Date();
  }
  
  /**
   * Disable trading (kill switch)
   */
  private disableTrading(reason: string): void {
    if (this.state.tradingEnabled) {
      this.state.tradingEnabled = false;
      this.state.killSwitchReason = reason;
      console.log(`\n!!! KILL SWITCH ACTIVATED: ${reason} !!!`);
      console.log(`Trading disabled. Bot will continue monitoring but not trade.`);
    }
  }
  
  /**
   * Log current state
   */
  private logState(
    price: number,
    emaFast: number | null,
    emaSlow: number | null,
    trend: "UP" | "DOWN" | "NEUTRAL"
  ): void {
    const timestamp = new Date().toISOString();
    const emaFastStr = emaFast !== null ? emaFast.toFixed(2) : "N/A";
    const emaSlowStr = emaSlow !== null ? emaSlow.toFixed(2) : "N/A";
    const posStr = this.state.position
      ? `${this.state.position.direction} @ ${this.state.position.entryPrice.toFixed(2)}`
      : "None";
    
    console.log(
      `[${timestamp}] Price: $${price.toFixed(2)} | ` +
      `EMA${this.config.emaFast}: ${emaFastStr} | ` +
      `EMA${this.config.emaSlow}: ${emaSlowStr} | ` +
      `Trend: ${trend} | ` +
      `Pos: ${posStr} | ` +
      `Equity: $${this.state.currentEquity.toFixed(2)}`
    );
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  /**
   * Get current state (for testing/monitoring)
   */
  getState(): Readonly<BotState> {
    return this.state;
  }
  
  /**
   * Get performance stats
   */
  getStats(): {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    totalPnLPct: number;
  } {
    const totalTrades = this.state.trades.length;
    const winningTrades = this.state.trades.filter((t) => t.hitTp).length;
    const losingTrades = this.state.trades.filter((t) => t.hitSl).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalPnL = this.state.currentEquity - this.state.initialEquity;
    const totalPnLPct = (totalPnL / this.state.initialEquity) * 100;
    
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnL,
      totalPnLPct,
    };
  }
}
