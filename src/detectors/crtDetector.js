export function detectCrtFormation(candles, { symbol, timeframe }) {
  const closed = candles.slice(-2);
  if (closed.length < 2) return null;

  const [rangeCandle, sweepCandle] = closed;
  const sweptLow = sweepCandle.low < rangeCandle.low;
  const sweptHigh = sweepCandle.high > rangeCandle.high;
  const closedInsideRange =
    sweepCandle.close > rangeCandle.low && sweepCandle.close < rangeCandle.high;

  if (sweptLow && !sweptHigh && closedInsideRange) {
    return buildSignal({
      symbol,
      timeframe,
      direction: "bullish",
      candles: closed,
      reason: "Candle 2 swept below candle 1 low and closed back inside candle 1 range."
    });
  }

  if (sweptHigh && !sweptLow && closedInsideRange) {
    return buildSignal({
      symbol,
      timeframe,
      direction: "bearish",
      candles: closed,
      reason: "Candle 2 swept above candle 1 high and closed back inside candle 1 range."
    });
  }

  return null;
}

function buildSignal({ symbol, timeframe, direction, candles, reason }) {
  const confirmationCandle = candles.at(-1);
  return {
    id: `crt:${symbol}:${timeframe.key}:${confirmationCandle.epoch}:${direction}`,
    name: "CRT detected",
    direction,
    confidence: 0.8,
    candles,
    reason
  };
}
