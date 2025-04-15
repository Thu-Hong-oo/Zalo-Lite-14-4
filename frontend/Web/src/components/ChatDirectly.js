// Optimized ChatDirectly component
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { 
  ChevronLeft, Phone, Video, Search, Settings,
  Smile, Image, Link, UserPlus, Sticker, Type, Zap,
  MoreHorizontal, ThumbsUp, Send, Image as ImageIcon, Paperclip
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const attachMenuRef = useRef(null);
  const { phone } = useParams();
  const navigate = useNavigate();

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await api.get(`/users/${phone}`);
      if (response.data) setUserInfo(response.data);
    } catch (err) {
      console.error('User info error:', err);
      setError('Không thể tải thông tin người dùng');
    }
  };

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/chat/history/${phone}`);
      if (res.data.status === 'success') {
        const sorted = res.data.data.messages.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(sorted);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Chat history error:', err);
      setError('Không thể tải lịch sử chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    initializeSocket();
    loadChatHistory();
    return () => socket?.disconnect();
  }, [phone]);

  const initializeSocket = () => {
    const token = localStorage.getItem('accessToken');
    const newSocket = io('http://localhost:3000', { auth: { token } });

    newSocket.on('connect', () => console.log('Socket connected'));
    newSocket.on('typing', ({ senderPhone }) => {
      if (senderPhone === phone) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    });
    newSocket.on('stop_typing', ({ senderPhone }) => {
      if (senderPhone === phone) setIsTyping(false);
    });
    setSocket(newSocket);
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('message-sent', (data) => {
      setMessages(prev => prev.map(msg =>
        msg.messageId === data.messageId ? { ...msg, status: 'delivered', timestamp: Date.now() } : msg
      ));
    });
    socket.on('new-message', (msg) => {
      setMessages(prev => prev.some(m => m.messageId === msg.messageId) ? prev : [...prev, msg]);
    });
    return () => {
      socket.off('message-sent');
      socket.off('new-message');
    };
  }, [socket]);

  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    if (!el) return;
    const container = el.parentElement;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;
    const currentUserPhone = localStorage.getItem('phone');
    const tempId = Date.now().toString();
    const newMsg = {
      messageId: tempId,
      senderPhone: currentUserPhone,
      receiverPhone: phone,
      content: message.trim(),
      timestamp: Date.now(),
      status: 'sending'
    };
    setMessage('');
    setMessages(prev => [...prev, newMsg]);
    scrollToBottom();
    try {
      socket.emit('send-message', {
        messageId: tempId,
        receiverPhone: phone,
        content: newMsg.content
      });
    } catch (err) {
      setMessages(prev => prev.filter(msg => msg.messageId !== tempId));
    }
  };

  const handleTyping = () => {
    if (!socket || typingTimeoutRef.current) return;
    socket.emit('typing', { receiverPhone: phone });
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { receiverPhone: phone });
      typingTimeoutRef.current = null;
    }, 1000);
  };

  const onEmojiClick = (emojiObject) => {
    const cursor = document.querySelector('.message-input').selectionStart;
    const text = message.slice(0, cursor) + emojiObject.emoji + message.slice(cursor);
    setMessage(text);
    setShowEmojiPicker(false);
  };

  const handleAttachClick = () => {
    setShowAttachMenu(!showAttachMenu);
  };

  const renderedMessages = useMemo(() => messages.map((msg, idx) => {
    const isOther = msg.senderPhone !== localStorage.getItem('phone');
    return (
      <div key={msg.messageId || idx} className={`message ${isOther ? 'received' : 'sent'}`}>
        <div className="message-content">
          <p>{msg.content}</p>
          <div className="message-info">
            <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            {!isOther && msg.status === 'sending' && <span className="loading-dot"><span>.</span><span>.</span><span>.</span></span>}
            {!isOther && msg.status === 'delivered' && <span className="message-status">Đã nhận</span>}
          </div>
        </div>
      </div>
    );
  }), [messages]);

  if (loading) return <div className="loading">Đang tải...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="chat-directly">
      <div className="chat-header">
        <div className="header-left">
          <button onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
          <div className="user-info">
            {userInfo?.avatar ? <img src={userInfo.avatar} alt="avatar" className="avatar" /> : <div className="avatar-placeholder">{userInfo?.name?.slice(0, 2) || phone.slice(0, 2)}</div>}
            <div>
              <h3>{userInfo?.name || phone}</h3>
              {isTyping && <p>Đang soạn tin nhắn...</p>}
            </div>
          </div>
        </div>
        <div className="header-actions">
          {[Search, Phone, Video, UserPlus, Settings].map((Icon, i) => <button key={i}><Icon size={20} /></button>)}
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-list">{renderedMessages}<div ref={messagesEndRef} /></div>
      </div>

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
            onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
            onBlur={() => socket?.emit('stop_typing', { receiverPhone: phone })}
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