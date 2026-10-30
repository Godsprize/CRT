import test from "node:test";
import assert from "node:assert/strict";
import { aggregateCandles } from "../src/derivClient.js";

test("aggregates H1 candles into H3 candles", () => {
  const candles = [
    candle(0, 100, 105, 99, 102),
    candle(3600, 102, 108, 101, 107),
    candle(7200, 107, 109, 103, 104),
    candle(10800, 104, 106, 100, 101)
  ];

  const aggregated = aggregateCandles(candles, 3 * 60 * 60);

  assert.equal(aggregated.length, 2);
  assert.deepEqual(aggregated[0], {
    epoch: 0,
    open: 100,
    high: 109,
    low: 99,
    close: 104
  });
});

function candle(epoch, open, high, low, close) {
  return { epoch, open, high, low, close };
}
