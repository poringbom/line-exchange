const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const LINE_KEY = process.env.LINE_KEY;

app.use(bodyParser.json());

const config = {};

app.post("/webhook", async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event.message.text;
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      if (userMessage.startsWith("#set")) {
        const rate = toNumber(userMessage.split("#set")[1].trim());
        config[userId] = rate;
        await replyToUser(replyToken, "Setting OK");
      } else {
        const rate = getConfig(userId);
        const response = processWithRAG(toNumber(userMessage) * rate);
        await replyToUser(replyToken, response);
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

function getConfig(userId) {
  const rate = config[userId];
  if (rate === undefined || rate === null) {
    return 0.22;
  } else {
    return rate;
  }
}

function processWithRAG(message) {
  return `${message} THB`;
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
