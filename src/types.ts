export type Direction = "LONG" | "SHORT";

export interface Position {
  direction: Direction;
  entryPrice: number;
  size: number;
  margin: number;
  leverage: number;
  tpPrice: number;
  slPrice: number;
  openedAt: Date;
}

export interface Trade {
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPct: number;
  hitTp: boolean;
  hitSl: boolean;
  timestamp: Date;
}

export interface BotState {
  // Current position (null if none)
  position: Position | null;
  
  // Trade history
  trades: Trade[];
  
  // Current direction bias (for flip-on-loss logic)
  currentDirection: Direction;
  
  // Equity tracking
  initialEquity: number;
  currentEquity: number;
  
  // Kill switch tracking
  dailyStartEquity: number;
  dailyStartTime: Date;
  consecLosses: number;
  consecErrors: number;
  tradesThisHour: number;
  hourStartTime: Date;
  
  // Cooldown tracking
  lastTradeTime: Date | null;
  
  // Trading enabled flag
  tradingEnabled: boolean;
  killSwitchReason: string | null;
}

export interface Candle {
  timestamp: Date;
  price: number;
}
