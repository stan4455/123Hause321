import type { Candle, Direction, Position } from "../types.js";

/**
 * Order result
 */
export interface OrderResult {
  orderId: string;
  fillPrice: number;
  size: number;
  timestamp: Date;
}

/**
 * Exchange adapter interface
 * Abstracts away the exchange implementation for quote/paper/live modes
 */
export interface ExchangeAdapter {
  /**
   * Get current index price
   */
  getPrice(): Promise<number>;
  
  /**
   * Get recent candles
   */
  getCandles(count: number): Promise<Candle[]>;
  
  /**
   * Place a market order
   */
  placeMarketOrder(
    direction: Direction,
    size: number,
    leverage: number
  ): Promise<OrderResult>;
  
  /**
   * Close current position
   */
  closePosition(position: Position): Promise<OrderResult>;
  
  /**
   * Get current position (if any)
   */
  getPosition(): Promise<Position | null>;
}
