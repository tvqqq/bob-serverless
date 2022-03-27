"use strict";
const fetch = require("node-fetch");

module.exports.post = async (event) => {
  // env
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

  const body = JSON.parse(event.body);
  const message = body.message;
  console.log("message debugger", message);
  if (message.entities === undefined) {
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: "Done!",
        },
        null,
        2
      ),
    };
  }

  const text = message.text;
  const urlEntities = message.entities.filter((e) => e.type === "url");
  const hashTagEntities = message.entities.filter((e) => e.type === "hashtag");

  // Not a formated message -> stop process.
  if (urlEntities.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: "Done!",
        },
        null,
        2
      ),
    };
  }

  const url = text.substring(urlEntities[0].offset, urlEntities[0].length);
  const hashTags = [];
  let latestOffset = 0;
  hashTagEntities.map((hashTagEntity) => {
    const hashTag = text.substring(
      hashTagEntity.offset + 1,
      hashTagEntity.offset + hashTagEntity.length
    );
    hashTags.push({ name: hashTag });
    latestOffset = hashTagEntity.offset + hashTagEntity.length;
  });
  const description = text.substring(latestOffset + 1);
  const timestamp = message.date.toString();

  const dataSend = {
    parent: {
      database_id: NOTION_DATABASE_ID,
    },
    properties: {
      URL: {
        url: url,
      },
      Hashtags: {
        multi_select: hashTags,
      },
      Description: {
        rich_text: [
          {
            text: {
              content: description,
            },
          },
        ],
      },
      Timestamp: {
        title: [
          {
            type: "text",
            text: {
              content: timestamp,
            },
          },
        ],
      },
    },
  };

  await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Notion-Version": "2022-02-22",
      Authorization: "Bearer " + NOTION_TOKEN,
    },
    body: JSON.stringify(dataSend),
  })
    .then((response) => response.json())
    .then(async (data) => {
      await notifyTelegram(
        data,
        message.message_id,
        message.chat.id,
        TELEGRAM_TOKEN
      );
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Done!",
      },
      null,
      2
    ),
  };
};

const notifyTelegram = async (data, messageId, chatId, telegramToken) => {
  let message = "";
  if (data.object === "error") {
    message = "⭕️ *ERROR*" + "```" + data.message + "```";
  } else {
    message = "✅ DONE";
  }

  const dataSend = {
    chat_id: chatId,
    text: message,
    parse_mode: "MarkdownV2",
    reply_to_message_id: messageId,
  };

  await fetch("https://api.telegram.org/bot" + telegramToken + "/sendMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dataSend),
  }).catch((error) => {
    console.error("Error:", error);
  });
};
