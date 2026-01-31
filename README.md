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
