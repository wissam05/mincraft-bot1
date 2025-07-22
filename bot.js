const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("bedrock-protocol");

const bot = new TelegramBot(token, { polling: true });



let client = null;
let isConnected = false;
let serverData = null; // يخزن بيانات السيرفر الحالي { ip, port, username }

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "▶️ دخول البوت للسيرفر", callback_data: "connect" }],
      [{ text: "⏹ إخراج البوت من السيرفر", callback_data: "disconnect" }],
      [{ text: "➕ إضافة سيرفر جديد", callback_data: "add_server" }],
      [{ text: "🗑 حذف السيرفر الحالي", callback_data: "delete_server" }],
    ],
  },
};

bot.onText(/\/start/, (msg) => {
  if (msg.from.id !== ownerId) return;
  bot.sendMessage(msg.chat.id, "مرحبًا! تحكم في بوت ماينكرافت عبر الأزرار:", mainMenu);
});

// التعامل مع الضغط على الأزرار
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (userId !== ownerId) {
    return bot.answerCallbackQuery(callbackQuery.id, { text: "غير مصرح لك.", show_alert: true });
  }

  switch (data) {
    case "connect":
      if (!serverData) {
        return bot.sendMessage(msg.chat.id, "⚠️ لا يوجد سيرفر مُخزن، الرجاء إضافة سيرفر جديد أولاً.");
      }
      if (isConnected) {
        return bot.sendMessage(msg.chat.id, "⚠️ البوت متصل بالفعل.");
      }
      connectToServer(msg.chat.id);
      break;

    case "disconnect":
      if (!isConnected) {
        return bot.sendMessage(msg.chat.id, "⚠️ البوت غير متصل بأي سيرفر.");
      }
      disconnectFromServer(msg.chat.id);
      break;

    case "add_server":
      bot.sendMessage(msg.chat.id, "📝 أرسل بيانات السيرفر الجديد بالصيغة:\n`ip port username`", { parse_mode: "Markdown" });
      // ننتظر رسالة جديدة فيها بيانات السيرفر
      break;

    case "delete_server":
      if (!serverData) {
        return bot.sendMessage(msg.chat.id, "⚠️ لا يوجد سيرفر ليتم حذفه.");
      }
      if (isConnected) {
        disconnectFromServer(msg.chat.id);
      }
      serverData = null;
      bot.sendMessage(msg.chat.id, "✅ تم حذف بيانات السيرفر الحالي.");
      break;
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// استقبال رسالة لإضافة سيرفر جديد
bot.on("message", (msg) => {
  if (msg.from.id !== ownerId) return;
  if (msg.text.startsWith("/")) return; // تجاهل الأوامر

  // لو الرسالة محتوى بيانات السيرفر (ip port username)
  const parts = msg.text.trim().split(/\s+/);
  if (parts.length === 3) {
    const [ip, portStr, username] = parts;
    const port = parseInt(portStr);
    if (isNaN(port)) {
      return bot.sendMessage(msg.chat.id, "❌ المنفذ يجب أن يكون رقمًا صحيحًا.");
    }
    serverData = { ip, port, username };
    bot.sendMessage(msg.chat.id, `✅ تم إضافة السيرفر:\n- IP: ${ip}\n- Port: ${port}\n- Username: ${username}`, mainMenu);
  }
});

// دالة الاتصال بالسيرفر
function connectToServer(chatId) {
  bot.sendMessage(chatId, `⏳ جاري الاتصال بـ ${serverData.ip}:${serverData.port} باسم ${serverData.username}...`);

  client = createClient({
    host: serverData.ip,
    port: serverData.port,
    username: serverData.username,
    offline: true,
  });

  client.on("spawn", () => {
    isConnected = true;
    bot.sendMessage(chatId, "✅ دخل البوت إلى السيرفر!");
  });

  client.on("disconnect", () => {
    isConnected = false;
    bot.sendMessage(chatId, "📤 خرج البوت من السيرفر.");
  });

  client.on("close", () => {
    isConnected = false;
    bot.sendMessage(chatId, "📤 تم قطع الاتصال (close event).");
  });

  client.on("error", (err) => {
    isConnected = false;
    bot.sendMessage(chatId, `❌ خطأ: ${err.message}`);
    console.error("Error:", err);
  });
}

// دالة قطع الاتصال
function disconnectFromServer(chatId) {
  if (client && isConnected) {
    client.close();
    isConnected = false;
    bot.sendMessage(chatId, "✅ تم إخراج البوت من السيرفر.");
  } else {
    bot.sendMessage(chatId, "⚠️ البوت غير متصل.");
  }
}
