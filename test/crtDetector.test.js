import test from "node:test";
import assert from "node:assert/strict";
import { detectCrtFormation } from "../src/detectors/crtDetector.js";

const context = { symbol: "R_100", timeframe: { key: "15m", label: "15m", seconds: 900 } };

test("detects bullish CRT when candle 2 sweeps candle 1 low and closes inside range", () => {
  const signal = detectCrtFormation(
    [
      candle(1000, 100, 110, 98, 108),
      candle(1900, 107, 109, 95, 102)
    ],
    context
  );

  assert.equal(signal.name, "CRT detected");
  assert.equal(signal.direction, "bullish");
});

test("detects bearish CRT when candle 2 sweeps candle 1 high and closes inside range", () => {
  const signal = detectCrtFormation(
    [
      candle(1000, 100, 110, 98, 108),
      candle(1900, 107, 114, 101, 105)
    ],
    context
  );

  assert.equal(signal.name, "CRT detected");
  assert.equal(signal.direction, "bearish");
});

test("does not detect CRT when candle 2 closes outside candle 1 range", () => {
  const signal = detectCrtFormation(
    [
      candle(1000, 100, 110, 98, 108),
      candle(1900, 107, 114, 101, 112)
    ],
    context
  );

  assert.equal(signal, null);
});

function candle(epoch, open, high, low, close) {
  return { epoch, open, high, low, close };
}
