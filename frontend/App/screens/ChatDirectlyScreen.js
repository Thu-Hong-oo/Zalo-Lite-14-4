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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import { getChatHistory, sendMessage } from "../modules/chat/controller";
import { getAccessToken } from "../services/storage";

const ChatDirectlyScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
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
      const newSocket = io("http://localhost:3000", {
        auth: {
          token,
        },
      });

      newSocket.on("connect", () => {
        console.log("Connected to socket server");
      });

      newSocket.on("new-message", (message) => {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
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
      // Gửi tin nhắn qua socket
      socket.emit("send-message", {
        receiverPhone: otherParticipantPhone,
        content: message,
      });

      // Thêm tin nhắn vào danh sách ngay lập tức
      const newMessage = {
        messageId: Date.now().toString(), // Tạm thời sử dụng timestamp làm ID
        senderPhone: otherParticipantPhone, // Đảo ngược vì đây là tin nhắn của mình
        content: message,
        timestamp: Date.now(),
        status: "sending",
      };

      setMessages((prev) => [...prev, newMessage]);
      setMessage("");
      scrollToBottom();

      // Lắng nghe phản hồi từ server
      socket.once("message-sent", (response) => {
        // Cập nhật trạng thái tin nhắn
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === newMessage.messageId
              ? { ...msg, status: "sent" }
              : msg
          )
        );
      });

      socket.once("error", (error) => {
        console.error("Error sending message:", error);
        // Cập nhật trạng thái lỗi
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === newMessage.messageId
              ? { ...msg, status: "error" }
              : msg
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

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderPhone === otherParticipantPhone;
    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.otherMessage : styles.myMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isMyMessage ? styles.otherMessageText : styles.myMessageText,
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
                : ""}
            </Text>
          )}
        </View>
      </View>
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
    color: "#fff",
  },
  otherMessageText: {
    color: "#000",
  },
});

export default ChatDirectlyScreen;
