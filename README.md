# Deriv CRT Alert Bot

Telegram-controlled Deriv alert bot for CRT candle formations.

The bot does not place trades. It only sends Telegram alerts.

Market data uses Deriv's public WebSocket endpoint and does not require Deriv authentication.

## What It Does

- Lets you enable or disable instruments and timeframes from Telegram using market groups.
- Supports multiple Telegram chats, with separate monitoring settings for each chat.
- Loads Deriv's active instrument list automatically.
- Everything is off by default.
- Supports these timeframes: `D1`, `H12`, `H8`, `H6`, `H4`, `H3`, `H2`, `H1`, `M30`, `M15`.
- Checks only on timeframe boundaries:
  - `M15` checks after each 15-minute candle closes.
  - `M30` checks after each 30-minute candle closes.
  - Higher timeframes follow their matching candle boundaries.
  - `H12`, `H6`, and `H3` are built from Deriv H1 candles because Deriv does not provide those granularities directly.
- Refreshes Deriv's live exchange status before scanning and rejects stale candles while markets are closed.
- Sends the alert at the open of candle 3, after candles 1 and 2 form a CRT setup.
- Sends each alert with a generated PNG chart: candle 1 high/low range is shaded blue, and candle 2 manipulation is outlined in orange.
- Adds HTF context to each alert after a CRT is detected.

## Current CRT Rule

The detector currently uses this CRT definition:

- Candle 1 defines the range.
- Bullish CRT: candle 2 sweeps below candle 1 low and closes back inside candle 1 range.
- Bearish CRT: candle 2 sweeps above candle 1 high and closes back inside candle 1 range.
- If candle 2 sweeps both sides or closes outside candle 1 range, no alert is sent.

The rule lives in `src/detectors/crtDetector.js`, so it is easy to adjust if your CRT definition is stricter.

## HTF Context

HTF means higher timeframe. It is not part of the base CRT trigger; it is context added to the alert.

The bot checks:

- `M15` CRT against `H1`
- `M30` CRT against `H4`
- `H1` CRT against `H4`
- `H2` and `H3` CRT against `H6`
- `H4`, `H6`, `H8`, and `H12` CRT against `D1`
- `D1` has no higher timeframe context

Bias rule:

- Latest HTF candle closes above previous HTF high: bullish.
- Latest HTF candle closes below previous HTF low: bearish.
- Otherwise: neutral.

Scoring:

- HTF aligned with CRT direction: `+15`
- HTF neutral: `0`
- HTF against CRT direction: `-25`

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `TELEGRAM_BOT_TOKEN`: from Telegram BotFather.
   - `TELEGRAM_CHAT_ID`: your Telegram user, group, or channel chat ID.
   - `TELEGRAM_CHAT_IDS`: optional comma-separated allowlist for multiple users/chats.
   - `DERIV_APP_ID`: retained for compatibility; public market data no longer requires it.
3. Start the bot:

```powershell
.\start.ps1
```

4. In Telegram, send:

```text
/start
```

or:

```text
/settings
```

Then select an instrument and turn on only the timeframes you want watched.

## Multi-User Telegram Setup

One Railway bot can serve more than one Telegram chat. Each chat has separate instrument and timeframe settings.

Use:

```text
TELEGRAM_CHAT_IDS=123456789,987654321
```

Each person should open the same Telegram bot and send:

```text
/start
```

They will see the same menu, but their selections are saved separately. If one person presses `STOP ALL MONITORING`, it only stops monitoring for that person's chat.

If `TELEGRAM_CHAT_IDS` is empty, any chat that can reach the bot can use it. For a private bot, set `TELEGRAM_CHAT_IDS`.

## Deriv Instruments

You do not need to enter instrument symbols manually.

On startup, the bot calls Deriv's `active_symbols` API, loads the active instruments, and shows them in Telegram with pagination. Pick the instrument in Telegram, then turn on only the timeframe checks you want.

The Telegram menu groups instruments into:

- `CURRENCIES`
- `BOOM & CRASH`
- `VOLATILITY`
- `GOLD`
- `NAS / USTEC / US100`
- `US30 / DOW JONES`
- `OTHER INDICES`
- `CRYPTO`
- `COMMODITIES`
- `OTHER DERIV INDICES`

Major stock indices use familiar aliases where available:

- `OTC_NDX`: `US Tech 100 / NAS100`
- `OTC_DJI`: `Wall Street 30 / US30`
- `OTC_SPC`: `US 500 / SPX500`

## Alert Priority

Alerts are concise. If the higher timeframe bias aligns with the CRT direction, the alert is marked:

```text
🚨 A+ SETUP - CRT detected
```

Neutral or against-bias alerts still send, but without the A+ priority label.

Alerts use clean display names such as `Volatility 100` instead of raw API symbols such as `R_100`.

## Tests

```powershell
.\test.ps1
```

## Railway Deployment

This project deploys as a Railway worker-style Node.js service. It does not need a public HTTP domain because Telegram is handled with long polling.

### Required Variables

Set these in the Railway service Variables tab:

```text
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_CHAT_IDS=your_chat_id,second_person_chat_id
ALERT_COOLDOWN_SECONDS=300
```

Do not set `SETTINGS_PATH` if you attach a Railway volume. The bot automatically uses `RAILWAY_VOLUME_MOUNT_PATH/settings.json` when Railway provides that variable.

### Persistent Settings

Attach a Railway volume to the service so your Telegram instrument/timeframe selections survive redeploys.

Recommended mount path:

```text
/data
```

Railway provides `RAILWAY_VOLUME_MOUNT_PATH` at runtime after the volume is attached.

### Start Command

Railway can use the `start` script from `package.json`:

```text
npm start
```

The actual process command is:

```text
node src/index.js
```
