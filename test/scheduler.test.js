import test from "node:test";
import assert from "node:assert/strict";
import { msUntilNextBoundary } from "../src/scheduler.js";

test("schedules just after the next timeframe boundary", () => {
  const now = Date.UTC(2026, 0, 1, 10, 7, 30);
  const delay = msUntilNextBoundary(15 * 60, now);
  const nextCheck = now + delay;
  const expectedBoundary = Date.UTC(2026, 0, 1, 10, 15, 0);

  assert.equal(nextCheck, expectedBoundary + 1500);
});
