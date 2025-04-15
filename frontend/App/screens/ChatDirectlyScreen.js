import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import {
  getChatHistory,
  sendMessage,
  recallMessage,
  forwardMessage,
  deleteMessage,
} from "../modules/chat/controller";
import { getAccessToken } from "../services/storage";
import ForwardMessageModal from "./ForwardMessageModal";

// Hàm tạo conversationId
const createParticipantId = (phone1, phone2) => {
  return [phone1, phone2].sort().join("_");
};

const ChatDirectlyScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const flatListRef = useRef(null);
  const { title, otherParticipantPhone, avatar } = route.params;

  useEffect(() => {
    initializeSocket();
    loadChatHistory();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  //khởi tạo socket

  const initializeSocket = async () => {
    try {
      const token = await getAccessToken();
      const newSocket = io("http://192.168.2.118:3000", {
        auth: {
          token,
        },
        transports: ["websocket", "polling"],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });

      newSocket.on("connect", () => {
        console.log("Connected to socket server");
        // Đăng ký nhận tin nhắn cho cuộc trò chuyện hiện tại
        newSocket.emit("join-chat", { receiverPhone: otherParticipantPhone });
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });

      newSocket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        // Rời khỏi cuộc trò chuyện khi disconnect
        newSocket.emit("leave-chat", { receiverPhone: otherParticipantPhone });
      });

      newSocket.on("error", (error) => {
        console.error("Socket error:", error);
      });

      newSocket.on("new-message", (message) => {
        console.log("Received new message:", message);
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      });

      newSocket.on("message-recalled", ({ messageId, conversationId }) => {
        console.log("Message recalled:", messageId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? {
                  ...msg,
                  content: "Tin nhắn đã bị thu hồi",
                  status: "recalled",
                }
              : msg
          )
        );
      });

      newSocket.on("typing", ({ senderPhone }) => {
        if (senderPhone === otherParticipantPhone) {
          setIsTyping(true);
        }
      });

      newSocket.on("stop-typing", ({ senderPhone }) => {
        if (senderPhone === otherParticipantPhone) {
          setIsTyping(false);
        }
      });

      setSocket(newSocket);
    } catch (error) {
      console.error("Socket initialization error:", error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await getChatHistory(otherParticipantPhone);
      if (response.status === "success" && response.data.messages) {
        setMessages(response.data.messages);
        scrollToBottom();
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !socket) return;

    try {
      // Tạo messageId tạm thời
      const tempId = `temp-${Date.now()}`;

      // Thêm tin nhắn vào danh sách ngay lập tức
      const newMessage = {
        messageId: tempId,
        senderPhone: "me",
        content: message,
        timestamp: Date.now(),
        status: "sending",
        isTempId: true,
      };

      setMessages((prev) => [...prev, newMessage]);
      setMessage("");
      scrollToBottom();

      // Gửi tin nhắn qua socket
      socket.emit("send-message", {
        tempId,
        receiverPhone: otherParticipantPhone,
        content: message,
      });

      // Lắng nghe phản hồi từ server
      socket.once("message-sent", (response) => {
        if (response && response.messageId) {
          // Cập nhật messageId thật từ server
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === tempId
                ? {
                    ...msg,
                    messageId: response.messageId,
                    isTempId: false,
                    status: "sent",
                  }
                : msg
            )
          );
        }
      });

      socket.once("error", (error) => {
        console.error("Error sending message:", error);
        // Cập nhật trạng thái lỗi
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === tempId ? { ...msg, status: "error" } : msg
          )
        );
      });

      socket.emit("stop-typing", { receiverPhone: otherParticipantPhone });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit("typing", { receiverPhone: otherParticipantPhone });
    }
  };

  const handleStopTyping = () => {
    if (socket) {
      socket.emit("stop-typing", { receiverPhone: otherParticipantPhone });
    }
  };

  const handleRecallMessage = async (messageId) => {
    try {
      // Kiểm tra xem tin nhắn có phải là tin nhắn tạm thời không
      const targetMessage = messages.find((msg) => msg.messageId === messageId);
      if (targetMessage?.isTempId || targetMessage?.status === "sending") {
        Alert.alert("Lỗi", "Không thể thu hồi tin nhắn đang gửi");
        return;
      }

      const response = await recallMessage(messageId, otherParticipantPhone);
      if (response.status === "success") {
        // Cập nhật UI ngay lập tức
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? {
                  ...msg,
                  content: "Tin nhắn đã bị thu hồi",
                  status: "recalled",
                }
              : msg
          )
        );

        // Gửi sự kiện qua socket với đầy đủ thông tin
        socket?.emit("message-recalled", {
          messageId,
          receiverPhone: otherParticipantPhone,
          conversationId: createParticipantId(otherParticipantPhone, "me"),
        });
      } else {
        Alert.alert("Lỗi", "Không thể thu hồi tin nhắn");
      }
    } catch (error) {
      console.error("Error recalling message:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi thu hồi tin nhắn");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      // Kiểm tra xem tin nhắn có phải là tin nhắn tạm thời không
      const targetMessage = messages.find((msg) => msg.messageId === messageId);
      if (targetMessage?.isTempId || targetMessage?.status === "sending") {
        Alert.alert("Lỗi", "Không thể xóa tin nhắn đang gửi");
        return;
      }

      const response = await deleteMessage(messageId);
      if (response.status === "success") {
        // Cập nhật UI ngay lập tức
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? {
                  ...msg,
                  content: "Tin nhắn đã bị xóa",
                  status: "deleted",
                }
              : msg
          )
        );

        // Gửi sự kiện qua socket với đầy đủ thông tin
        socket?.emit("message-deleted", {
          messageId,
          conversationId: createParticipantId(otherParticipantPhone, "me"),
        });
      } else {
        Alert.alert("Lỗi", "Không thể xóa tin nhắn");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi xóa tin nhắn");
    }
  };

  const showMessageOptions = (message) => {
    setSelectedMessage(message);
    const options = [
      {
        text: "Thu hồi",
        onPress: () => handleRecallMessage(message.messageId),
      },
      {
        text: "Chuyển tiếp",
        onPress: () => {
          setForwardModalVisible(true);
        },
      },
      {
        text: "Xóa",
        onPress: () => handleDeleteMessage(message.messageId),
        style: "destructive",
      },
    ];
    Alert.alert("Tùy chọn", "", options);
  };

  const handleForwardMessage = async (receiverPhones) => {
    try {
      if (!selectedMessage) return;

      const promises = receiverPhones.map((receiverPhone) =>
        forwardMessage(
          selectedMessage.messageId,
          receiverPhone,
          selectedMessage.content
        )
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every((res) => res.status === "success");

      if (allSuccessful) {
        setForwardModalVisible(false);
        Alert.alert("Thành công", "Tin nhắn đã được chuyển tiếp");
      } else {
        throw new Error("Có lỗi xảy ra khi chuyển tiếp tin nhắn");
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      Alert.alert("Lỗi", error.message || "Không thể chuyển tiếp tin nhắn");
    } finally {
      setSelectedMessage(null);
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage =
      item.senderPhone != otherParticipantPhone || item.senderPhone == "me";

    // Skip rendering deleted messages if they are the user's own messages
    if (isMyMessage && item.status === "deleted") {
      return null;
    }

    return (
      <TouchableOpacity
        onLongPress={() => showMessageOptions(item)}
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText,
            item.status === "recalled" && styles.recalledMessage,
            item.status === "deleted" && styles.recalledMessage, // Apply same style for deleted messages
          ]}
        >
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
          {isMyMessage && (
            <Text style={styles.messageStatus}>
              {item.status === "sending"
                ? "Đang gửi..."
                : item.status === "sent"
                ? "✓"
                : item.status === "error"
                ? "✕"
                : item.status === "recalled"
                ? "Đã thu hồi"
                : item.status === "deleted"
                ? "Đã xóa"
                : ""}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.userInfo}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{title.slice(0, 2)}</Text>
              </View>
            )}
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="call" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="videocam" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Chat Messages Area */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.messageId}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Đang soạn tin nhắn...</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="happy-outline" size={24} color="#666" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Tin nhắn"
          value={message}
          onChangeText={setMessage}
          onFocus={handleTyping}
          onBlur={handleStopTyping}
          multiline
        />

        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={!message.trim()}
        >
          <Ionicons
            name="send"
            size={24}
            color={message.trim() ? "#1877f2" : "#666"}
          />
        </TouchableOpacity>
      </View>

      <ForwardMessageModal
        visible={forwardModalVisible}
        onClose={() => setForwardModalVisible(false)}
        onForward={handleForwardMessage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F2F5",
  },
  header: {
    backgroundColor: "#1877f2",
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5,
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    color: "#1877f2",
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginLeft: 5,
  },
  chatContainer: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    maxWidth: "80%",
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#1877f2",
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
  },
  messageText: {
    color: "#000",
    fontSize: 16,
  },
  messageTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    alignSelf: "flex-end",
  },
  typingIndicator: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginVertical: 5,
    alignSelf: "flex-start",
  },
  typingText: {
    color: "#666",
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  attachButton: {
    padding: 5,
    marginRight: 5,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#F0F2F5",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
    marginHorizontal: 5,
  },
  sendButton: {
    padding: 5,
    marginLeft: 5,
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 5,
  },
  messageStatus: {
    marginLeft: 5,
    fontSize: 12,
    color: "#666",
  },
  myMessageText: {
    color: "white",
  },
  otherMessageText: {
    color: "black",
  },
  recalledMessage: {
    color: "#999",
    fontStyle: "italic",
  },
});

export default ChatDirectlyScreen;
