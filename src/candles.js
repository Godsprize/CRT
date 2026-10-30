export function normalizeHistoricalCandles(rawCandles = []) {
  return rawCandles
    .map((candle) => ({
      epoch: Number(candle.epoch),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close)
    }))
    .filter(isValidCandle)
    .sort((a, b) => a.epoch - b.epoch);
}

export function normalizeOhlc(raw) {
  if (!raw) return null;
  const candle = {
    epoch: Number(raw.open_time ?? raw.epoch),
    open: Number(raw.open),
    high: Number(raw.high),
    low: Number(raw.low),
    close: Number(raw.close)
  };
  return isValidCandle(candle) ? candle : null;
}

export function upsertCandle(candles, nextCandle, limit) {
  if (!nextCandle) return candles;

  const existingIndex = candles.findIndex((candle) => candle.epoch === nextCandle.epoch);
  const updated =
    existingIndex >= 0
      ? candles.map((candle, index) => (index === existingIndex ? nextCandle : candle))
      : [...candles, nextCandle];

  return updated
    .sort((a, b) => a.epoch - b.epoch)
    .slice(Math.max(0, updated.length - limit));
}

export function candleDirection(candle) {
  if (candle.close > candle.open) return "bullish";
  if (candle.close < candle.open) return "bearish";
  return "neutral";
}

function isValidCandle(candle) {
  return (
    Number.isFinite(candle.epoch) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
}
