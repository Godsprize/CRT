import { normalizeHistoricalCandles, normalizeOhlc, upsertCandle } from "./candles.js";

const DERIV_NATIVE_GRANULARITIES = new Set([60, 120, 180, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400]);
const DEFAULT_DERIV_WEBSOCKET_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

function derivWebSocketUrl() {
  return process.env.DERIV_WS_URL || DEFAULT_DERIV_WEBSOCKET_URL;
}

export async function fetchCandles({
  appId,
  symbol,
  granularitySeconds,
  count = 3,
  timeoutMs = 15000
}) {
  if (!DERIV_NATIVE_GRANULARITIES.has(granularitySeconds)) {
    return fetchAggregatedCandles({ appId, symbol, granularitySeconds, count, timeoutMs });
  }

  const request = {
    ticks_history: symbol,
    adjust_start_time: 1,
    count,
    end: "latest",
    start: 1,
    style: "candles",
    granularity: granularitySeconds
  };

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(derivWebSocketUrl());
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out fetching ${symbol} ${granularitySeconds}s candles`));
    }, timeoutMs);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify(request));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      clearTimeout(timeout);
      socket.close();

      if (message.error) {
        reject(new Error(`Deriv API error: ${message.error.message}`));
        return;
      }

      resolve(normalizeHistoricalCandles(message.candles));
    });

    socket.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(
        `Unable to connect to Deriv for ${symbol} at ${derivWebSocketUrl()}`,
        { cause: event.error }
      ));
    });
  });
}

async function fetchAggregatedCandles({ appId, symbol, granularitySeconds, count, timeoutMs }) {
  if (granularitySeconds % 3600 !== 0) {
    throw new Error(`Unsupported synthetic granularity: ${granularitySeconds}s`);
  }

  const hours = granularitySeconds / 3600;
  const baseCandles = await fetchCandles({
    appId,
    symbol,
    granularitySeconds: 3600,
    count: count * hours + hours,
    timeoutMs
  });

  return aggregateCandles(baseCandles, granularitySeconds).slice(-count);
}

export function aggregateCandles(candles, granularitySeconds) {
  const buckets = new Map();
  for (const candle of candles) {
    const epoch = Math.floor(candle.epoch / granularitySeconds) * granularitySeconds;
    const existing = buckets.get(epoch);
    if (!existing) {
      buckets.set(epoch, { ...candle, epoch });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
  }

  return [...buckets.values()].sort((a, b) => a.epoch - b.epoch);
}

export async function fetchActiveInstruments({ appId, timeoutMs = 15000 }) {
  const message = await derivRequest({
    appId,
    request: { active_symbols: "brief" },
    timeoutMs,
    errorLabel: "active instruments"
  });

  return (message.active_symbols || [])
    .map(mapActiveSymbolForMenu)
    .filter((instrument) => instrument.symbol)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function mapActiveSymbolForMenu(symbol) {
  const normalizedSymbol = symbol.symbol || symbol.underlying_symbol || "";
  const displayName = symbol.display_name || symbol.underlying_symbol_name || normalizedSymbol;
  const market = symbol.market_display_name || symbol.market || symbol.market_type || "Other";
  const normalized = {
    ...symbol,
    symbol: normalizedSymbol,
    display_name: displayName
  };

  return {
    symbol: normalizedSymbol,
    displayName: displayNameWithAlias(normalized),
    market,
    category: categoryForSymbol(normalized, market),
    isOpen: symbol.exchange_is_open !== 0
  };
}

function categoryForSymbol(symbol, market) {
  if (symbol.symbol === "frxXAUUSD") return "gold";
  if (symbol.symbol === "OTC_NDX") return "nas_us100";
  if (symbol.symbol === "OTC_DJI") return "us30_dow";

  const name = `${symbol.symbol} ${symbol.display_name || ""}`;
  const marketCode = String(market).toLowerCase().replaceAll("_", " ");
  const isDerived = /derived|synthetic/.test(marketCode);

  if (marketCode === "forex") return "currency_pairs";
  if (isDerived && /boom|crash/i.test(name)) return "boom_crash";
  if (isDerived && /volatility/i.test(name)) return "volatility";
  if (isDerived) return "deriv_indices";
  if (/cryptocurrenc|crypto/.test(marketCode)) return "crypto";
  if (/stock indices|stock index/.test(marketCode)) return "indices";
  if (/commodit/.test(marketCode)) return "commodities";
  return "other";
}

function displayNameWithAlias(symbol) {
  const aliases = {
    OTC_NDX: "US Tech 100 / NAS100",
    OTC_DJI: "Wall Street 30 / US30",
    OTC_SPC: "US 500 / SPX500"
  };
  if (aliases[symbol.symbol]) return aliases[symbol.symbol];
  return cleanDisplayName(symbol.display_name || symbol.symbol);
}

function cleanDisplayName(displayName) {
  return displayName.replace(/\s+Index$/u, "");
}

async function derivRequest({ appId, request, timeoutMs, errorLabel }) {
  return new Promise((resolve, reject) => {
    const url = derivWebSocketUrl();
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out fetching ${errorLabel}`));
    }, timeoutMs);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify(request));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      clearTimeout(timeout);
      socket.close();

      if (message.error) {
        reject(new Error(`Deriv API error: ${message.error.message}`));
        return;
      }

      resolve(message);
    });

    socket.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(
        `Unable to connect to Deriv for ${errorLabel} at ${url}`,
        { cause: event.error }
      ));
    });
  });
}

export class DerivClient {
  constructor({ appId, symbol, granularitySeconds, candleCount }) {
    this.appId = appId;
    this.symbol = symbol;
    this.granularitySeconds = granularitySeconds;
    this.candleCount = candleCount;
    this.socket = null;
    this.candles = [];
  }

  connect({ onCandles, onStatus = console.log }) {
    this.socket = new WebSocket(derivWebSocketUrl());

    this.socket.addEventListener("open", () => {
      onStatus(`Connected to Deriv for ${this.symbol}`);
      this.socket.send(JSON.stringify(this.historyRequest()));
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.error) {
        throw new Error(`Deriv API error: ${message.error.message}`);
      }

      if (message.msg_type === "candles") {
        this.candles = normalizeHistoricalCandles(message.candles).slice(-this.candleCount);
        onCandles(this.candles);
      }

      if (message.msg_type === "ohlc") {
        this.candles = upsertCandle(
          this.candles,
          normalizeOhlc(message.ohlc),
          this.candleCount
        );
        onCandles(this.candles);
      }
    });

    this.socket.addEventListener("close", () => {
      onStatus("Deriv socket closed");
    });

    this.socket.addEventListener("error", (error) => {
      onStatus(`Deriv socket error: ${error.message || "unknown error"}`);
    });
  }

  close() {
    this.socket?.close();
  }

  historyRequest() {
    return {
      ticks_history: this.symbol,
      adjust_start_time: 1,
      count: this.candleCount,
      end: "latest",
      start: 1,
      style: "candles",
      granularity: this.granularitySeconds,
      subscribe: 1
    };
  }
}
