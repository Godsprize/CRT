export class TelegramNotifier {
  constructor({ botToken, chatId }) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  isConfigured() {
    return Boolean(this.botToken);
  }

  async sendMessage(text, chatId = this.chatId) {
    if (!this.isConfigured()) {
      console.log("[telegram:dry-run]", text);
      return { ok: true, dryRun: true };
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram sendMessage failed: ${payload.description || response.statusText}`);
    }
    return payload;
  }

  async sendPhoto({ chatId = this.chatId, imageBuffer, caption, filename = "crt-pattern.png" }) {
    if (!this.isConfigured()) {
      console.log("[telegram:dry-run-photo]", chatId, caption, `${imageBuffer.length} bytes`);
      return { ok: true, dryRun: true };
    }

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([imageBuffer], { type: "image/png" }), filename);

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
      method: "POST",
      body: form
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram sendPhoto failed: ${payload.description || response.statusText}`);
    }
    return payload;
  }

  async sendMessageWithKeyboard(text, replyMarkup, chatId = this.chatId) {
    if (!this.isConfigured()) {
      console.log("[telegram:dry-run]", chatId, text, JSON.stringify(replyMarkup));
      return { ok: true, dryRun: true };
    }

    return this.request("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup
    });
  }

  async editMessageWithKeyboard({ chatId, messageId, text, replyMarkup }) {
    if (!this.isConfigured()) return { ok: true, dryRun: true };

    return this.request("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup
    });
  }

  async answerCallbackQuery(callbackQueryId, text = "") {
    if (!this.isConfigured()) return { ok: true, dryRun: true };

    return this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text
    });
  }

  async getUpdates({ offset, timeout = 25 }) {
    if (!this.isConfigured()) return [];

    const payload = await this.request("getUpdates", {
      offset,
      timeout,
      allowed_updates: ["message", "callback_query"]
    });
    return payload.result || [];
  }

  async deleteWebhook() {
    if (!this.isConfigured()) return { ok: true, dryRun: true };
    return this.request("deleteWebhook", {
      drop_pending_updates: false
    });
  }

  async request(method, body) {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram ${method} failed: ${payload.description || response.statusText}`);
    }
    return payload;
  }
}
