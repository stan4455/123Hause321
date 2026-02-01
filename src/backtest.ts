import { loadConfig } from "./config.js";
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

type HistoricalPricePoint = {
  timestamp: string | number;
  price: number;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

function parseTimestamp(value: string | number): Date {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return date;
}

function intervalToSeconds(interval: string): number | null {
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return amount * multipliers[unit];
}

async function fetchHistoricalPrices(): Promise<Candle[]> {
  const apiUrl = process.env.HISTORICAL_API_URL;
  if (apiUrl) {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Historical API error: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as HistoricalPricePoint[];
    if (!Array.isArray(payload)) {
      throw new Error("Historical API response must be an array");
    }
    return payload.map((point) => ({
      timestamp: parseTimestamp(point.timestamp),
      price: point.price,
    }));
  }

  const symbol = process.env.BACKTEST_SYMBOL ?? "BTCUSDT";
  const interval = process.env.BACKTEST_INTERVAL ?? "1m";
  const limit = Number(process.env.BACKTEST_LIMIT ?? "1000");

  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as BinanceKline[];
  if (!Array.isArray(payload)) {
    throw new Error("Binance API response must be an array");
  }

  return payload.map((kline) => ({
    timestamp: new Date(kline[0]),
    price: Number(kline[4]),
  }));
}

function createInitialState(initialEquity: number, startTime: Date): BotState {
  return {
    position: null,
    trades: [],
    currentDirection: "LONG",
    initialEquity,
    currentEquity: initialEquity,
    dailyStartEquity: initialEquity,
    dailyStartTime: startTime,
    consecLosses: 0,
    consecErrors: 0,
    tradesThisHour: 0,
    hourStartTime: startTime,
    lastTradeTime: null,
    tradingEnabled: true,
    killSwitchReason: null,
  };
}

function checkCooldownAt(
  state: BotState,
  cooldownMs: number,
  currentTime: Date
): boolean {
  if (!state.lastTradeTime) {
    return true;
  }
  const elapsed = currentTime.getTime() - state.lastTradeTime.getTime();
  return elapsed >= cooldownMs;
}

function resetHourlyCountersAt(state: BotState, currentTime: Date): void {
  const elapsed = currentTime.getTime() - state.hourStartTime.getTime();
  if (elapsed >= 3600000) {
    state.tradesThisHour = 0;
    state.hourStartTime = currentTime;
  }
}

function resetDailyCountersAt(state: BotState, currentTime: Date): void {
  const elapsed = currentTime.getTime() - state.dailyStartTime.getTime();
  if (elapsed >= 86400000) {
    state.dailyStartEquity = state.currentEquity;
    state.dailyStartTime = currentTime;
  }
}

async function runBacktest(): Promise<void> {
  const config = loadConfig();
  const candles = await fetchHistoricalPrices();
  if (candles.length === 0) {
    throw new Error("No historical data available for backtest");
  }

  const intervalSeconds = process.env.BACKTEST_INTERVAL
    ? intervalToSeconds(process.env.BACKTEST_INTERVAL)
    : null;
  if (intervalSeconds && intervalSeconds !== config.tfSeconds) {
    console.warn(
      `Warning: BACKTEST_INTERVAL=${process.env.BACKTEST_INTERVAL} ` +
        `(${intervalSeconds}s) differs from TF_SECONDS=${config.tfSeconds}.`
    );
  }

  const initialEquity = Number(process.env.BACKTEST_INITIAL_EQUITY ?? "10000");
  const state = createInitialState(initialEquity, candles[0].timestamp);
  const priceWindow: Candle[] = [];
  const maxCandles = Math.max(config.emaFast, config.emaSlow) * 2;
  const cooldownMs =
    config.mode === "live" ? config.cooldownMsLive : config.cooldownMsPaper;

  for (const candle of candles) {
    try {
      priceWindow.push(candle);
      if (priceWindow.length > maxCandles) {
        priceWindow.splice(0, priceWindow.length - maxCandles);
      }

      const emaFast = calculateEMA(priceWindow, config.emaFast);
      const emaSlow = calculateEMA(priceWindow, config.emaSlow);
      const trend = determineTrend(emaFast, emaSlow);

      if (state.position) {
        const { hitTp, hitSl } = checkTPSL(state.position, candle.price);
        if (hitTp || hitSl) {
          const closeResult = closePosition(
            state,
            candle.price,
            config.feeBps,
            hitTp,
            hitSl
          );
          if (hitSl) {
            state.currentDirection = flipDirection(state.currentDirection);
          }
          state.lastTradeTime = candle.timestamp;
        }
      } else if (state.tradingEnabled && trend !== "NEUTRAL") {
        if (!checkCooldownAt(state, cooldownMs, candle.timestamp)) {
          continue;
        }
        const killSwitch = checkKillSwitch(state, config);
        if (killSwitch.triggered) {
          state.tradingEnabled = false;
          state.killSwitchReason = killSwitch.reason;
          continue;
        }
        const direction: Direction =
          state.trades.length === 0
            ? trend === "UP"
              ? "LONG"
              : "SHORT"
            : state.currentDirection;
        openPosition(state, candle.price, direction, config.maxLeverage, config);
        state.lastTradeTime = candle.timestamp;
      }

      resetHourlyCountersAt(state, candle.timestamp);
      resetDailyCountersAt(state, candle.timestamp);
    } catch (error) {
      console.error("Backtest error:", error);
      state.consecErrors++;
      const killSwitch = checkKillSwitch(state, config);
      if (killSwitch.triggered) {
        state.tradingEnabled = false;
        state.killSwitchReason = killSwitch.reason;
        break;
      }
    }
  }

  printSummary(state, candles);
}

function openPosition(
  state: BotState,
  price: number,
  direction: Direction,
  leverage: number,
  config: ReturnType<typeof loadConfig>
): void {
  const { margin, size } = calculatePositionSize(
    state.currentEquity,
    config.marginPct,
    leverage,
    price
  );
  const targets = calculateTPSL(direction, price, config.tpBps, config.slBps);
  state.position = {
    direction,
    entryPrice: price,
    size,
    margin,
    leverage,
    tpPrice: targets.tpPrice,
    slPrice: targets.slPrice,
    openedAt: new Date(),
  };
  state.tradesThisHour++;
}

function closePosition(
  state: BotState,
  price: number,
  feeBps: number,
  hitTp: boolean,
  hitSl: boolean
): Trade {
  const position = state.position as Position;
  const { pnl, pnlPct } = calculatePnL(position, price, feeBps);
  state.currentEquity += pnl;
  const trade: Trade = {
    direction: position.direction,
    entryPrice: position.entryPrice,
    exitPrice: price,
    size: position.size,
    pnl,
    pnlPct,
    hitTp,
    hitSl,
    timestamp: new Date(),
  };
  state.trades.push(trade);
  if (hitTp) {
    state.consecLosses = 0;
    state.consecErrors = 0;
  } else if (hitSl) {
    state.consecLosses++;
  }
  state.position = null;
  return trade;
}

function printSummary(state: BotState, candles: Candle[]): void {
  const totalTrades = state.trades.length;
  const winningTrades = state.trades.filter((trade) => trade.hitTp).length;
  const losingTrades = state.trades.filter((trade) => trade.hitSl).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnL = state.currentEquity - state.initialEquity;
  const totalPnLPct = (totalPnL / state.initialEquity) * 100;

  console.log("\n=== Backtest Summary ===");
  console.log(`Data points: ${candles.length}`);
  console.log(`Start: ${candles[0].timestamp.toISOString()}`);
  console.log(`End: ${candles[candles.length - 1].timestamp.toISOString()}`);
  console.log(`Total trades: ${totalTrades}`);
  console.log(`Winning trades: ${winningTrades}`);
  console.log(`Losing trades: ${losingTrades}`);
  console.log(`Win rate: ${winRate.toFixed(2)}%`);
  console.log(`Total PnL: $${totalPnL.toFixed(2)} (${totalPnLPct.toFixed(2)}%)`);
  if (state.killSwitchReason) {
    console.log(`Kill switch: ${state.killSwitchReason}`);
  }
}

runBacktest().catch((error) => {
  console.error("Backtest failed:", error);
  process.exit(1);
});
