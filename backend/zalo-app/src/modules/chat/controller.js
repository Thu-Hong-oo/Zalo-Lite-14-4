const { v4: uuidv4 } = require('uuid');
const { dynamoDB } = require('../../config/aws');
const WebSocket = require('ws');

// Lưu trữ các kết nối WebSocket
const connections = new Map();

// Thiết lập WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'establish') {
      // Lưu kết nối WebSocket với userId
      connections.set(data.userId, ws);
      ws.userId = data.userId;
      
      // Gửi thông báo kết nối thành công
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'established',
        userId: data.userId
      }));
    }
  });

  ws.on('close', () => {
    if (ws.userId) {
      connections.delete(ws.userId);
    }
  });
});

// Hàm gửi tin nhắn qua WebSocket
const sendWebSocketMessage = (userId, message) => {
  const connection = connections.get(userId);
  if (connection) {
    connection.send(JSON.stringify(message));
  }
};

// Kiểm tra trạng thái kết nối
exports.getConnectionStatus = async (req, res) => {
  try {
    const { userId } = req.query;
    const isConnected = connections.has(userId);
    
    res.json({
      success: true,
      status: isConnected ? 'connected' : 'disconnected',
      userId
    });
  } catch (err) {
    console.error('Lỗi kiểm tra kết nối:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: err.message });
  }
};

// Thiết lập kết nối chat
exports.establishConnection = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Thiếu userId' });
    }

    // Kiểm tra xem đã có kết nối chưa
    const existingConnection = connections.get(userId);
    if (existingConnection) {
      return res.json({
        success: true,
        message: 'Đã có kết nối',
        status: 'connected',
        userId
      });
    }

    res.json({
      success: true,
      message: 'Sẵn sàng kết nối WebSocket',
      wsUrl: 'ws://localhost:8080',
      userId
    });
  } catch (err) {
    console.error('Lỗi thiết lập kết nối:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: err.message });
  }
};

module.exports.sendWebSocketMessage = sendWebSocketMessage; 