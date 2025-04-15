const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/auth");
const { DynamoDB } = require("aws-sdk");
const dynamoDB = new DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

// Map để lưu trữ các kết nối socket theo số điện thoại
const connectedUsers = new Map();

// Helper function để tạo participantId
const createParticipantId = (phone1, phone2) => {
  return [phone1, phone2].sort().join("_");
};

// Controller functions
const getConversations = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    console.log("Getting conversations for user phone:", userPhone);
    const { lastEvaluatedKey, limit = 20 } = req.query;

    // 1. Lấy conversations khi user là người tham gia chính
    const mainParams = {
      TableName: process.env.CONVERSATION_TABLE,
      FilterExpression: "participantId = :phone",
      ExpressionAttributeValues: {
        ":phone": userPhone,
      },
      Limit: parseInt(limit),
    };

    if (lastEvaluatedKey) {
      try {
        mainParams.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
      } catch (e) {
        console.warn("Invalid lastEvaluatedKey:", e);
      }
    }

    // 2. Lấy conversations khi user là người tham gia khác
    const otherParams = {
      TableName: process.env.CONVERSATION_TABLE,
      FilterExpression: "otherParticipantId = :phone",
      ExpressionAttributeValues: {
        ":phone": userPhone,
      },
      Limit: parseInt(limit),
    };

    if (lastEvaluatedKey) {
      try {
        otherParams.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
      } catch (e) {
        console.warn("Invalid lastEvaluatedKey:", e);
      }
    }

    console.log(
      "Querying main conversations:",
      JSON.stringify(mainParams, null, 2)
    );
    const mainResult = await dynamoDB.scan(mainParams).promise();

    console.log(
      "Querying other conversations:",
      JSON.stringify(otherParams, null, 2)
    );
    const otherResult = await dynamoDB.scan(otherParams).promise();

    // 3. Kết hợp và loại bỏ trùng lặp dựa trên conversationId
    const conversationMap = new Map();

    mainResult.Items.forEach((item) => {
      conversationMap.set(item.conversationId, item);
    });

    otherResult.Items.forEach((item) => {
      if (!conversationMap.has(item.conversationId)) {
        conversationMap.set(item.conversationId, item);
      }
    });

    // Chuyển map thành array và sắp xếp
    let conversations = Array.from(conversationMap.values());
    conversations.sort((a, b) => b.updatedAt - a.updatedAt);

    // Format lại response để dễ đọc hơn
    const formattedConversations = conversations.map((conv) => ({
      conversationId: conv.conversationId,
      participant: {
        phone: conv.participantId,
        isCurrentUser: conv.participantId === userPhone,
      },
      otherParticipant: {
        phone: conv.otherParticipantId,
        isCurrentUser: conv.otherParticipantId === userPhone,
      },
      lastMessage: {
        content: conv.lastMessage.content,
        senderId: conv.lastMessage.senderId,
        timestamp: conv.lastMessage.timestamp,
        isFromMe: conv.lastMessage.senderId === userPhone,
      },
      timestamps: {
        created: conv.createdAt,
        updated: conv.updatedAt,
      },
    }));

    // Xác định có data tiếp theo không
    const hasMoreMain = !!mainResult.LastEvaluatedKey;
    const hasMoreOther = !!otherResult.LastEvaluatedKey;
    const hasMore = hasMoreMain || hasMoreOther;

    // Tạo lastEvaluatedKey cho lần query tiếp theo
    const nextLastEvaluatedKey = hasMore
      ? {
          main: mainResult.LastEvaluatedKey,
          other: otherResult.LastEvaluatedKey,
        }
      : null;

    res.json({
      status: "success",
      data: {
        conversations: formattedConversations,
        pagination: {
          total: formattedConversations.length,
          hasMore,
          lastEvaluatedKey: nextLastEvaluatedKey
            ? JSON.stringify(nextLastEvaluatedKey)
            : null,
          currentPage: lastEvaluatedKey
            ? parseInt(JSON.parse(lastEvaluatedKey).page || 1) + 1
            : 1,
          limit: parseInt(limit),
        },
      },
      debug: {
        userPhone,
        mainConversationsFound: mainResult.Items.length,
        otherConversationsFound: otherResult.Items.length,
        totalUnique: formattedConversations.length,
        hasMoreMain,
        hasMoreOther,
        mainLastKey: mainResult.LastEvaluatedKey,
        otherLastKey: otherResult.LastEvaluatedKey,
      },
    });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({
      status: "error",
      message: "Đã xảy ra lỗi khi lấy danh sách cuộc trò chuyện",
      error: error.message,
      debug: {
        userPhone: req.user.phone,
        errorStack: error.stack,
      },
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const { phone } = req.params;
    const currentUserPhone = req.user.phone;

    // Tạo conversationId
    const conversationId = createParticipantId(currentUserPhone, phone);

    // Query using GSI
    const params = {
      TableName: process.env.MESSAGE_TABLE,
      IndexName: "conversationIndex",
      KeyConditionExpression: "conversationId = :conversationId",
      ExpressionAttributeValues: {
        ":conversationId": conversationId,
      },
      ScanIndexForward: true, // true để sắp xếp theo thời gian tăng dần
    };

    // Nếu có lastEvaluatedKey, thêm vào params
    if (req.query.lastEvaluatedKey) {
      params.ExclusiveStartKey = JSON.parse(req.query.lastEvaluatedKey);
    }

    // Nếu có limit, thêm vào params
    if (req.query.limit) {
      params.Limit = parseInt(req.query.limit);
    }

    const result = await dynamoDB.query(params).promise();

    res.json({
      status: "success",
      data: {
        messages: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey
          ? JSON.stringify(result.LastEvaluatedKey)
          : null,
      },
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({
      status: "error",
      message: "Đã xảy ra lỗi khi lấy lịch sử chat",
    });
  }
};

// Tạo hoặc cập nhật conversation
const upsertConversation = async (senderPhone, receiverPhone, lastMessage) => {
  try {
    console.log("Starting upsertConversation:", {
      senderPhone,
      receiverPhone,
      lastMessage,
    });

    const conversationId = createParticipantId(senderPhone, receiverPhone);
    const timestamp = Date.now();

    console.log("Created conversationId:", conversationId);

    // Kiểm tra conversation đã tồn tại chưa
    const getParams = {
      TableName: process.env.CONVERSATION_TABLE,
      Key: {
        conversationId,
      },
    };

    console.log("Checking existing conversation...");
    const existingConversation = await dynamoDB.get(getParams).promise();
    console.log("Existing conversation:", existingConversation);

    // Tạo conversation cho người gửi
    const params = {
      TableName: process.env.CONVERSATION_TABLE,
      Item: {
        conversationId,
        participantId: senderPhone,
        otherParticipantId: receiverPhone,
        lastMessage: {
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          senderId: lastMessage.senderId,
        },
        updatedAt: timestamp,
        timestamp: timestamp,
        createdAt: existingConversation.Item
          ? existingConversation.Item.createdAt
          : timestamp,
      },
    };

    console.log(
      "Putting sender conversation:",
      JSON.stringify(params, null, 2)
    );
    await dynamoDB.put(params).promise();

    // Tạo conversation cho người nhận
    const reverseParams = {
      TableName: process.env.CONVERSATION_TABLE,
      Item: {
        conversationId,
        participantId: receiverPhone,
        otherParticipantId: senderPhone,
        lastMessage: {
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          senderId: lastMessage.senderId,
        },
        updatedAt: timestamp,
        timestamp: timestamp,
        createdAt: params.Item.createdAt,
      },
    };

    console.log(
      "Putting receiver conversation:",
      JSON.stringify(reverseParams, null, 2)
    );
    await dynamoDB.put(reverseParams).promise();

    console.log("Successfully created/updated conversations");
    return params.Item;
  } catch (error) {
    console.error("Error in upsertConversation:", error);
    console.error("Stack trace:", error.stack);
    throw error;
  }
};

// Socket handler
const initializeSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    try {
      const userPhone = socket.user.phone;
      console.log("User connected:", userPhone);

      connectedUsers.set(userPhone, socket);
      socket.broadcast.emit("user-online", { phone: userPhone });

      socket.on("send-message", async (data) => {
        try {
          console.log("Received send-message event:", data);
          const { receiverPhone, content } = data;

          if (!receiverPhone || !content) {
            console.log("Missing receiverPhone or content");
            socket.emit("error", {
              message: "Thiếu thông tin người nhận hoặc nội dung tin nhắn",
            });
            return;
          }

          if (content.length > 200) {
            console.log("Message too long");
            socket.emit("error", { message: "Tin nhắn quá dài" });
            return;
          }

          const messageId = uuidv4();
          const timestamp = Date.now();

          const conversationId = createParticipantId(userPhone, receiverPhone);
          console.log("Created conversationId:", conversationId);

          const messageParams = {
            TableName: process.env.MESSAGE_TABLE,
            Item: {
              messageId,
              conversationId,
              senderPhone: userPhone,
              receiverPhone,
              content,
              timestamp,
              status: "sent",
              type: "text",
            },
          };

          console.log("Saving message:", messageParams);
          await dynamoDB.put(messageParams).promise();
          console.log("Message saved successfully");

          console.log("Updating conversation...");
          await upsertConversation(userPhone, receiverPhone, {
            content,
            timestamp,
            senderId: userPhone,
          });
          console.log("Conversation updated successfully");

          const receiverSocket = connectedUsers.get(receiverPhone);
          if (receiverSocket) {
            console.log("Emitting new-message to receiver:", receiverPhone);
            receiverSocket.emit("new-message", {
              messageId,
              conversationId,
              senderPhone: userPhone,
              content,
              timestamp,
              status: "delivered",
            });
          }

          console.log("Emitting message-sent to sender");
          socket.emit("message-sent", {
            messageId,
            status: "sent",
          });
        } catch (error) {
          console.error("Error in send-message:", error);
          console.error("Stack trace:", error.stack);
          socket.emit("error", { message: "Lỗi khi gửi tin nhắn" });
        }
      });

      socket.on("typing", (data) => {
        try {
          const { receiverPhone } = data;
          if (!receiverPhone) {
            socket.emit("error", { message: "Thiếu thông tin người nhận" });
            return;
          }

          const receiverSocket = connectedUsers.get(receiverPhone);
          if (receiverSocket) {
            receiverSocket.emit("typing", { senderPhone: userPhone });
          }
        } catch (error) {
          console.error("Error handling typing indicator:", error);
        }
      });

      socket.on("stop-typing", (data) => {
        try {
          const { receiverPhone } = data;
          if (!receiverPhone) {
            socket.emit("error", { message: "Thiếu thông tin người nhận" });
            return;
          }

          const receiverSocket = connectedUsers.get(receiverPhone);
          if (receiverSocket) {
            receiverSocket.emit("stop-typing", { senderPhone: userPhone });
          }
        } catch (error) {
          console.error("Error handling stop typing:", error);
        }
      });

      socket.on("disconnect", () => {
        try {
          connectedUsers.delete(userPhone);
          socket.broadcast.emit("user-offline", { phone: userPhone });
        } catch (error) {
          console.error("Error handling disconnect:", error);
        }
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });
    } catch (error) {
      console.error("Error in socket connection:", error);
      socket.disconnect();
    }
  });
};

// Recall message handler
const recallMessage = async (req, res) => {
  try {
    const { messageId, receiverPhone } = req.body;
    const senderPhone = req.user.phone;

    // Tạo conversationId
    const conversationId = createParticipantId(senderPhone, receiverPhone);

    // Kiểm tra tin nhắn tồn tại bằng query
    const queryParams = {
      TableName: process.env.MESSAGE_TABLE,
      IndexName: "conversationIndex",
      KeyConditionExpression: "conversationId = :conversationId",
      FilterExpression: "messageId = :messageId",
      ExpressionAttributeValues: {
        ":conversationId": conversationId,
        ":messageId": messageId,
      },
    };

    const messages = await dynamoDB.query(queryParams).promise();

    if (!messages.Items || messages.Items.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy tin nhắn",
      });
    }

    const message = messages.Items[0];

    // Kiểm tra người thu hồi có phải người gửi không
    if (message.senderPhone !== senderPhone) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền thu hồi tin nhắn này",
      });
    }

    // Cập nhật trạng thái tin nhắn với key structure đúng
    const updateParams = {
      TableName: process.env.MESSAGE_TABLE,
      Key: {
        messageId: messageId,
        timestamp: message.timestamp, // Sử dụng timestamp từ tin nhắn gốc
      },
      UpdateExpression: "set #status = :status, content = :content",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "recalled",
        ":content": "Tin nhắn đã bị thu hồi",
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDB.update(updateParams).promise();

    // Cập nhật conversation với tin nhắn mới
    await upsertConversation(senderPhone, receiverPhone, {
      content: "Tin nhắn đã bị thu hồi",
      timestamp: Date.now(),
      senderId: senderPhone,
    });

    // Gửi sự kiện thu hồi tin nhắn qua socket
    const receiverSocket = connectedUsers.get(receiverPhone);
    if (receiverSocket) {
      receiverSocket.emit("message-recalled", {
        messageId,
        conversationId,
        content: "Tin nhắn đã bị thu hồi",
      });
    }

    res.json({
      status: "success",
      message: "Đã thu hồi tin nhắn thành công",
      data: result.Attributes,
    });
  } catch (error) {
    console.error("Error recalling message:", error);
    res.status(500).json({
      status: "error",
      message: "Đã xảy ra lỗi khi thu hồi tin nhắn",
      error: error.message,
    });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.body; // Lấy messageId từ body thay vì params
    const userPhone = req.user.phone;

    // Đầu tiên tìm tin nhắn để lấy timestamp
    const queryParams = {
      TableName: process.env.MESSAGE_TABLE,
      IndexName: "conversationIndex",
      FilterExpression: "messageId = :messageId",
      ExpressionAttributeValues: {
        ":messageId": messageId,
      },
    };

    const messages = await dynamoDB.scan(queryParams).promise();

    if (!messages.Items || messages.Items.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy tin nhắn",
      });
    }

    const message = messages.Items[0];

    // Kiểm tra quyền xóa
    if (message.senderPhone !== userPhone) {
      return res.status(403).json({
        status: "error",
        message: "Không có quyền xóa tin nhắn này",
      });
    }

    // Xóa tin nhắn (soft delete) với key structure đúng
    const updateParams = {
      TableName: process.env.MESSAGE_TABLE,
      Key: {
        messageId: messageId,
        timestamp: message.timestamp,
      },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "deleted",
      },
    };

    await dynamoDB.update(updateParams).promise();

    // Emit socket event nếu cần
    const receiverSocket = connectedUsers.get(message.receiverPhone);
    if (receiverSocket) {
      receiverSocket.emit("message-deleted", {
        messageId,
        conversationId: message.conversationId,
      });
    }

    res.json({
      status: "success",
      message: "Đã xóa tin nhắn",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      status: "error",
      message: "Lỗi khi xóa tin nhắn",
    });
  }
};

const forwardMessage = async (req, res) => {
  try {
    const { messageId, receiverPhone, content } = req.body;
    const senderPhone = req.user.phone;

    // Tìm tin nhắn gốc bằng scan với index
    const queryParams = {
      TableName: process.env.MESSAGE_TABLE,
      IndexName: "conversationIndex",
      FilterExpression: "messageId = :messageId",
      ExpressionAttributeValues: {
        ":messageId": messageId,
      },
    };

    const messages = await dynamoDB.scan(queryParams).promise();

    if (!messages.Items || messages.Items.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy tin nhắn gốc",
      });
    }

    const originalMessage = messages.Items[0];

    // Tạo tin nhắn mới
    const newMessageId = uuidv4();
    const conversationId = createParticipantId(senderPhone, receiverPhone);
    const timestamp = Date.now();

    const newMessage = {
      messageId: newMessageId,
      timestamp: timestamp, // Thêm timestamp vào key
      conversationId,
      content: content || originalMessage.content, // Sử dụng content từ request hoặc tin nhắn gốc
      senderPhone,
      receiverPhone,
      status: "sent",
      type: "forwarded",
      originalMessageId: messageId,
    };

    // Lưu tin nhắn mới
    await dynamoDB
      .put({
        TableName: process.env.MESSAGE_TABLE,
        Item: newMessage,
      })
      .promise();

    // Cập nhật conversation
    await upsertConversation(senderPhone, receiverPhone, {
      content: newMessage.content,
      senderId: senderPhone,
      timestamp,
    });

    // Gửi thông báo qua socket cho người nhận
    const receiverSocket = connectedUsers.get(receiverPhone);
    if (receiverSocket) {
      receiverSocket.emit("new-message", newMessage);
    }

    res.json({
      status: "success",
      data: {
        message: newMessage,
      },
    });
  } catch (error) {
    console.error("Error forwarding message:", error);
    res.status(500).json({
      status: "error",
      message: "Lỗi khi chuyển tiếp tin nhắn",
      error: error.message,
    });
  }
};

// Đăng ký routes
router.get("/conversations", authMiddleware, getConversations);
router.get("/history/:phone", authMiddleware, getChatHistory);
router.put("/messages/recall", authMiddleware, recallMessage);
router.delete("/messages/delete", authMiddleware, deleteMessage);
router.post("/messages/forward", authMiddleware, forwardMessage);

// Export
module.exports = {
  routes: router,
  socket: initializeSocket,
  connectedUsers,
};
