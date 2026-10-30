import { AlertGate } from "./alertGate.js";
import { loadConfig } from "./config.js";
import { fetchActiveInstruments } from "./derivClient.js";
import { loadEnvFile } from "./envFile.js";
import { BoundaryScheduler } from "./scheduler.js";
import { SettingsStore } from "./settingsStore.js";
import { TelegramNotifier } from "./telegram.js";
import { TelegramSettingsBot } from "./telegramSettingsBot.js";
import { TIMEFRAMES } from "./timeframes.js";

loadEnvFile();

let settingsBot;
let scheduler;

function shutdown(signal) {
  console.log(`Stopping bot after ${signal}`);
  settingsBot?.stop();
  scheduler?.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const config = loadConfig();
const instruments = await fetchActiveInstruments({ appId: config.deriv.appId });
const instrumentSymbols = instruments.map((instrument) => instrument.symbol);
const notifier = new TelegramNotifier(config.telegram);
const alertGate = new AlertGate(config.alerts);
const settingsStore = new SettingsStore({
  path: config.storage.settingsPath,
  instruments: instrumentSymbols,
  timeframes: TIMEFRAMES,
  defaultChatId: config.telegram.chatId
});

settingsBot = new TelegramSettingsBot({
  notifier,
  settingsStore,
  instruments,
  timeframes: TIMEFRAMES,
  allowedChatIds: config.telegram.allowedChatIds
});

scheduler = new BoundaryScheduler({
  config,
  settingsStore,
  instruments,
  timeframes: TIMEFRAMES,
  notifier,
  alertGate
});

console.log("Starting Deriv CRT alert bot");
console.log(`Loaded ${instruments.length} active Deriv instruments`);
console.log(`Timeframes=${TIMEFRAMES.map((timeframe) => timeframe.label).join(", ")}`);
console.log(`Settings path=${config.storage.settingsPath}`);
console.log("All instruments and timeframes are off until enabled in Telegram.");

settingsBot.start();
scheduler.start();
