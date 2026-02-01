import type { Candle, Direction, Position } from "../types.js";
import type { ExchangeAdapter, OrderResult } from "./types.js";
import type { Config } from "../config.js";
import { PriceProvider } from "../price.js";

/**
 * Paper mode exchange adapter
 * Simulates fills using a price feed with configurable fees and slippage
 */
export class PaperExchangeAdapter implements ExchangeAdapter {
  private config: Config;
  private priceProvider: PriceProvider;
  private currentPosition: Position | null = null;
  private slippageBps: number = 1; // 0.01% slippage
  
  constructor(config: Config) {
    this.config = config;
    this.priceProvider = new PriceProvider(config);
  }
  
  async getPrice(): Promise<number> {
    return this.priceProvider.getIndexPrice();
  }
  
  async getCandles(count: number): Promise<Candle[]> {
    // In paper mode, we don't have historical candles
    // Return empty array - the bot will build candles over time
    return [];
  }
  
  async placeMarketOrder(
    direction: Direction,
    size: number,
    leverage: number
  ): Promise<OrderResult> {
    const basePrice = await this.getPrice();
    
    // Apply slippage (worse price for taker orders)
    const slippage = direction === "LONG" ? 1 : -1;
    const fillPrice = basePrice * (1 + (slippage * this.slippageBps) / 10000);
    
    console.log(`[PAPER] Simulated ${direction} market order fill:`);
    console.log(`[PAPER]   Base price: $${basePrice.toFixed(2)}`);
    console.log(`[PAPER]   Fill price: $${fillPrice.toFixed(2)} (with slippage)`);
    console.log(`[PAPER]   Size: ${size.toFixed(6)}`);
    console.log(`[PAPER]   Leverage: ${leverage}x`);
    
    return {
      orderId: `paper-${Date.now()}`,
      fillPrice,
      size,
      timestamp: new Date(),
    };
  }
  
  async closePosition(position: Position): Promise<OrderResult> {
    const basePrice = await this.getPrice();
    
    // Apply slippage (worse price for taker orders)
    const slippage = position.direction === "LONG" ? -1 : 1;
    const fillPrice = basePrice * (1 + (slippage * this.slippageBps) / 10000);
    
    console.log(`[PAPER] Simulated close ${position.direction} position:`);
    console.log(`[PAPER]   Entry: $${position.entryPrice.toFixed(2)}`);
    console.log(`[PAPER]   Base exit price: $${basePrice.toFixed(2)}`);
    console.log(`[PAPER]   Fill price: $${fillPrice.toFixed(2)} (with slippage)`);
    console.log(`[PAPER]   Size: ${position.size.toFixed(6)}`);
    
    this.currentPosition = null;
    
    return {
      orderId: `paper-close-${Date.now()}`,
      fillPrice,
      size: position.size,
      timestamp: new Date(),
    };
  }
  
  async getPosition(): Promise<Position | null> {
    return this.currentPosition;
  }
  
  /**
   * Set the current position (for state tracking)
   */
  setPosition(position: Position | null): void {
    this.currentPosition = position;
  }
}
