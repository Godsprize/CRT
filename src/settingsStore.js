import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class SettingsStore {
  constructor({ path, instruments, timeframes, defaultChatId = "" }) {
    this.path = path;
    this.instruments = instruments;
    this.timeframes = timeframes;
    this.defaultChatId = defaultChatId ? String(defaultChatId) : "";
    this.state = this.load();
  }

  load() {
    const base = this.defaultState();
    if (!existsSync(this.path)) {
      this.save(base);
      return base;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8"));
      return this.normalize(parsed);
    } catch {
      this.save(base);
      return base;
    }
  }

  defaultState() {
    return { chats: {} };
  }

  normalize(state) {
    const base = this.defaultState();

    if (state?.chats && typeof state.chats === "object") {
      for (const chatId of Object.keys(state.chats)) {
        base.chats[chatId] = this.normalizeChatState(state.chats[chatId]);
      }
    } else if (state?.instruments && this.defaultChatId) {
      base.chats[this.defaultChatId] = this.normalizeChatState(state);
    }

    this.save(base);
    return base;
  }

  normalizeChatState(state) {
    return {
      instruments: Object.fromEntries(
        this.instruments.map((instrument) => [
          instrument,
          Object.fromEntries(
            this.timeframes.map((timeframe) => [
              timeframe.key,
              Boolean(state?.instruments?.[instrument]?.[timeframe.key])
            ])
          )
        ])
      )
    };
  }

  ensureChat(chatId) {
    const key = String(chatId);
    if (!this.state.chats[key]) {
      this.state.chats[key] = this.normalizeChatState({});
      this.save();
    }
    return this.state.chats[key];
  }

  save(state = this.state) {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(state, null, 2)}\n`);
  }

  enabledPairsForTimeframe(timeframeKey) {
    const pairs = new Map();
    for (const [chatId, chatState] of Object.entries(this.state.chats)) {
      for (const instrument of this.instruments) {
        if (!chatState.instruments[instrument]?.[timeframeKey]) continue;
        const existing = pairs.get(instrument) || { instrument, timeframeKey, chatIds: [] };
        existing.chatIds.push(chatId);
        pairs.set(instrument, existing);
      }
    }
    return [...pairs.values()];
  }

  toggle(chatId, instrument, timeframeKey) {
    const chatState = this.ensureChat(chatId);
    if (!chatState.instruments[instrument] || !(timeframeKey in chatState.instruments[instrument])) {
      return null;
    }

    chatState.instruments[instrument][timeframeKey] = !chatState.instruments[instrument][timeframeKey];
    this.save();
    return chatState.instruments[instrument][timeframeKey];
  }

  isEnabled(chatId, instrument, timeframeKey) {
    const chatState = this.ensureChat(chatId);
    return Boolean(chatState.instruments[instrument]?.[timeframeKey]);
  }

  stopAll(chatId) {
    const chatState = this.ensureChat(chatId);
    for (const instrument of this.instruments) {
      for (const timeframe of this.timeframes) {
        chatState.instruments[instrument][timeframe.key] = false;
      }
    }
    this.save();
  }

  enabledSelections(chatId) {
    const chatState = this.ensureChat(chatId);
    return this.instruments
      .map((instrument) => ({
        instrument,
        timeframes: this.timeframes
          .filter((timeframe) => chatState.instruments[instrument]?.[timeframe.key])
          .map((timeframe) => timeframe.key)
      }))
      .filter((selection) => selection.timeframes.length > 0);
  }
}
