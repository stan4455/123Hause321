# Raydium Perps Scalping Bot (Solana)

Scalping bot for Raydium Perps using Node.js + TypeScript.

## Venue / market
- Venue: Raydium Perps
- Market: BTC/USDC (perps)  
  Note: the exact market symbol may be `BTC-PERP` with USDC collateral (use the exact Raydium market name in config).
- Max leverage (hard cap): 50x
- Margin mode: ISOLATED (mandatory)

## Strategy parameters (v1)
- Indicator timeframe: 15 seconds
- Reference price for indicators: INDEX (reference price)
- Take Profit (TP): 0.10% (10 bps)
- Stop Loss (SL): 0.10% (10 bps)
- Fee assumption: 0.025% per side (taker / market execution)
- Capital allocation: 2% of equity used as margin per trade (MARGIN_PCT=2)
  - Notional ≈ margin * leverage (capped by MAX_LEVERAGE)

## Trend definition
- EMA_FAST=9, EMA_SLOW=21 computed on 15s candles using INDEX price.
- Trend UP   => EMA9 > EMA21 (LONG bias)
- Trend DOWN => EMA9 < EMA21 (SHORT bias)

## Execution rules
- Order type: MARKET (taker)
- Max 1 open position per market at any time.
- Always fully close the current position before opening the next one.
- TP/SL levels are computed from the actual entry fill price:

  **LONG**
  - TP_PRICE = entry_price * (1 + TP_BPS / 10000)
  - SL_PRICE = entry_price * (1 - SL_BPS / 10000)

  **SHORT**
  - TP_PRICE = entry_price * (1 - TP_BPS / 10000)
  - SL_PRICE = entry_price * (1 + SL_BPS / 10000)

## Direction logic (flip-on-loss)
1) Determine bias from EMA trend (UP=LONG, DOWN=SHORT).
2) Open a position in the bias direction.
3) If TP hits:
   - open the next trade in the SAME direction (continue scalping).
4) If SL hits:
   - close the position (confirmed closed),
   - flip direction (LONG <-> SHORT),
   - open the next trade in the new direction.
5) Repeat flipping on each SL until a TP occurs.
6) After a TP, continue in the current direction.

## Cooldown / rate limiting (mandatory)
- COOLDOWN_MS_PAPER=200
- COOLDOWN_MS_LIVE=2000 (hard minimum)

Reason: avoid race conditions, duplicate orders, and acting on unconfirmed state.

## Kill switch (defaults; tune later)
- MAX_DAILY_LOSS_PCT=1.0
- MAX_CONSEC_LOSSES=10
- MAX_TRADES_PER_HOUR=120
- MAX_CONSEC_ERRORS=20

Trading is disabled if:
- daily loss exceeds the limit,
- consecutive losses exceed the limit,
- consecutive runtime / RPC errors exceed the limit,
- spread or execution deviation exceeds configured limits.

## Config (.env)
Required:
- RPC_URL=
- MODE=quote|paper|live
- MARKET=BTC-PERP (exact Raydium market name)
- MAX_LEVERAGE=50
- MARGIN_PCT=2
- TP_BPS=10
- SL_BPS=10
- FEE_BPS=2.5
- EMA_FAST=9
- EMA_SLOW=21
- TF_SECONDS=15
- PRICE_SOURCE=index
- COOLDOWN_MS_PAPER=200
- COOLDOWN_MS_LIVE=2000
- MAX_DAILY_LOSS_PCT=1.0
- MAX_CONSEC_LOSSES=10
- MAX_TRADES_PER_HOUR=120
- MAX_CONSEC_ERRORS=20

For live trading, you must also set:
- LIVE_TRADING=1 (safety flag to prevent accidental real trading)
- LIVE_MODE=stub (default) or real (real trading integration not implemented)

## How to Run

### Installation

```bash
npm install
npm run build
```

### Quote Mode (Logs Only, No Simulated Execution)

Quote mode shows what the bot *would* do without executing any trades (even simulated ones).

```bash
# Create .env file from example
cp .env.example .env

# Edit .env to set MODE=quote (default)
# MODE=quote

# Run the bot
npm start
```

**Expected Output:**
```
============================================================
Raydium Perps Scalping Bot
============================================================
Bot initialized in quote mode
Initial equity: $10000
Market: BTC-PERP
Strategy: EMA(9)/EMA(21) on 15s candles
TP: 10bps, SL: 10bps
Max leverage: 50x, Margin: 2%

=== Bot started ===

[2026-02-01T12:00:00.000Z] Price: $45000.00 | EMA9: N/A | EMA21: N/A | Trend: NEUTRAL | Pos: None | Equity: $10000.00
[2026-02-01T12:00:15.000Z] Price: $45001.23 | EMA9: N/A | EMA21: N/A | Trend: NEUTRAL | Pos: None | Equity: $10000.00
...
[2026-02-01T12:05:00.000Z] Price: $45010.50 | EMA9: 45005.23 | EMA21: 45003.12 | Trend: UP | Pos: None | Equity: $10000.00

[QUOTE] Would place LONG market order:
[QUOTE]   Size: 0.222222
[QUOTE]   Leverage: 50x
[QUOTE]   Price: $45010.50

>>> OPEN LONG position @ $45010.50
    Size: 0.222222, Margin: $200.00, Leverage: 50x
    TP: $45015.00, SL: $45005.50
```

### Paper Mode (Simulated Trading with Fills)

Paper mode simulates order fills with realistic fees and slippage.

```bash
# Edit .env to set MODE=paper
# MODE=paper

# Run the bot
npm start
```

**Expected Output:**
```
============================================================
Raydium Perps Scalping Bot
============================================================
Bot initialized in paper mode
...

[PAPER] Simulated LONG market order fill:
[PAPER]   Base price: $45010.50
[PAPER]   Fill price: $45010.95 (with slippage)
[PAPER]   Size: 0.222222
[PAPER]   Leverage: 50x

>>> OPEN LONG position @ $45010.95
    Size: 0.222222, Margin: $200.00, Leverage: 50x
    TP: $45015.45, SL: $45006.45

[PAPER] Simulated close LONG position:
[PAPER]   Entry: $45010.95
[PAPER]   Base exit price: $45015.50
[PAPER]   Fill price: $45015.05 (with slippage)
[PAPER]   Size: 0.222222

<<< CLOSE LONG position @ $45015.05
    PnL: $0.41 (0.21%)
    Equity: $10000.41
    ✓ TP | Consec losses: 0
```

### Live Mode (Stubbed Live Trading - USE WITH CAUTION)

⚠️ **WARNING:** Live mode uses real money. Only use on testnet or with funds you can afford to lose.

```bash
# Edit .env to set MODE=live AND LIVE_TRADING=1
# MODE=live
# LIVE_TRADING=1
# LIVE_MODE=stub

# Run the bot
npm start
```

**Note:** Live mode runs in stub mode by default (`LIVE_MODE=stub`) and simulates fills while logging live-style actions. Set `LIVE_MODE=real` only after implementing the real Raydium Perps integration (currently not implemented and will throw an error).

### Running Tests

```bash
npm test
```

### Development Mode

```bash
# Watch mode (rebuilds on file changes)
npm run dev
```

## Project Structure

```
src/
├── index.ts              # Entry point
├── config.ts             # Configuration loader
├── logger.ts             # Simple logging utility
├── bot.ts                # Main bot orchestrator
├── price.ts              # Price provider (simulated)
├── types.ts              # TypeScript type definitions
├── indicators/
│   ├── ema.ts            # EMA calculation and trend detection
│   └── ema.test.ts       # EMA tests
├── strategy/
│   ├── strategy.ts       # TP/SL, position size, PnL calculations
│   └── strategy.test.ts  # Strategy tests
├── state/
│   ├── stateMachine.ts   # Cooldown, counter resets
│   └── stateMachine.test.ts # State machine tests
├── exchange/
│   ├── types.ts          # Exchange adapter interface
│   ├── quote.ts          # Quote mode (logs only)
│   └── paper.ts          # Paper mode (simulated fills)
└── risk/
    ├── killSwitch.ts     # Kill switch logic
    └── killSwitch.test.ts # Kill switch tests
```

## Safety Features

- **Kill Switch:** Automatically disables trading when:
  - Daily loss exceeds configured limit (default: 1.0%)
  - Consecutive losses exceed limit (default: 10)
  - Consecutive errors exceed limit (default: 20)
  - Trades per hour exceed limit (default: 120)

- **Cooldown:** Enforced minimum time between trades:
  - Paper mode: 200ms
  - Live mode: 2000ms (hard minimum)

- **Live Trading Safety:** Requires explicit `LIVE_TRADING=1` environment variable to prevent accidental real trading.

## CI/CD

GitHub Actions workflow runs on every push:
- `npm ci` - Clean dependency install
- `npm run build` - TypeScript compilation
- `npm test` - Unit tests

## Development Guidelines

See `.github/copilot-instructions.md` for project conventions and best practices.
