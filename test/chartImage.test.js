import test from "node:test";
import assert from "node:assert/strict";
import { renderCrtChartPng } from "../src/chartImage.js";

test("renders CRT chart as a PNG buffer", () => {
  const candles = [
    candle(1, 100, 104, 99, 103),
    candle(2, 103, 105, 100, 104),
    candle(3, 104, 108, 101, 107),
    candle(4, 107, 109, 98, 102)
  ];
  const signal = {
    direction: "bullish",
    candles: candles.slice(-2)
  };

  const png = renderCrtChartPng({ candles, signal });

  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(png.length > 1000);
});

function candle(epoch, open, high, low, close) {
  return { epoch, open, high, low, close };
}
