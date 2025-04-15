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
  Modal,
  Alert,
  Dimensions,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import { getChatHistory, sendMessage } from "../modules/chat/controller";
import { getAccessToken } from "../services/storage";
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ChatDirectlyScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const flatListRef = useRef(null);
  const { title, otherParticipantPhone, avatar } = route.params;

  useEffect(() => {
    initializeSocket();
    loadChatHistory();
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const initializeSocket = async () => {
    try {
      const token = await getAccessToken();
      const newSocket = io("http://192.168.1.198:3000", {
        auth: { token },
        transports: ["websocket", "polling"],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
      });

      newSocket.on("connect", () => console.log("Connected to socket server"));
      newSocket.on("connect_error", (error) => console.error("Socket connection error:", error));
      newSocket.on("new-message", (message) => {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      });
      newSocket.on("typing", ({ senderPhone }) => {
        if (senderPhone === otherParticipantPhone) setIsTyping(true);
      });
      newSocket.on("stop-typing", ({ senderPhone }) => {
        if (senderPhone === otherParticipantPhone) setIsTyping(false);
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
    if (flatListRef.current) flatListRef.current.scrollToEnd({ animated: true });
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !selectedFiles.length) return;

    try {
      if (message.trim()) {
        socket.emit("send-message", {
          receiverPhone: otherParticipantPhone,
          content: message.trim(),
        });

        const newMessage = {
          messageId: Date.now().toString(),
          senderPhone: "me",
          content: message.trim(),
          type: "text",
          timestamp: Date.now(),
          status: "sending",
        };

        setMessages((prev) => [...prev, newMessage]);
        setMessage("");
        scrollToBottom();
      }

      if (selectedFiles.length > 0) {
        await handleUpload(selectedFiles);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn");
    }
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append("files", {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
      });

      const token = await getAccessToken();
      console.log("Starting upload with token:", token);
      console.log("Files to upload:", files);

      const response = await fetch("http://192.168.1.198:3000/api/chat/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      console.log("Upload response status:", response.status);
      const result = await response.json();
      console.log("Upload result:", result);

      if (result.status === "error") {
        Alert.alert("Lỗi", result.message || "Không thể upload file");
        return;
      }

      setUploadProgress(100);

      result.data.urls.forEach((url, index) => {
        const file = files[index];
        const tempId = `temp-${Date.now()}-${index}`;
        
        // Thêm tin nhắn vào danh sách ngay lập tức
        const newMessage = {
          messageId: tempId,
          senderPhone: "me",
          content: url,
          type: "file",
          fileType: file.type,
          timestamp: Date.now(),
          status: "sending",
          isTempId: true,
        };

        setMessages((prev) => [...prev, newMessage]);

        // Gửi tin nhắn qua socket
        socket.emit("send-message", {
          tempId,
          receiverPhone: otherParticipantPhone,
          fileUrl: url,
          fileType: file.type,
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

        // Lắng nghe lỗi
        socket.once("error", (error) => {
          console.error("Error sending file message:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === tempId ? { ...msg, status: "error" } : msg
            )
          );
        });
      });

      setSelectedFiles([]);
      setShowFilePreview(false);
      scrollToBottom();
    } catch (error) {
      console.error("Upload error details:", error);
      Alert.alert("Lỗi", "Không thể upload file. Chi tiết: " + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (!result.canceled) {
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "image/jpeg",
          name: `image_${Date.now()}.jpg`,
        }));
        setSelectedFiles(files);
        setShowFilePreview(true);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chọn ảnh");
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });

      if (!result.canceled) {
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "video/mp4",
          name: `video_${Date.now()}.mp4`,
        }));
        setSelectedFiles(files);
        setShowFilePreview(true);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chọn video");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
      });

      if (result.type === "success") {
        const files = [result].map((asset) => ({
          uri: asset.uri,
          type: asset.mimeType,
          name: asset.name,
        }));
        setSelectedFiles(files);
        setShowFilePreview(true);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chọn file");
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderPhone !== otherParticipantPhone || item.senderPhone === "me";

    const handleFilePress = async () => {
      if (item.fileType?.startsWith("image/")) {
        setPreviewImage(item.content);
        setShowImagePreview(true);
      } else if (item.fileType?.startsWith("video/")) {
        // Handle video
      } else {
        try {
          const supported = await Linking.canOpenURL(item.content);
          if (supported) await Linking.openURL(item.content);
          else Alert.alert("Không thể mở file", "URL: " + item.content);
        } catch (error) {
          Alert.alert("Lỗi", "Không thể mở file");
        }
      }
    };

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessage : styles.otherMessage]}>
        {item.type === "text" ? (
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              item.status === "recalled" && styles.recalledMessage,
            ]}
          >
            {item.content}
          </Text>
        ) : item.type === "file" ? (
          <TouchableOpacity onPress={handleFilePress}>
            {item.fileType?.startsWith("image/") ? (
              <Image source={{ uri: item.content }} style={styles.imgPreview} resizeMode="contain" />
            ) : item.fileType?.startsWith("video/") ? (
              <Video source={{ uri: item.content }} style={styles.videoPreview} resizeMode="contain" useNativeControls />
            ) : (
              <View style={styles.fileContainer}>
                <Ionicons name="document" size={24} color="white" />
                <Text style={styles.fileName}>{item.content.split("/").pop()}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
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
                : ""}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const handleTyping = () => {
    socket.emit("typing", { senderPhone: otherParticipantPhone });
  };

  const handleStopTyping = () => {
    socket.emit("stop-typing", { senderPhone: otherParticipantPhone });
  };

  const handleEmojiPress = () => {
    // TODO: Thêm logic hiển thị bàn phím emoji
    Alert.alert("Thông báo", "Chức năng emoji sẽ được thêm sau");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.messageId}
          onContentSizeChange={scrollToBottom}
        />
        {isTyping && <Text style={styles.typingText}>Đang soạn tin nhắn...</Text>}
      </KeyboardAvoidingView>
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={handleEmojiPress}
        >
          <Ionicons name="happy-outline" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.attachButton}
          onPress={() => {
            Alert.alert(
              "Chọn loại file",
              "Bạn muốn gửi loại file nào?",
              [
                {
                  text: "Ảnh",
                  onPress: pickImage
                },
                {
                  text: "Video",
                  onPress: pickVideo
                },
                {
                  text: "Hủy",
                  style: "cancel"
                }
              ]
            );
          }}
        >
          <Ionicons name="image" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.attachButton}
          onPress={pickDocument}
        >
          <Ionicons name="attach" size={24} color="#666" />
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
            color="#666"
          />
        </TouchableOpacity>
      </View>
      <Modal visible={showFilePreview} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đã chọn {selectedFiles.length} file</Text>
            {isUploading ? (
              <View style={styles.uploadStatus}>
                <Text>Đang upload... {uploadProgress}%</Text>
              </View>
            ) : (
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowFilePreview(false)}
                >
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.sendButton]}
                  onPress={() => handleUpload(selectedFiles)}
                >
                  <Text style={styles.buttonText}>Gửi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={showImagePreview} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity onPress={() => setShowImagePreview(false)}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <Image source={{ uri: previewImage }} style={styles.fullscreenImage} resizeMode="contain" />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F2F5" },
  header: { backgroundColor: "#1877f2", padding: 10, flexDirection: "row", alignItems: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold", marginLeft: 10 },
  chatContainer: { flex: 1, padding: 10 },
  messageContainer: { maxWidth: "80%", padding: 10, borderRadius: 10, marginVertical: 5 },
  myMessage: { alignSelf: "flex-end", backgroundColor: "#1877f2" },
  otherMessage: { alignSelf: "flex-start", backgroundColor: "#fff" },
  messageText: { color: "#000", fontSize: 16 },
  myMessageText: { color: "white" },
  otherMessageText: { color: "black" },
  messageTime: { fontSize: 12, color: "#666", marginTop: 5 },
  typingText: { color: "#666", fontStyle: "italic" },
  inputContainer: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: "#FFFFFF" },
  input: { flex: 1, minHeight: 40, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 15 },
  imgPreview: { width: SCREEN_WIDTH * 0.8, height: SCREEN_WIDTH * 0.5, borderRadius: 10 },
  videoPreview: { width: SCREEN_WIDTH * 0.8, height: SCREEN_WIDTH * 0.5, borderRadius: 10 },
  fileContainer: { flexDirection: "row", alignItems: "center" },
  fileName: { color: "#fff", marginLeft: 5 },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "90%",
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20
  },
  uploadStatus: {
    marginTop: 20,
    alignItems: 'center'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    width: '100%'
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: '#ccc'
  },
  sendButton: {
    padding: 5,
    marginLeft: 5,
    backgroundColor: 'transparent'
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  previewImage: { width: "100%", height: 200, borderRadius: 5 },
  previewVideo: { width: "100%", height: 200, borderRadius: 5 },
  fullscreenImage: { width: "100%", height: "100%" },
  attachButton: {
    padding: 5,
    marginRight: 5,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5
  },
  myMessageTime: {
    color: 'white'
  },
  messageStatus: {
    color: '#666',
    fontSize: 12
  },
  recalledMessage: {
    textDecorationLine: 'line-through'
  },
});

export default ChatDirectlyScreen;