const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/auth");
const { DynamoDB } = require("aws-sdk");
const dynamoDB = new DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { uploadToS3 } = require("../media/services");

// Map để lưu trữ các kết nối socket theo số điện thoại
const connectedUsers = new Map();

// Helper function để tạo participantId
const createParticipantId = (phone1, phone2) => {
  return [phone1, phone2].sort().join("_");
};

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
});

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
          const { receiverPhone, content, fileUrl, fileType } = data;

          if (!receiverPhone || (!content && !fileUrl)) {
            console.log("Missing receiverPhone or content/fileUrl");
            socket.emit("error", {
              message: "Thiếu thông tin người nhận hoặc nội dung tin nhắn",
            });
            return;
          }

          if (content && content.length > 200) {
            console.log("Message too long");
            socket.emit("error", { message: "Tin nhắn quá dài" });
            return;
          }

          const messageId = uuidv4();
          const timestamp = Date.now();

          const conversationId = createParticipantId(userPhone, receiverPhone);
          console.log("Created conversationId:", conversationId);

          // Prepare message content based on type
          let messageContent = content;
          let messageType = "text";
          
          if (fileUrl) {
            messageContent = fileUrl;
            messageType = "file";
          }

          const messageParams = {
            TableName: process.env.MESSAGE_TABLE,
            Item: {
              messageId,
              conversationId,
              senderPhone: userPhone,
              receiverPhone,
              content: messageContent,
              timestamp,
              status: "sent",
              type: messageType,
              fileType: fileType || null
            },
          };

          console.log("Saving message:", JSON.stringify(messageParams, null, 2));
          await dynamoDB.put(messageParams).promise();
          console.log("Message saved successfully");

          console.log("Updating conversation...");
          await upsertConversation(userPhone, receiverPhone, {
            content: fileUrl ? `[File] ${fileType || 'file'}` : content,
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
              content: messageContent,
              timestamp,
              status: "delivered",
              type: messageType,
              fileType: fileType || null
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
          socket.emit("error", { 
            message: "Lỗi khi gửi tin nhắn",
            code: error.code || "UNKNOWN_ERROR"
          });
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

// Route to handle file uploads
router.post("/upload", authMiddleware, upload.array("files"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Không có file nào được tải lên",
                code: "NO_FILES"
            });
        }

        const results = await uploadToS3(req.files);
        const urls = results.map(result => result.Location);
        
        res.json({
            status: "success",
            data: {
                urls,
                files: req.files.map(file => ({
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size
                }))
            }
        });
    } catch (error) {
        console.error("Upload error:", error);
        
        // Nếu là lỗi validation
        if (error.isValid === false) {
            return res.status(400).json({
                status: "error",
                message: error.message,
                code: error.code
            });
        }
        
        // Nếu là lỗi server khác
        res.status(500).json({
            status: "error",
            message: "Đã xảy ra lỗi server",
            code: "SERVER_ERROR"
        });
    }
});

// Đăng ký routes
router.get("/conversations", authMiddleware, getConversations);
router.get("/history/:phone", authMiddleware, getChatHistory);

// Export
module.exports = {
  routes: router,
  socket: initializeSocket,
};
