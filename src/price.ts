import type { Config } from "./config.js";

/**
 * Simulated price provider for quote/paper modes
 * In a real implementation, this would fetch from Raydium API or on-chain data
 */
export class PriceProvider {
  private config: Config;
  private basePrice: number;
  private lastUpdate: Date;
  private volatility: number;
  
  constructor(config: Config) {
    this.config = config;
    // BTC starting price (simulated)
    this.basePrice = 45000;
    this.lastUpdate = new Date();
    this.volatility = 0.0001; // 0.01% volatility per update
  }
  
  /**
   * Get current index price
   * In quote/paper mode: simulated random walk
   * In live mode: fetch from configured price API
   */
  async getIndexPrice(): Promise<number> {
    if (this.config.mode === "quote" || this.config.mode === "paper") {
      return this.simulatePrice();
    }

    if (!this.config.priceApiUrl) {
      throw new Error("PRICE_API_URL is required in live mode");
    }

    const response = await fetch(this.config.priceApiUrl);
    if (!response.ok) {
      throw new Error(`Price API error: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as { price?: number };
    if (typeof payload.price !== "number") {
      throw new Error("Price API response missing numeric 'price' field");
    }
    return payload.price;
  }
  
  /**
   * Simulate price movement (random walk with small volatility)
   */
  private simulatePrice(): number {
    const now = new Date();
    const elapsed = now.getTime() - this.lastUpdate.getTime();
    
    // Update price based on elapsed time
    if (elapsed > 0) {
      // Random walk: price can go up or down
      const randomChange = (Math.random() - 0.5) * 2 * this.volatility;
      this.basePrice = this.basePrice * (1 + randomChange);
      this.lastUpdate = now;
    }
    
    return this.basePrice;
  }
  
  /**
   * Reset simulated price (for testing)
   */
  resetPrice(price: number): void {
    this.basePrice = price;
    this.lastUpdate = new Date();
  }
}
