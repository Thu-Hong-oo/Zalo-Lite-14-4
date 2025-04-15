// Optimized ChatDirectly component
import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import {
  ChevronLeft,
  Phone,
  Video,
  Search,
  Settings,
  Smile,
  Image,
  Link,
  UserPlus,
  Sticker,
  Type,
  Zap,
  MoreHorizontal,
  ThumbsUp,
  Send,
  Image as ImageIcon,
  Paperclip,
  ArrowRight,
} from "lucide-react";
import api from "../config/api";
import "./css/ChatDirectly.css";
import MessageContextMenu from "./MessageContextMenu";
import ForwardMessageModal from "./ForwardMessageModal";
import ConfirmModal from "../../../Web/src/components/ConfirmModal";

const ChatDirectly = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const attachMenuRef = useRef(null);
  const { phone } = useParams();
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    position: { x: 0, y: 0 },
    messageId: null,
    isOwnMessage: false,
  });
  const [forwardModal, setForwardModal] = useState({
    isOpen: false,
    messageContent: "",
    messageId: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "default",
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Xử lý đóng context menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".message-context-menu")) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await api.get(`/users/${phone}`);
      if (response.data) setUserInfo(response.data);
    } catch (err) {
      console.error("User info error:", err);
      setError("Không thể tải thông tin người dùng");
    }
  };

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/chat/history/${phone}`);
      if (res.data.status === "success") {
        const sorted = res.data.data.messages.sort(
          (a, b) => a.timestamp - b.timestamp
        );
        setMessages(sorted);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Chat history error:", err);
      setError("Không thể tải lịch sử chat");
    } finally {
      setLoading(false);
    }
  };

  const handleRecallMessage = async () => {
    try {
      const targetMessage = messages.find(
        (msg) => msg.messageId === contextMenu.messageId
      );

      if (!targetMessage) {
        alert("Không tìm thấy tin nhắn");
        return;
      }

      // Chỉ kiểm tra tin nhắn đang gửi, cho phép thu hồi tin nhắn đã gửi
      if (targetMessage.status === "sending") {
        alert("Không thể thu hồi tin nhắn đang gửi");
        return;
      }

      const response = await api.put("/chat/messages/recall", {
        messageId: targetMessage.messageId,
        receiverPhone: phone,
      });

      if (response.data.status === "success") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === targetMessage.messageId
              ? {
                  ...msg,
                  content: "Tin nhắn đã bị thu hồi",
                  status: "recalled",
                }
              : msg
          )
        );
        setContextMenu((prev) => ({ ...prev, visible: false }));

        // Emit socket event để thông báo cho người nhận
        socket?.emit("message-recalled", {
          messageId: targetMessage.messageId,
          receiverPhone: phone,
        });
      } else {
        throw new Error(response.data.message || "Không thể thu hồi tin nhắn");
      }
    } catch (error) {
      console.error("Error recalling message:", error);
      alert(
        error.response?.data?.message ||
          "Không thể thu hồi tin nhắn. Vui lòng thử lại sau."
      );
    }
  };

  const handleDeleteMessage = async () => {
    const targetMessage = messages.find(
      (msg) => msg.messageId === contextMenu.messageId
    );

    if (!targetMessage) {
      alert("Không tìm thấy tin nhắn");
      return;
    }

    if (targetMessage.isTempId || targetMessage.status === "sending") {
      alert("Không thể xóa tin nhắn đang gửi");
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: "danger",
      title: "Xóa tin nhắn",
      message: "Bạn có chắc chắn muốn xóa tin nhắn này?",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const response = await api.delete("/chat/messages/delete", {
            data: {
              messageId: targetMessage.messageId,
            },
          });

          if (response.data.status === "success") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === targetMessage.messageId
                  ? { ...msg, status: "deleted" }
                  : msg
              )
            );
            setContextMenu((prev) => ({ ...prev, visible: false }));

            // Emit socket event để thông báo cho người nhận
            socket?.emit("message-deleted", {
              messageId: targetMessage.messageId,
              receiverPhone: phone,
            });
          } else {
            throw new Error(response.data.message || "Không thể xóa tin nhắn");
          }
        } catch (error) {
          console.error("Error deleting message:", error);
          alert(
            error.response?.data?.message ||
              error.message ||
              "Không thể xóa tin nhắn. Vui lòng thử lại sau."
          );
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const initializeSocket = () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      console.error("No access token found");
      return;
    }

    const newSocket = io("http://192.168.2.118:3000", {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
      // Đăng ký nhận tin nhắn cho cuộc trò chuyện hiện tại
      newSocket.emit("join-chat", { receiverPhone: phone });
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    newSocket.on("typing", ({ senderPhone }) => {
      if (senderPhone === phone) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    });

    newSocket.on("stop_typing", ({ senderPhone }) => {
      if (senderPhone === phone) setIsTyping(false);
    });

    newSocket.on("message-recalled", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId
            ? { ...msg, content: "Tin nhắn đã bị thu hồi", status: "recalled" }
            : msg
        )
      );
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      if (newSocket) {
        newSocket.emit("leave-chat", { receiverPhone: phone });
        newSocket.disconnect();
      }
    };
  };

  useEffect(() => {
    const cleanup = initializeSocket();
    fetchUserInfo();
    loadChatHistory();
    return () => {
      cleanup?.();
    };
  }, [phone]);

  useEffect(() => {
    if (!socket) return;

    const handleMessageSent = (data) => {
      if (!data || !data.messageId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === data.tempId || msg.messageId === data.messageId
            ? {
                ...msg,
                messageId: data.messageId,
                isTempId: false,
                status: "sent",
                timestamp: data.timestamp || Date.now(),
              }
            : msg
        )
      );
    };

    const handleNewMessage = (msg) => {
      if (!msg || !msg.messageId) return;

      setMessages((prev) => {
        // Kiểm tra tin nhắn đã tồn tại
        const exists = prev.some(
          (m) =>
            m.messageId === msg.messageId ||
            (m.content === msg.content &&
              m.senderPhone === msg.senderPhone &&
              Math.abs(m.timestamp - msg.timestamp) < 1000)
        );

        if (exists) return prev;
        return [...prev, { ...msg, status: "received" }];
      });
      scrollToBottom();
    };

    const handleMessageRecalled = ({ messageId }) => {
      if (!messageId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId || msg.tempId === messageId
            ? { ...msg, content: "Tin nhắn đã bị thu hồi", status: "recalled" }
            : msg
        )
      );
    };

    socket.on("message-sent", handleMessageSent);
    socket.on("new-message", handleNewMessage);
    socket.on("message-recalled", handleMessageRecalled);
    socket.on("message-deleted", ({ messageId }) => {
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId ? { ...msg, status: "deleted" } : msg
        )
      );
    });

    return () => {
      socket.off("message-sent", handleMessageSent);
      socket.off("new-message", handleNewMessage);
      socket.off("message-recalled", handleMessageRecalled);
      socket.off("message-deleted");
    };
  }, [socket]);

  // Thêm effect để tự động load lại tin nhắn khi có thay đổi
  useEffect(() => {
    if (socket?.connected) {
      loadChatHistory();
    }
  }, [socket]);

  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    if (!el) return;
    const container = el.parentElement;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      150;
    if (isNearBottom) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    const currentUserPhone = localStorage.getItem("phone");
    const tempId = `temp-${Date.now()}`;
    const newMsg = {
      messageId: tempId,
      senderPhone: currentUserPhone,
      receiverPhone: phone,
      content: message.trim(),
      timestamp: Date.now(),
      status: "sending",
      isTempId: true,
    };

    setMessage("");
    setMessages((prev) => [...prev, newMsg]);
    scrollToBottom();

    try {
      // Gửi tin nhắn qua socket và đợi phản hồi
      socket.emit(
        "send-message",
        {
          messageId: tempId,
          receiverPhone: phone,
          content: newMsg.content,
        },
        (response) => {
          if (response && response.status === "success") {
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
          } else {
            throw new Error("Không thể gửi tin nhắn");
          }
        }
      );
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages((prev) => prev.filter((msg) => msg.messageId !== tempId));
      alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
    }
  };

  const handleTyping = () => {
    if (!socket || typingTimeoutRef.current) return;
    socket.emit("typing", { receiverPhone: phone });
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { receiverPhone: phone });
      typingTimeoutRef.current = null;
    }, 1000);
  };

  const onEmojiClick = (emojiObject) => {
    const cursor = document.querySelector(".message-input").selectionStart;
    const text =
      message.slice(0, cursor) + emojiObject.emoji + message.slice(cursor);
    setMessage(text);
    setShowEmojiPicker(false);
  };

  const handleAttachClick = () => {
    setShowAttachMenu(!showAttachMenu);
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    const currentUserPhone = localStorage.getItem("phone");
    const isOwnMessage = msg.senderPhone === currentUserPhone;

    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      messageId: msg.messageId,
      isOwnMessage,
      message: msg,
    });
  };

  const handleForwardClick = (msg) => {
    setForwardModal({
      isOpen: true,
      messageContent: msg.content,
      messageId: msg.messageId,
      message: msg,
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleForwardMessage = async (selectedUsers) => {
    try {
      const promises = selectedUsers.map((receiverPhone) =>
        api.post("/chat/messages/forward", {
          messageId: forwardModal.messageId,
          receiverPhone,
          content: forwardModal.messageContent,
        })
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every(
        (res) => res.data.status === "success"
      );

      if (allSuccessful) {
        setForwardModal({ isOpen: false, messageContent: "", messageId: null });
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      alert("Không thể chuyển tiếp tin nhắn. Vui lòng thử lại sau.");
    }
  };

  const renderedMessages = useMemo(
    () =>
      messages
        .filter((msg) => msg.status !== "deleted")
        .map((msg, idx) => {
          const isOther = msg.senderPhone !== localStorage.getItem("phone");
          const isRecalled = msg.status === "recalled";

          return (
            <div
              key={msg.messageId || idx}
              className={`message ${isOther ? "received" : "sent"}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              <div
                className={`message-content ${isRecalled ? "recalled" : ""}`}
              >
                <p>{msg.content}</p>
                <div className="message-info">
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {!isOther && msg.status === "sending" && (
                    <span className="loading-dot">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  )}
                  {!isOther && msg.status === "delivered" && (
                    <span className="message-status">Đã nhận</span>
                  )}
                  {isRecalled && (
                    <span className="message-status">Đã thu hồi</span>
                  )}
                </div>
              </div>

              {!isRecalled && (
                <div className="message-actions">
                  <button
                    className="action-button forward"
                    onClick={() => handleForwardClick(msg)}
                    title="Chuyển tiếp"
                  >
                    <ArrowRight size={16} />
                  </button>
                  {!isOther && (
                    <button
                      className="action-button more"
                      onClick={(e) => handleContextMenu(e, msg)}
                      title="Thêm"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        }),
    [messages]
  );

  if (loading) return <div className="loading">Đang tải...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="chat-directly">
      <div className="chat-header">
        <div className="header-left">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft size={24} />
          </button>
          <div className="user-info">
            {userInfo?.avatar ? (
              <img src={userInfo.avatar} alt="avatar" className="avatar" />
            ) : (
              <div className="avatar-placeholder">
                {userInfo?.name?.slice(0, 2) || phone.slice(0, 2)}
              </div>
            )}
            <div>
              <h3>{userInfo?.name || phone}</h3>
              {isTyping && <p>Đang soạn tin nhắn...</p>}
            </div>
          </div>
        </div>
        <div className="header-actions">
          {[Search, Phone, Video, UserPlus, Settings].map((Icon, i) => (
            <button key={i}>
              <Icon size={20} />
            </button>
          ))}
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-list">
          {renderedMessages}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageContextMenu
        isVisible={contextMenu.visible}
        position={contextMenu.position}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        onRecall={handleRecallMessage}
        onDelete={handleDeleteMessage}
        onForward={() => handleForwardClick(contextMenu.message)}
        isOwnMessage={contextMenu.isOwnMessage}
        isDeleting={isDeleting}
      />

      <ForwardMessageModal
        isOpen={forwardModal.isOpen}
        onClose={() =>
          setForwardModal({
            isOpen: false,
            messageContent: "",
            messageId: null,
          })
        }
        onForward={handleForwardMessage}
        messageContent={forwardModal.messageContent}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      <div className="chat-input-area">
        <div className="input-toolbar">
          <div className="toolbar-left">
            <div className="emoji-wrapper" ref={emojiPickerRef}>
              <button
                type="button"
                className="toolbar-button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile size={20} />
              </button>
              {showEmojiPicker && (
                <div className="emoji-picker-container">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width={300}
                    height={400}
                  />
                </div>
              )}
            </div>
            <button type="button" className="toolbar-button">
              <ImageIcon size={20} />
            </button>
            <div className="attach-wrapper" ref={attachMenuRef}>
              <button
                type="button"
                className="toolbar-button"
                onClick={handleAttachClick}
              >
                <Paperclip size={20} />
              </button>
            </div>
            <button type="button" className="toolbar-button">
              <Type size={20} />
            </button>
            <button type="button" className="toolbar-button">
              <Sticker size={20} />
            </button>
            <button type="button" className="toolbar-button">
              <Zap size={20} />
            </button>
            <button type="button" className="toolbar-button">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSendMessage} className="input-form">
          <input
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onBlur={() => socket?.emit("stop_typing", { receiverPhone: phone })}
            placeholder={`Nhập @, tin nhắn tới ${userInfo?.name || phone}`}
            className="message-input"
          />
          <div className="input-buttons">
            <button
              type="submit"
              className="send-button"
              disabled={!message.trim()}
            >
              <Send size={20} color={message.trim() ? "#1877f2" : "#666"} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatDirectly;
