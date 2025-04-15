import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getChatHistory, sendMessage } from '../services/chat';
import { 
  ChevronLeft, Phone, Video, Search, Settings,
  Smile, Image, Link, UserPlus, Sticker, Type, Zap,
  MoreHorizontal, ThumbsUp, Send
} from 'lucide-react';
import api from '../config/api';
import './css/ChatDirectly.css';

const ChatDirectly = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const { phone } = useParams();
  const navigate = useNavigate();

  // Fetch user info
  const fetchUserInfo = async () => {
    try {
      const response = await api.get(`/users/${phone}`);
      if (response.data) {
        setUserInfo(response.data);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      setError('Không thể tải thông tin người dùng');
    }
  };

  // Load chat history
  const loadChatHistory = async () => {
    try {
      setLoading(true);
      const response = await getChatHistory(phone);
      console.log('Chat history response:', response);
      if (response.status === 'success' && response.data.messages) {
        setMessages(response.data.messages);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError('Không thể tải lịch sử chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    initializeSocket();
    loadChatHistory();
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [phone]);

  const initializeSocket = () => {
    try {
      const token = localStorage.getItem('accessToken');
      const newSocket = io('http://localhost:3000', {
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('Connected to socket server');
      });

      newSocket.on('new-message', (message) => {
        console.log('Received new message:', message);
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      });

      newSocket.on('typing', ({ senderPhone }) => {
        if (senderPhone === phone) {
          setIsTyping(true);
        }
      });

      newSocket.on('stop-typing', ({ senderPhone }) => {
        if (senderPhone === phone) {
          setIsTyping(false);
        }
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('Socket initialization error:', error);
      setError('Lỗi kết nối socket');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    try {
      const response = await sendMessage(phone, message);
      if (response.status === 'success') {
        setMessage('');
        socket.emit('stop-typing', { receiverPhone: phone });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', { receiverPhone: phone });
    }
  };

  const handleStopTyping = () => {
    if (socket) {
      socket.emit('stop-typing', { receiverPhone: phone });
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="chat-directly">
      {/* Header */}
      <div className="chat-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate(-1)}>
            <ChevronLeft size={24} />
          </button>
          <div className="user-info">
            <div className="avatar-container">
              <img
                src={userInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(phone)}&background=random`}
                alt={userInfo?.name || phone}
                className="avatar"
              />
            </div>
            <div className="user-details">
              <span className="username">{userInfo?.name || phone}</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="action-button">
            <UserPlus size={20} />
          </button>
          <button className="action-button">
            <Video size={20} />
          </button>
          <button className="action-button">
            <Phone size={20} />
          </button>
          <button className="action-button">
            <Search size={20} />
          </button>
          <button className="action-button">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        <div className="messages-list">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message-wrapper ${msg.senderPhone === phone ? 'other' : 'self'}`}
            >
              {msg.senderPhone === phone && (
                <div className="avatar-container small">
                  <img
                    src={userInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(phone)}&background=random`}
                    alt={userInfo?.name || phone}
                    className="avatar"
                  />
                </div>
              )}
              <div className="message-bubble">
                <div className="message-content">
                  <p>{msg.content}</p>
                </div>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="typing-indicator">
              Đang soạn tin nhắn...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="input-actions">
          <button className="input-action-button">
            <Smile size={20} />
          </button>
          <button className="input-action-button">
            <Image size={20} />
          </button>
          <button className="input-action-button">
            <Link size={20} />
          </button>
          <button className="input-action-button">
            <UserPlus size={20} />
          </button>
          <button className="input-action-button">
            <Sticker size={20} />
          </button>
          <button className="input-action-button">
            <Type size={20} />
          </button>
          <button className="input-action-button">
            <Zap size={20} />
          </button>
          <button className="input-action-button">
            <MoreHorizontal size={20} />
          </button>
        </div>
        <form onSubmit={handleSendMessage} className="input-form">
          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onBlur={handleStopTyping}
            placeholder={`Nhập @, tin nhắn tới ${userInfo?.name || phone}`}
            className="message-input"
          />
          <div className="input-buttons">
            <button type="button" className="emoji-button">
              <Smile size={20} />
            </button>
            <button type="button" className="thumbs-up-button">
              <ThumbsUp size={20} />
            </button>
            <button type="submit" className="send-button" disabled={!message.trim()}>
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatDirectly;