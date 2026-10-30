import test from "node:test";
import assert from "node:assert/strict";
import { formatSignalMessage } from "../src/alertGate.js";

test("marks HTF-aligned alerts as A+ setups", () => {
  const message = formatSignalMessage({
    signal: {
      direction: "bullish",
      htf: {
        timeframe: { label: "1h" },
        bias: "bullish",
        alignment: "aligned",
        score: 15
      },
      candles: [{ epoch: 1000, close: 123.45 }]
    },
    symbol: "R_100",
    displayName: "Volatility 100",
    granularitySeconds: 900
  });

  assert.match(message, /A\+ SETUP/);
  assert.match(message, /Volatility 100/);
  assert.match(message, /HTF: 1h bullish \| aligned \(\+15\)/);
});
