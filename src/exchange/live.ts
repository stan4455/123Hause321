import type { Candle, Direction, Position } from "../types.js";
import type { ExchangeAdapter, OrderResult } from "./types.js";
import type { Config } from "../config.js";
import { PriceProvider } from "../price.js";

export type LiveMode = "real" | "stub";

/**
 * Live mode exchange adapter
 * - stub: no real trades, logs actions but acts as if orders are filled
 * - real: placeholder for real Raydium Perps integration
 */
export class LiveExchangeAdapter implements ExchangeAdapter {
  private config: Config;
  private priceProvider: PriceProvider;
  private currentPosition: Position | null = null;
  private mode: LiveMode;

  constructor(config: Config) {
    this.config = config;
    this.mode = this.resolveMode();
    // Use simulated prices in stub mode, otherwise real prices (when implemented)
    this.priceProvider = new PriceProvider(config, this.mode === "stub");
  }

  async getPrice(): Promise<number> {
    return this.priceProvider.getIndexPrice();
  }

  async getCandles(count: number): Promise<Candle[]> {
    return [];
  }

  async placeMarketOrder(
    direction: Direction,
    size: number,
    leverage: number
  ): Promise<OrderResult> {
    const price = await this.getPrice();

    if (this.mode === "real") {
      throw new Error(
        "Live trading integration is not yet implemented. Set LIVE_MODE=stub for simulated live mode."
      );
    }

    console.log(`[LIVE-STUB] Placing ${direction} market order:`);
    console.log(`[LIVE-STUB]   Size: ${size.toFixed(6)}`);
    console.log(`[LIVE-STUB]   Leverage: ${leverage}x`);
    console.log(`[LIVE-STUB]   Price: $${price.toFixed(2)}`);

    return {
      orderId: `live-stub-${Date.now()}`,
      fillPrice: price,
      size,
      timestamp: new Date(),
    };
  }

  async closePosition(position: Position): Promise<OrderResult> {
    const price = await this.getPrice();

    if (this.mode === "real") {
      throw new Error(
        "Live trading integration is not yet implemented. Set LIVE_MODE=stub for simulated live mode."
      );
    }

    console.log(`[LIVE-STUB] Closing ${position.direction} position:`);
    console.log(`[LIVE-STUB]   Entry: $${position.entryPrice.toFixed(2)}`);
    console.log(`[LIVE-STUB]   Exit: $${price.toFixed(2)}`);
    console.log(`[LIVE-STUB]   Size: ${position.size.toFixed(6)}`);

    this.currentPosition = null;

    return {
      orderId: `live-stub-close-${Date.now()}`,
      fillPrice: price,
      size: position.size,
      timestamp: new Date(),
    };
  }

  async getPosition(): Promise<Position | null> {
    return this.currentPosition;
  }

  setPosition(position: Position | null): void {
    this.currentPosition = position;
  }

  private resolveMode(): LiveMode {
    const raw = process.env.LIVE_MODE ?? "";
    if (raw === "real" || raw === "stub") {
      return raw;
    }

    if (raw.length > 0) {
      console.warn(
        `Invalid LIVE_MODE value: ${raw}. Falling back to stub (no real trades).`
      );
    }

    return "stub";
  }
}
