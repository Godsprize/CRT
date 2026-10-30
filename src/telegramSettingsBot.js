export class TelegramSettingsBot {
  constructor({ notifier, settingsStore, instruments, timeframes, allowedChatIds = [], pageSize = 10 }) {
    this.notifier = notifier;
    this.settingsStore = settingsStore;
    this.instruments = instruments;
    this.timeframes = timeframes;
    this.allowedChatIds = allowedChatIds.map(String);
    this.pageSize = pageSize;
    this.categories = buildCategories(instruments);
    this.offset = undefined;
    this.stopped = false;
  }

  start() {
    if (!this.notifier.isConfigured()) {
      console.log("[telegram] Not configured. Settings interface is disabled.");
      return;
    }

    this.bootstrap();
  }

  async bootstrap() {
    try {
      await this.notifier.deleteWebhook();
      console.log("[telegram] Webhook cleared; polling for updates.");
    } catch (error) {
      console.error(`[telegram] Could not clear webhook: ${error.message}`);
    }

    this.loop();
  }

  stop() {
    this.stopped = true;
  }

  async loop() {
    while (!this.stopped) {
      try {
        const updates = await this.notifier.getUpdates({ offset: this.offset });
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.error(`[telegram] ${error.message}`);
        await sleep(5000);
      }
    }
  }

  async handleUpdate(update) {
    if (update.message) {
      await this.handleMessage(update.message);
    }

    if (update.callback_query) {
      await this.handleCallback(update.callback_query);
    }
  }

  async handleMessage(message) {
    if (!this.isAllowedChat(message.chat.id)) return;
    const text = message.text || "";
    if (text.startsWith("/start") || text.startsWith("/settings")) {
      this.settingsStore.ensureChat(message.chat.id);
      await this.notifier.sendMessageWithKeyboard(this.mainText(), this.mainKeyboard(message.chat.id), message.chat.id);
    }
  }

  async handleCallback(callback) {
    const chatId = callback.message?.chat?.id;
    if (!this.isAllowedChat(chatId)) return;

    const data = callback.data || "";
    if (data === "home") {
      await this.updateCallbackMessage(callback, this.mainText(), this.mainKeyboard(chatId));
      return;
    }

    if (data === "status") {
      await this.updateCallbackMessage(callback, this.statusText(chatId), this.statusKeyboard());
      return;
    }

    if (data === "stop_prompt") {
      await this.updateCallbackMessage(callback, this.stopPromptText(), this.stopPromptKeyboard());
      return;
    }

    if (data === "stop_confirm") {
      this.settingsStore.stopAll(chatId);
      await this.updateCallbackMessage(
        callback,
        "All monitoring is now stopped. The bot is still online, but no instruments/timeframes are active.",
        this.statusKeyboard(),
        "Monitoring stopped"
      );
      return;
    }

    if (data.startsWith("category:")) {
      const [, categoryKey, pageText = "0"] = data.split(":");
      const page = Number(pageText);
      await this.updateCallbackMessage(
        callback,
        this.categoryText(categoryKey, page),
        this.categoryKeyboard(categoryKey, page, chatId)
      );
      return;
    }

    if (data.startsWith("instrument:")) {
      const [, categoryKey, indexText] = data.split(":");
      const index = Number(indexText);
      const instrument = this.instrumentAt(index);
      if (!instrument) {
        await this.notifier.answerCallbackQuery(callback.id, "Instrument is no longer available");
        return;
      }
      await this.updateCallbackMessage(
        callback,
        this.instrumentText(instrument),
        this.instrumentKeyboard(instrument, index, categoryKey, chatId)
      );
      return;
    }

    if (data.startsWith("toggle:")) {
      const [, categoryKey, indexText, timeframeKey] = data.split(":");
      const index = Number(indexText);
      const instrument = this.instrumentAt(index);
      if (!instrument) {
        await this.notifier.answerCallbackQuery(callback.id, "Instrument is no longer available");
        return;
      }
      const enabled = this.settingsStore.toggle(chatId, instrument.symbol, timeframeKey);
      await this.updateCallbackMessage(
        callback,
        this.instrumentText(instrument),
        this.instrumentKeyboard(instrument, index, categoryKey, chatId),
        enabled === null ? "Unknown setting" : `${timeframeKey} ${enabled ? "on" : "off"}`
      );
    }
  }

  async updateCallbackMessage(callback, text, replyMarkup, callbackText = "") {
    await this.notifier.answerCallbackQuery(callback.id, callbackText);
    await this.notifier.editMessageWithKeyboard({
      chatId: callback.message.chat.id,
      messageId: callback.message.message_id,
      text,
      replyMarkup
    });
  }

  mainText() {
    return [
      "<b>CRT control panel</b>",
      "Choose a command or open a market group."
    ].join("\n");
  }

  mainKeyboard(chatId) {
    const rows = [
      [{ text: "STATUS", callback_data: "status" }],
      [{ text: "STOP ALL MONITORING", callback_data: "stop_prompt" }]
    ];
    rows.push(
      ...this.categories
        .filter((category) => category.instruments.length > 0)
        .map((category) => [
          {
            text: `${category.label}: ${this.categoryStatus(category, chatId)}`,
            callback_data: `category:${category.key}:0`
          }
        ])
    );

    return {
      inline_keyboard: rows
    };
  }

  statusText(chatId) {
    const selections = this.settingsStore.enabledSelections(chatId);
    if (selections.length === 0) {
      return [
        "<b>Monitoring status</b>",
        "Nothing is active.",
        "Open a market group and turn on the timeframes you want."
      ].join("\n");
    }

    const lines = ["<b>Monitoring status</b>", `${selections.length} instrument(s) active`, ""];
    for (const category of this.categories) {
      const grouped = selections.filter((selection) =>
        category.instruments.some((instrument) => instrument.symbol === selection.instrument)
      );
      if (grouped.length === 0) continue;

      lines.push(`<b>${escapeHtml(category.label)}</b>`);
      for (const selection of grouped) {
        const instrument = this.instruments.find((item) => item.symbol === selection.instrument);
        lines.push(`${escapeHtml(instrument?.displayName || selection.instrument)}: ${selection.timeframes.join(", ")}`);
      }
      lines.push("");
    }

    return lines.join("\n").trim();
  }

  statusKeyboard() {
    return {
      inline_keyboard: [
        [{ text: "Refresh", callback_data: "status" }],
        [{ text: "Back", callback_data: "home" }]
      ]
    };
  }

  stopPromptText() {
    return [
      "<b>Stop all monitoring?</b>",
      "This turns every instrument and timeframe OFF.",
      "The Railway bot stays online, and you can turn things back on any time."
    ].join("\n");
  }

  stopPromptKeyboard() {
    return {
      inline_keyboard: [
        [{ text: "YES, STOP ALL", callback_data: "stop_confirm" }],
        [{ text: "Cancel", callback_data: "home" }]
      ]
    };
  }

  categoryText(categoryKey, page = 0) {
    const category = this.categoryByKey(categoryKey);
    if (!category) return this.mainText();

    const totalPages = this.totalPages(category);
    const safePage = clamp(page, 0, totalPages - 1);
    return [
      `<b>${escapeHtml(category.label)}</b>`,
      "Select an instrument, then choose timeframes.",
      `Page ${safePage + 1} of ${totalPages}`
    ].join("\n");
  }

  categoryKeyboard(categoryKey, page = 0, chatId) {
    const category = this.categoryByKey(categoryKey);
    if (!category) return this.mainKeyboard();

    const safePage = clamp(page, 0, this.totalPages(category) - 1);
    const start = safePage * this.pageSize;
    const visible = category.instruments.slice(start, start + this.pageSize);
    const rows = visible.map((instrument) => [
      {
        text: `${this.instrumentStatus(chatId, instrument.symbol)} ${instrument.displayName}`,
        callback_data: `instrument:${category.key}:${this.instruments.indexOf(instrument)}`
      }
    ]);
    const nav = [];
    if (safePage > 0) nav.push({ text: "Prev", callback_data: `category:${category.key}:${safePage - 1}` });
    if (safePage < this.totalPages(category) - 1) {
      nav.push({ text: "Next", callback_data: `category:${category.key}:${safePage + 1}` });
    }
    if (nav.length > 0) rows.push(nav);
    rows.push([{ text: "Back", callback_data: "home" }]);

    return {
      inline_keyboard: rows
    };
  }

  instrumentText(instrument) {
    return [
      `<b>${escapeHtml(instrument.displayName)}</b>`,
      `Symbol: <code>${escapeHtml(instrument.symbol)}</code>`,
      `Market: ${escapeHtml(instrument.market)}`,
      `Exchange: ${instrument.isOpen ? "open" : "closed"}`,
      "Toggle the CRT scan timeframes for this instrument."
    ].join("\n");
  }

  instrumentKeyboard(instrument, index, categoryKey, chatId) {
    const category = this.categoryByKey(categoryKey) || this.categoryByKey(instrument.category);
    const indexInCategory = category?.instruments.findIndex((item) => item.symbol === instrument.symbol) ?? 0;
    const page = Math.floor(Math.max(0, indexInCategory) / this.pageSize);
    const backCategoryKey = category?.key || instrument.category || "other";
    return {
      inline_keyboard: [
        ...this.timeframes.map((timeframe) => [
          {
            text: `${this.settingsStore.isEnabled(chatId, instrument.symbol, timeframe.key) ? "ON" : "OFF"} ${timeframe.label}`,
            callback_data: `toggle:${backCategoryKey}:${index}:${timeframe.key}`
          }
        ]),
        [{ text: "Back", callback_data: `category:${backCategoryKey}:${page}` }]
      ]
    };
  }

  instrumentStatus(chatId, symbol) {
    const enabledCount = this.timeframes.filter((timeframe) =>
      this.settingsStore.isEnabled(chatId, symbol, timeframe.key)
    ).length;
    return enabledCount === 0 ? "OFF" : `${enabledCount} ON`;
  }

  instrumentAt(index) {
    return Number.isInteger(index) ? this.instruments[index] : null;
  }

  totalPages(category) {
    return Math.max(1, Math.ceil(category.instruments.length / this.pageSize));
  }

  categoryByKey(categoryKey) {
    return this.categories.find((category) => category.key === categoryKey);
  }

  categoryStatus(category, chatId) {
    const enabledCount = category.instruments.reduce(
      (sum, instrument) =>
        sum +
        this.timeframes.filter((timeframe) =>
          this.settingsStore.isEnabled(chatId, instrument.symbol, timeframe.key)
        ).length,
      0
    );
    return enabledCount === 0 ? "OFF" : `${enabledCount} ON`;
  }

  isAllowedChat(chatId) {
    return this.allowedChatIds.length === 0 || this.allowedChatIds.includes(String(chatId));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function buildCategories(instruments) {
  const definitions = [
    { key: "currency_pairs", label: "CURRENCIES" },
    { key: "boom_crash", label: "BOOM & CRASH" },
    { key: "volatility", label: "VOLATILITY" },
    { key: "gold", label: "GOLD" },
    { key: "nas_us100", label: "NAS / USTEC / US100" },
    { key: "us30_dow", label: "US30 / DOW JONES" },
    { key: "indices", label: "OTHER INDICES" },
    { key: "crypto", label: "CRYPTO" },
    { key: "commodities", label: "COMMODITIES" },
    { key: "deriv_indices", label: "OTHER DERIV INDICES" },
    { key: "other", label: "OTHER" }
  ];

  return definitions.map((definition) => ({
    ...definition,
    instruments: instruments.filter((instrument) => instrument.category === definition.key)
  }));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
