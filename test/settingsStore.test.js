import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { SettingsStore } from "../src/settingsStore.js";

const path = "work/test-settings-store.json";
const instruments = ["R_100"];
const timeframes = [{ key: "M15", label: "M15", seconds: 900 }];

test("keeps separate settings for separate Telegram chats", () => {
  rmSync(path, { force: true });
  const store = new SettingsStore({ path, instruments, timeframes });

  store.toggle("111", "R_100", "M15");

  assert.equal(store.isEnabled("111", "R_100", "M15"), true);
  assert.equal(store.isEnabled("222", "R_100", "M15"), false);

  store.toggle("222", "R_100", "M15");
  assert.deepEqual(store.enabledPairsForTimeframe("M15"), [
    { instrument: "R_100", timeframeKey: "M15", chatIds: ["111", "222"] }
  ]);

  rmSync(path, { force: true });
});
