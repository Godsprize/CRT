import test from "node:test";
import assert from "node:assert/strict";
import { TelegramSettingsBot } from "../src/telegramSettingsBot.js";

const timeframes = [{ key: "M15", label: "M15", seconds: 900 }];
const instruments = [
  {
    symbol: "frxEURUSD",
    displayName: "EUR/USD",
    market: "Forex",
    category: "currency_pairs",
    isOpen: true
  },
  {
    symbol: "R_100",
    displayName: "Volatility 100",
    market: "Derived",
    category: "volatility",
    isOpen: true
  }
];
function makeSettingsStore() {
  return {
    stopped: false,
    isEnabled: () => false,
    toggle: () => true,
    stopAll() {
      this.stopped = true;
    },
    enabledSelections: () => []
  };
}

test("shows category menu first", () => {
  const bot = new TelegramSettingsBot({
    notifier: fakeNotifier(),
    settingsStore: makeSettingsStore(),
    instruments,
    timeframes,
    allowedChatIds: ["123"]
  });

  assert.match(bot.mainText(), /Choose a command or open a market group/);
  assert.equal(bot.mainKeyboard().inline_keyboard[0][0].text, "STATUS");
  assert.equal(bot.mainKeyboard().inline_keyboard[1][0].text, "STOP ALL MONITORING");
  assert.equal(bot.mainKeyboard().inline_keyboard[2][0].text, "CURRENCIES: OFF");
  assert.equal(bot.mainKeyboard().inline_keyboard[3][0].text, "VOLATILITY: OFF");
});

test("clamps category menu page number", () => {
  const bot = new TelegramSettingsBot({
    notifier: fakeNotifier(),
    settingsStore: makeSettingsStore(),
    instruments,
    timeframes,
    allowedChatIds: ["123"]
  });

  assert.match(bot.categoryText("currency_pairs", 99), /Page 1 of 1/);
});

test("answers stale instrument callback", async () => {
  const notifier = fakeNotifier();
  const settingsStore = makeSettingsStore();
  const bot = new TelegramSettingsBot({
    notifier,
    settingsStore,
    instruments,
    timeframes,
    allowedChatIds: ["123"]
  });

  await bot.handleCallback({
    id: "callback-1",
    data: "instrument:currency_pairs:99",
    message: { chat: { id: 123 }, message_id: 1 }
  });

  assert.equal(notifier.callbackText, "Instrument is no longer available");
});

test("status shows no active monitoring", () => {
  const bot = new TelegramSettingsBot({
    notifier: fakeNotifier(),
    settingsStore: makeSettingsStore(),
    instruments,
    timeframes,
    allowedChatIds: ["123"]
  });

  assert.match(bot.statusText(), /Nothing is active/);
});

test("stop confirm disables all monitoring", async () => {
  const notifier = fakeNotifier();
  const settingsStore = makeSettingsStore();
  const bot = new TelegramSettingsBot({
    notifier,
    settingsStore,
    instruments,
    timeframes,
    allowedChatIds: ["123"]
  });

  await bot.handleCallback({
    id: "callback-2",
    data: "stop_confirm",
    message: { chat: { id: 123 }, message_id: 1 }
  });

  assert.equal(settingsStore.stopped, true);
});

function fakeNotifier() {
  const notifier = {
    callbackText: "",
    answerCallbackQuery: async (_id, text = "") => {
      notifier.callbackText = text;
    },
    editMessageWithKeyboard: async () => ({ ok: true })
  };
  return notifier;
}
