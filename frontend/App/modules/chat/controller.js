import api from '../../config/api';

export const getChats = async () => {
  try {
    const response = await api.get('/chats');
    return {
      success: true,
      data: response.data.chats
    };
  } catch (error) {
    console.error('Get chats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 