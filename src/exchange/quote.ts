import type { Candle, Direction, Position } from "../types.js";
import type { ExchangeAdapter, OrderResult } from "./types.js";
import type { Config } from "../config.js";
import { PriceProvider } from "../price.js";

/**
 * Quote mode exchange adapter
 * Never places real orders, only logs what would happen
 */
export class QuoteExchangeAdapter implements ExchangeAdapter {
  private config: Config;
  private priceProvider: PriceProvider;
  
  constructor(config: Config) {
    this.config = config;
    this.priceProvider = new PriceProvider(config);
  }
  
  async getPrice(): Promise<number> {
    return this.priceProvider.getIndexPrice();
  }
  
  async getCandles(count: number): Promise<Candle[]> {
    // In quote mode, we don't have historical candles
    // Return empty array - the bot will build candles over time
    return [];
  }
  
  async placeMarketOrder(
    direction: Direction,
    size: number,
    leverage: number
  ): Promise<OrderResult> {
    const price = await this.getPrice();
    
    console.log(`[QUOTE] Would place ${direction} market order:`);
    console.log(`[QUOTE]   Size: ${size.toFixed(6)}`);
    console.log(`[QUOTE]   Leverage: ${leverage}x`);
    console.log(`[QUOTE]   Price: $${price.toFixed(2)}`);
    
    // Return simulated result
    return {
      orderId: `quote-${Date.now()}`,
      fillPrice: price,
      size,
      timestamp: new Date(),
    };
  }
  
  async closePosition(position: Position): Promise<OrderResult> {
    const price = await this.getPrice();
    
    console.log(`[QUOTE] Would close ${position.direction} position:`);
    console.log(`[QUOTE]   Entry: $${position.entryPrice.toFixed(2)}`);
    console.log(`[QUOTE]   Exit: $${price.toFixed(2)}`);
    console.log(`[QUOTE]   Size: ${position.size.toFixed(6)}`);
    
    // Return simulated result
    return {
      orderId: `quote-close-${Date.now()}`,
      fillPrice: price,
      size: position.size,
      timestamp: new Date(),
    };
  }
  
  async getPosition(): Promise<Position | null> {
    // Quote mode doesn't track real positions
    return null;
  }
}
