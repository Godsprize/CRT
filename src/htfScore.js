import { higherTimeframeFor } from "./timeframes.js";

export function scoreHtfContext({ signal, timeframe, candles }) {
  const higherTimeframe = higherTimeframeFor(timeframe);
  if (!higherTimeframe) {
    return {
      timeframe: null,
      bias: "unavailable",
      alignment: "unavailable",
      multiplier: 1,
      score: 0,
      reason: "No higher timeframe configured for this timeframe."
    };
  }

  const bias = detectBias(candles);
  const alignment = alignmentFor(signal.direction, bias);
  const multiplier = multiplierFor(alignment);
  const score = scoreFor(alignment);

  return {
    timeframe: higherTimeframe,
    bias,
    alignment,
    multiplier,
    score,
    reason: reasonFor(alignment, bias, higherTimeframe)
  };
}

export function detectBias(candles) {
  const closed = candles.slice(-2);
  if (closed.length < 2) return "neutral";

  const [previous, latest] = closed;
  if (latest.close > previous.high) return "bullish";
  if (latest.close < previous.low) return "bearish";
  return "neutral";
}

function alignmentFor(direction, bias) {
  if (bias === "neutral") return "neutral";
  if (direction === bias) return "aligned";
  return "against";
}

function multiplierFor(alignment) {
  if (alignment === "aligned") return 1.15;
  if (alignment === "against") return 0.75;
  return 1;
}

function scoreFor(alignment) {
  if (alignment === "aligned") return 15;
  if (alignment === "against") return -25;
  return 0;
}

function reasonFor(alignment, bias, higherTimeframe) {
  if (alignment === "aligned") {
    return `${higherTimeframe.label} bias is ${bias}, aligned with the CRT direction.`;
  }
  if (alignment === "against") {
    return `${higherTimeframe.label} bias is ${bias}, against the CRT direction.`;
  }
  if (alignment === "unavailable") return "HTF context is unavailable.";
  return `${higherTimeframe.label} bias is neutral.`;
}
