import dotenv from "dotenv";

// Load .env file
dotenv.config();

export interface Config {
  // Connection
  rpcUrl: string;
  
  // Mode
  mode: "quote" | "paper" | "live";
  
  // Market
  market: string;
  maxLeverage: number;
  
  // Strategy
  marginPct: number;
  tpBps: number;
  slBps: number;
  feeBps: number;
  emaFast: number;
  emaSlow: number;
  tfSeconds: number;
  priceSource: "index" | "mark";
  
  // Cooldown
  cooldownMsPaper: number;
  cooldownMsLive: number;

  // Live pricing
  priceApiUrl?: string;
  
  // Kill switch
  maxDailyLossPct: number;
  maxConsecLosses: number;
  maxTradesPerHour: number;
  maxConsecErrors: number;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value ?? defaultValue!;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required env var: ${key}`);
    }
    return defaultValue;
  }
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Invalid number for env var ${key}: ${value}`);
  }
  return num;
}

export function loadConfig(): Config {
  const mode = getEnv("MODE", "quote");
  if (!["quote", "paper", "live"].includes(mode)) {
    throw new Error(`Invalid MODE: ${mode}. Must be quote, paper, or live.`);
  }
  
  // Safety check: Live trading requires explicit LIVE_TRADING=1 flag
  if (mode === "live") {
    const liveTradingFlag = process.env.LIVE_TRADING;
    if (liveTradingFlag !== "1") {
      throw new Error(
        "Live trading mode requires explicit LIVE_TRADING=1 environment variable. " +
        "This is a safety measure to prevent accidental real trading."
      );
    }
  }

  const priceApiUrl = process.env.PRICE_API_URL;
  if (mode === "live" && !priceApiUrl) {
    throw new Error("Missing required env var for live pricing: PRICE_API_URL");
  }
  
  return {
    rpcUrl: getEnv("RPC_URL", "https://api.mainnet-beta.solana.com"),
    mode: mode as "quote" | "paper" | "live",
    market: getEnv("MARKET", "BTC-PERP"),
    maxLeverage: getEnvNumber("MAX_LEVERAGE", 50),
    marginPct: getEnvNumber("MARGIN_PCT", 2),
    tpBps: getEnvNumber("TP_BPS", 10),
    slBps: getEnvNumber("SL_BPS", 10),
    feeBps: getEnvNumber("FEE_BPS", 2.5),
    emaFast: getEnvNumber("EMA_FAST", 9),
    emaSlow: getEnvNumber("EMA_SLOW", 21),
    tfSeconds: getEnvNumber("TF_SECONDS", 15),
    priceSource: getEnv("PRICE_SOURCE", "index") as "index" | "mark",
    cooldownMsPaper: getEnvNumber("COOLDOWN_MS_PAPER", 200),
    cooldownMsLive: getEnvNumber("COOLDOWN_MS_LIVE", 2000),
    maxDailyLossPct: getEnvNumber("MAX_DAILY_LOSS_PCT", 1.0),
    maxConsecLosses: getEnvNumber("MAX_CONSEC_LOSSES", 10),
    maxTradesPerHour: getEnvNumber("MAX_TRADES_PER_HOUR", 120),
    maxConsecErrors: getEnvNumber("MAX_CONSEC_ERRORS", 20),
    priceApiUrl,
  };
}
