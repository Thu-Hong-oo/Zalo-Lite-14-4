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
  Modal,
  Dimensions,
  Linking,
  ScrollView,
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
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Hàm tạo conversationId
const createParticipantId = (phone1, phone2) => {
  return [phone1, phone2].sort().join("_");
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

const renderMessage = ({ item }) => {
  const isMyMessage = item.senderPhone !== otherParticipantPhone || item.senderPhone === "me";

  const handleFilePress = async () => {
    if (item.fileType?.startsWith("image/")) {
      setPreviewImage(item.content);
      setShowImagePreview(true);
    } else if (item.fileType?.startsWith("video/")) {
      setPreviewVideo(item.content);
      setShowVideoPreview(true);
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
      {item.type === "text" ? (
        <Text
          style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText,
            item.status === "recalled" && styles.recalledMessage,
            item.status === "deleted" && styles.recalledMessage,
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
        style={styles.sendIconButton}
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

    <ForwardMessageModal
      visible={forwardModalVisible}
      onClose={() => setForwardModalVisible(false)}
      onForward={handleForwardMessage}
    />

    <Modal visible={showFilePreview} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Đã chọn {selectedFiles.length} file</Text>
          <ScrollView style={styles.fileList}>
            {selectedFiles.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <Ionicons 
                  name={getFileIcon(file.type)} 
                  size={24} 
                  color="#1877f2" 
                />
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatFileSize(file.size)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeFileButton}
                  onPress={() => {
                    const newFiles = [...selectedFiles];
                    newFiles.splice(index, 1);
                    setSelectedFiles(newFiles);
                    if (newFiles.length === 0) {
                      setShowFilePreview(false);
                    }
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          {isUploading ? (
            <View style={styles.uploadStatus}>
              <Text>Đang upload... {uploadProgress}%</Text>
            </View>
          ) : (
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowFilePreview(false);
                  setSelectedFiles([]);
                }}
              >
                <Text style={styles.buttonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.sendButton]}
                onPress={() => handleUpload(selectedFiles)}
                disabled={selectedFiles.length === 0}
              >
                <Text style={styles.buttonText}>Gửi</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>

    <Modal 
      visible={showImagePreview} 
      transparent={true} 
      animationType="fade"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowImagePreview(false)}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.downloadButton}
            onPress={() => downloadFile(previewImage)}
          >
            <Ionicons name="download" size={30} color="white" />
          </TouchableOpacity>
        </View>
        <Image 
          source={{ uri: previewImage }} 
          style={styles.fullscreenImage} 
          resizeMode="contain" 
        />
      </View>
    </Modal>

    <Modal 
      visible={showVideoPreview} 
      transparent={true} 
      animationType="fade"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowVideoPreview(false)}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.downloadButton}
            onPress={() => downloadFile(previewVideo)}
          >
            <Ionicons name="download" size={30} color="white" />
          </TouchableOpacity>
        </View>
        <Video
          source={{ uri: previewVideo }}
          style={styles.fullscreenVideo}
          resizeMode="contain"
          useNativeControls
          shouldPlay
        />
      </View>
    </Modal>
  </SafeAreaView>
); 