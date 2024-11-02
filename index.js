const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const LINE_KEY = process.env.LINE_KEY;

app.use(bodyParser.json());

const config = {};

let _defaultRate = 0;

app.get("/", async (req, res) => {
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
          config[userId] = rate;
          await replyToUser(replyToken, "Setting OK");
        } else if (command.startsWith("#get")) {
          const rate = getConfig(userId);
          await replyToUser(replyToken, "Rate is " + rate);
        } else if (command.startsWith("#re")) {
          _defaultRate = await defaultRate();
          delete config[userId];
          await replyToUser(replyToken, "refresh OK, Rate is " + _defaultRate);
        } else {
          const now = await defaultRate();
          await replyToUser(replyToken, "now rate from exchange is " + now);
        }
      } else {
        if (isNumber(userMessage)) {
          const rate = getConfig(userId);
          const response = processWithRAG(toNumber(value) * rate);
          await replyToUser(replyToken, response);
        } else {
          const now = await defaultRate();
          await replyToUser(replyToken, "now rate from exchange is " + now);
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

function getConfig(userId) {
  return config[userId] ?? _defaultRate;
}

function processWithRAG(message) {
  return `${message} THB`;
}

async function defaultRate() {
  const endpoint =
    "https://www.mastercard.us/settlement/currencyrate/conversion-rate?fxDate=0000-00-00&transCurr=JPY&crdhldBillCurr=THB&bankFee=0&transAmt=1";
  const response = await axios.get(endpoint, {});
  const conversionRate = response?.data?.data?.conversionRate ?? _defaultRate;
  return conversionRate;
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
  _defaultRate = await defaultRate();
  console.log(`Server is running on port ${PORT}`);
});
