## Venue / market
- Venue: Raydium Perps
- Market: BTC/USDC (perps)
- Max leverage (hard cap): 50x
- Margin mode: ISOLATED (mandatory)

## Strategy parameters (v1)
- Timeframe for indicators: 15s
- Reference price for indicators: INDEX (referencna cena)
- Take Profit (TP): 0.10% (10 bps)
- Stop Loss (SL): 0.10% (10 bps)
- Fee assumption: 0.025% per side (taker)
- Capital allocation: 2% equity as margin per trade (MARGIN_PCT=2)
  - Notional ≈ margin * leverage (capped by MAX_LEVERAGE)

## Trend definition
- EMA_FAST=9, EMA_SLOW=21 computed on 15s candles using INDEX price.
- Trend UP  => EMA9 > EMA21 (LONG bias)
- Trend DOWN => EMA9 < EMA21 (SHORT bias)

## Execution rules
- Order type: MARKET (taker)
- At most 1 open position per market at any time.
- Always close position fully before opening a new one.
- TP/SL levels are computed from the actual entry fill price:
  - LONG:
    - TP_PRICE = entry_price * (1 + TP_BPS/10000)
    - SL_PRICE = entry_price * (1 - SL_BPS/10000)
  - SHORT:
    - TP_PRICE = entry_price * (1 - TP_BPS/10000)
    - SL_PRICE = entry_price * (1 + SL_BPS/10000)

## Direction logic (flip-on-loss)
1) Determine bias from EMA trend (UP=LONG, DOWN=SHORT).
2) Open position in the bias direction.
3) If TP hits:
   - open next trade in the SAME direction (continue scalping).
4) If SL hits:
   - close position (confirmed),
   - flip direction (LONG<->SHORT),
   - open next trade in the new direction.
5) Repeat flipping on each SL until a TP occurs.
6) After a TP, continue in the current direction.

## Cooldown / rate limiting (mandatory)
- COOLDOWN_MS_PAPER=200
- COOLDOWN_MS_LIVE=2000  (hard minimum)
Reason: avoid race conditions, double orders, and unconfirmed state.

## Kill switch (defaults; can be tuned later)
- MAX_DAILY_LOSS_PCT=1.0
- MAX_CONSEC_LOSSES=10
- MAX_TRADES_PER_HOUR=120
- MAX_CONSEC_ERRORS=20
- Disable trading if spread or execution deviation is above limits.

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

