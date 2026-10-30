import test from "node:test";
import assert from "node:assert/strict";
import { detectBias, scoreHtfContext } from "../src/htfScore.js";

const timeframe = { key: "M15", label: "M15", seconds: 900 };

test("detects bullish HTF bias when latest close breaks previous high", () => {
  assert.equal(
    detectBias([
      candle(1, 100, 110, 95, 104),
      candle(2, 104, 113, 101, 111)
    ]),
    "bullish"
  );
});

test("detects bearish HTF bias when latest close breaks previous low", () => {
  assert.equal(
    detectBias([
      candle(1, 100, 110, 95, 104),
      candle(2, 104, 106, 91, 94)
    ]),
    "bearish"
  );
});

test("scores HTF as aligned when bias matches CRT direction", () => {
  const htf = scoreHtfContext({
    signal: { direction: "bullish" },
    timeframe,
    candles: [
      candle(1, 100, 110, 95, 104),
      candle(2, 104, 113, 101, 111)
    ]
  });

  assert.equal(htf.timeframe.key, "H1");
  assert.equal(htf.bias, "bullish");
  assert.equal(htf.alignment, "aligned");
  assert.equal(htf.score, 15);
});

test("scores HTF as against when bias conflicts with CRT direction", () => {
  const htf = scoreHtfContext({
    signal: { direction: "bullish" },
    timeframe,
    candles: [
      candle(1, 100, 110, 95, 104),
      candle(2, 104, 106, 91, 94)
    ]
  });

  assert.equal(htf.bias, "bearish");
  assert.equal(htf.alignment, "against");
  assert.equal(htf.score, -25);
});

function candle(epoch, open, high, low, close) {
  return { epoch, open, high, low, close };
}
