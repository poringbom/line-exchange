const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const LINE_KEY = process.env.LINE_KEY;

app.use(bodyParser.json());

global.config = {};

global.defaultRate = 0;

app.get("/", async (req, res) => {
  global.defaultRate = (await defaultRate()) / 100 ?? 0.0;
  res.sendStatus(200);
});

app.post("/webhook", async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event?.message?.text;
      const replyToken = event?.replyToken;
      const userId = event?.source?.userId;

      await loading(userId);

      if (userMessage.startsWith("#")) {
        const command = userMessage.toLocaleLowerCase();
        if (command.startsWith("#set")) {
          const rate = toNumber(command.split("#set")[1].trim());
          global.config[userId] = rate;
          await replyToUser(replyToken, "Setting OK, Rate is " + rate);
        } else if (command.startsWith("#get")) {
          const rate = await getConfig(userId);
          await replyToUser(replyToken, "Rate is " + rate);
        } else if (command.startsWith("#re")) {
          delete global.config[userId];
          await replyToUser(
            replyToken,
            "Reset OK, Rate is " + global.defaultRate
          );
        } else {
          global.defaultRate = (await defaultRate()) / 100;
          await replyToUser(
            replyToken,
            "now rate from exchange is " + global.defaultRate
          );
        }
      } else {
        if (isNumber(userMessage)) {
          const rate = await getConfig(userId);
          const response = processWithRAG(toNumber(userMessage) * rate);
          await replyToUser(replyToken, response);
        } else {
          global.defaultRate = (await defaultRate()) / 100;
          await replyToUser(
            replyToken,
            "now rate from exchange is " + global.defaultRate
          );
        }
      }
    }
  }
  res.sendStatus(200);
});

function toNumber(text) {
  try {
    return parseFloat(text);
  } catch (error) {
    return 0;
  }
}

function isNumber(text) {
  return !isNaN(parseFloat(text));
}

async function getConfig(userId) {
  const rate = global.config[userId] ?? global.defaultRate;
  if (rate === 0) {
    rate = await defaultRate();
  }
  return rate;
}

function processWithRAG(message) {
  return `${message} THB`;
}

async function defaultRate() {
  const endpoint =
    "https://www.bot.or.th/content/bot/en/statistics/exchange-rate/jcr:content/root/container/statisticstable2.results.level3cache.json";
  const response = await axios.get(endpoint, {});
  const list = response?.data?.responseContent;
  const rate = list?.find((item) => item.currency_id === "JPY")?.selling;
  return rate ?? global.defaultRate;
}

async function loading(userId) {
  const lineEndpoint = "https://api.line.me/v2/bot/chat/loading/start";
  await axios.post(
    lineEndpoint,
    {
      chatId: userId,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_KEY}`,
      },
    }
  );
}

async function replyToUser(replyToken, message) {
  const lineEndpoint = "https://api.line.me/v2/bot/message/reply";
  await axios.post(
    lineEndpoint,
    {
      replyToken: replyToken,
      messages: [
        {
          type: "text",
          text: message,
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_KEY}`,
      },
    }
  );
}

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
});
