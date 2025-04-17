import SendBird from 'sendbird';
import { Message } from '../types';
import { Channel } from '../components/ChannelList';

const sb = new SendBird({ appId: 'D895A94C-429F-4EB3-A361-B91CF467BD94' });

// Получение сохраненного ID пользователя или создание нового
const getUserId = (): string => {
  // Проверяем, есть ли сохраненный ID в localStorage
  const savedUserId = localStorage.getItem('sendbird_user_id');
  
  if (savedUserId) {
    return savedUserId;
  }
  
  // Если нет, генерируем новый ID и сохраняем его
  const newUserId = `user_${Math.random().toString(36).substring(2, 8)}`;
  localStorage.setItem('sendbird_user_id', newUserId);
  
  return newUserId;
};

// Получение имени пользователя или создание нового
const getUserNickname = (): string => {
  // Проверяем, есть ли сохраненное имя в localStorage
  const savedNickname = localStorage.getItem('sendbird_user_nickname');
  
  if (savedNickname) {
    return savedNickname;
  }
  
  // Если нет, устанавливаем имя по умолчанию и сохраняем его
  const defaultNickname = 'Пользователь';
  localStorage.setItem('sendbird_user_nickname', defaultNickname);
  
  return defaultNickname;
};

// Пользовательский ID из хранилища или новый
const USER_ID = getUserId();
// Имя пользователя из хранилища или по умолчанию
const USER_NICKNAME = getUserNickname();

// Текущий канал для общения
let currentChannel: SendBird.GroupChannel | null = null;

// Инициализация подключения к SendBird
export const initSendbird = async (): Promise<void> => {
  try {
    // Подключение к SendBird
    const user = await sb.connect(USER_ID);
    console.log('SendBird connected:', user);
    
    // Обновление профиля пользователя
    await sb.updateCurrentUserInfo(USER_NICKNAME, '');
    
    // Получение или создание канала для общения
    currentChannel = await createOrGetChannel();
  } catch (error) {
    console.error('Ошибка при инициализации SendBird:', error);
    throw error;
  }
};

// Создание или получение канала для общения
const createOrGetChannel = async (): Promise<SendBird.GroupChannel> => {
  try {
    // Попытка получить существующий канал общего чата
    const channelListQuery = sb.GroupChannel.createMyGroupChannelListQuery();
    channelListQuery.includeEmpty = true;
    channelListQuery.limit = 100;
    
    const channels = await channelListQuery.next();
    const generalChannel = channels.find(channel => channel.name === 'Общий чат');
    
    if (generalChannel) {
      return generalChannel;
    }
    
    // Если канал не найден, создаем новый
    const params = new sb.GroupChannelParams();
    params.name = 'Общий чат';
    params.isPublic = true;
    params.operatorUserIds = [USER_ID];
    params.customType = 'general';
    
    const newChannel = await sb.GroupChannel.createChannel(params);
    return newChannel;
  } catch (error) {
    console.error('Ошибка при создании/получении канала:', error);
    throw error;
  }
};

// Получение истории сообщений
export const getMessages = async (): Promise<Message[]> => {
  try {
    if (!currentChannel) {
      await initSendbird();
    }
    
    if (!currentChannel) {
      throw new Error('Канал не инициализирован');
    }
    
    // Создание запроса на получение истории сообщений
    const messageListParams = new sb.MessageListParams();
    messageListParams.prevResultSize = 30; // Количество предыдущих сообщений
    messageListParams.isInclusive = true;
    
    // Получение сообщений из канала
    const messages = await currentChannel.getMessagesByTimestamp(Date.now(), messageListParams);
    
    // Преобразование сообщений SendBird в формат нашего приложения
    return messages.map(sbMessage => {
      if (sbMessage.messageType !== 'user') return null;
      
      const userMessage = sbMessage as SendBird.UserMessage;
      const senderName = userMessage.sender?.nickname || userMessage.sender?.userId || 'Неизвестный';
      const messageText = userMessage.message || '';
      
      return {
        id: userMessage.messageId,
        text: messageText,
        sender: senderName,
        timestamp: new Date(userMessage.createdAt)
      };
    }).filter(Boolean) as Message[];
  } catch (error) {
    console.error('Ошибка при получении сообщений:', error);
    throw error;
  }
};

// Отправка сообщения
export const sendMessage = async (text: string, sender: string): Promise<Message> => {
  try {
    if (!currentChannel) {
      await initSendbird();
    }
    
    if (!currentChannel) {
      throw new Error('Канал не инициализирован');
    }
    
    // Отправка сообщения в канал
    // SendBird v3 API требует колбэк функцию или объект параметров
    const userMessage = await new Promise<SendBird.UserMessage>((resolve, reject) => {
      if (currentChannel) {
        currentChannel.sendUserMessage(text, (message, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(message as SendBird.UserMessage);
          }
        });
      } else {
        reject(new Error('Канал не инициализирован'));
      }
    });
    
    const messageText = userMessage.message || '';
    
    // Преобразование сообщения SendBird в формат нашего приложения
    return {
      id: userMessage.messageId,
      text: messageText,
      sender,
      timestamp: new Date(userMessage.createdAt)
    };
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    throw error;
  }
};

// Регистрация всех обработчиков событий канала
export const setupChannelHandlers = (onMessageReceived: (message: Message) => void): (() => void) => {
  const channelHandler = new sb.ChannelHandler();
  
  // Обработчик для новых сообщений
  channelHandler.onMessageReceived = (channel, sbMessage) => {
    // Проверяем только, что сообщение пришло в текущий канал
    if (currentChannel && channel.url === currentChannel.url) {
      console.log('Получено новое сообщение:', sbMessage);
      
      // Обрабатываем все типы сообщений
      if (sbMessage.messageType === 'user') {
        const userMessage = sbMessage as SendBird.UserMessage;
        const senderName = userMessage.sender?.nickname || userMessage.sender?.userId || 'Неизвестный';
        const messageText = userMessage.message || '';
        
        const message: Message = {
          id: userMessage.messageId,
          text: messageText,
          sender: senderName,
          timestamp: new Date(userMessage.createdAt)
        };
        
        onMessageReceived(message);
      } else if (sbMessage.messageType === 'admin') {
        // Обработка админ-сообщений от сервера
        const adminMessage = sbMessage as SendBird.AdminMessage;
        
        const message: Message = {
          id: adminMessage.messageId,
          text: adminMessage.message || '',
          sender: 'Система',
          timestamp: new Date(adminMessage.createdAt)
        };
        
        onMessageReceived(message);
      }
    }
  };
  
  // Обработчик для событий канала
  channelHandler.onChannelChanged = (channel) => {
    console.log('Канал изменился:', channel);
    // Можно обновить информацию о канале
  };
  
  // Обработчик для удаленных сообщений
  channelHandler.onMessageDeleted = (channel, messageId) => {
    console.log('Сообщение удалено:', messageId);
    // Можно обработать удаление сообщения
  };
  
  // Обработчик для обновленных сообщений
  channelHandler.onMessageUpdated = (channel, message) => {
    console.log('Сообщение обновлено:', message);
    // Можно обработать обновление сообщения
  };
  
  // Регистрация обработчика
  const handlerId = `chat_${Date.now()}`;
  sb.addChannelHandler(handlerId, channelHandler);
  
  // Функция для удаления обработчика при размонтировании компонента
  return () => {
    sb.removeChannelHandler(handlerId);
  };
};

// Обратная совместимость для старого метода
export const setupMessageHandler = setupChannelHandlers;

// Метод для прослушивания обновлений канала
export const subscribeToChannelUpdates = async (): Promise<void> => {
  try {
    if (!currentChannel) {
      await initSendbird();
    }
    
    if (!currentChannel) {
      throw new Error('Канал не инициализирован');
    }
    
    // Пометка канала как прочитанного, чтобы убедиться, что сервер
    // знает о том, что клиент активно слушает канал
    await currentChannel.markAsRead();
    console.log('Канал отмечен как прочитанный');
    
    return;
  } catch (error) {
    console.error('Ошибка при подписке на обновления канала:', error);
    throw error;
  }
};

// Метод для синхронизации сообщений после возможной неактивности
export const syncMessages = async (): Promise<Message[]> => {
  try {
    if (!currentChannel) {
      await initSendbird();
    }
    
    if (!currentChannel) {
      throw new Error('Канал не инициализирован');
    }
    
    // Получаем последние сообщения из канала
    const messageListParams = new sb.MessageListParams();
    messageListParams.prevResultSize = 20; // Количество сообщений для синхронизации
    messageListParams.isInclusive = true;
    
    const messages = await currentChannel.getMessagesByTimestamp(Date.now(), messageListParams);
    
    // Преобразуем сообщения в нужный формат
    return messages.map(sbMessage => {
      if (sbMessage.messageType === 'user') {
        const userMessage = sbMessage as SendBird.UserMessage;
        const senderName = userMessage.sender?.nickname || userMessage.sender?.userId || 'Неизвестный';
        const messageText = userMessage.message || '';
        
        return {
          id: userMessage.messageId,
          text: messageText,
          sender: senderName,
          timestamp: new Date(userMessage.createdAt)
        };
      } else if (sbMessage.messageType === 'admin') {
        const adminMessage = sbMessage as SendBird.AdminMessage;
        
        return {
          id: adminMessage.messageId,
          text: adminMessage.message || '',
          sender: 'Система',
          timestamp: new Date(adminMessage.createdAt)
        };
      }
      
      // Для других типов сообщений возвращаем null
      return null;
    }).filter(Boolean) as Message[];
  } catch (error) {
    console.error('Ошибка при синхронизации сообщений:', error);
    throw error;
  }
};

// Запуск автоматической синхронизации сообщений
export const startAutoSync = (onNewMessages: (messages: Message[]) => void): (() => void) => {
  // Интервал синхронизации в мс (15 секунд вместо 1 минуты)
  const SYNC_INTERVAL = 15 * 1000;
  
  // Последнее время обновления
  let lastSyncTime = Date.now();
  
  // Функция для выполнения синхронизации
  const performSync = async () => {
    try {
      if (!currentChannel) {
        await initSendbird();
      }
      
      if (!currentChannel) {
        console.error('Не удалось выполнить автосинхронизацию: канал не инициализирован');
        return;
      }
      
      // Получаем новые сообщения
      const params = new sb.MessageListParams();
      params.prevResultSize = 10;
      params.isInclusive = true;
      params.customTypes = ['admin', 'user']; // Явно указываем типы интересующих сообщений
      
      const messages = await currentChannel.getMessagesByTimestamp(Date.now(), params);
      
      // Фильтруем только новые сообщения, созданные после последней синхронизации
      const newMessages = messages
        .filter(msg => msg.createdAt > lastSyncTime)
        .map(sbMessage => {
          if (sbMessage.messageType === 'user') {
            const userMessage = sbMessage as SendBird.UserMessage;
            const senderName = userMessage.sender?.nickname || userMessage.sender?.userId || 'Неизвестный';
            const messageText = userMessage.message || '';
            
            return {
              id: userMessage.messageId,
              text: messageText,
              sender: senderName,
              timestamp: new Date(userMessage.createdAt)
            };
          } else if (sbMessage.messageType === 'admin') {
            const adminMessage = sbMessage as SendBird.AdminMessage;
            
            return {
              id: adminMessage.messageId,
              text: adminMessage.message || '',
              sender: 'Система',
              timestamp: new Date(adminMessage.createdAt)
            };
          }
          
          return null;
        })
        .filter(Boolean) as Message[];
      
      // Обновляем время последней синхронизации
      lastSyncTime = Date.now();
      
      // Если есть новые сообщения, вызываем колбэк
      if (newMessages.length > 0) {
        onNewMessages(newMessages);
      }
    } catch (error) {
      console.error('Ошибка при автоматической синхронизации:', error);
    }
  };
  
  // Запускаем интервал
  const intervalId = setInterval(performSync, SYNC_INTERVAL);
  
  // Немедленно выполняем первую синхронизацию
  performSync();
  
  // Возвращаем функцию для отмены автосинхронизации
  return () => {
    clearInterval(intervalId);
  };
};

// Получение списка всех доступных каналов
export const getChannelList = async (): Promise<Channel[]> => {
  try {
    if (!sb.currentUser) {
      await initSendbird();
    }
    
    // Создание запроса на получение списка каналов
    const channelListQuery = sb.GroupChannel.createMyGroupChannelListQuery();
    channelListQuery.includeEmpty = true;
    channelListQuery.limit = 100;
    
    // Получение каналов
    const channels = await channelListQuery.next();
    
    // Преобразование каналов SendBird в формат нашего приложения
    return channels.map(channel => {
      let lastMessageText = '';
      
      // Проверяем тип последнего сообщения и получаем его текст
      if (channel.lastMessage) {
        if (channel.lastMessage.messageType === 'user') {
          lastMessageText = (channel.lastMessage as SendBird.UserMessage).message || '';
        } else if (channel.lastMessage.messageType === 'admin') {
          lastMessageText = (channel.lastMessage as SendBird.AdminMessage).message || '';
        }
      }
      
      return {
        url: channel.url,
        name: channel.name,
        memberCount: channel.memberCount,
        unreadMessageCount: channel.unreadMessageCount,
        lastMessage: lastMessageText
      };
    });
  } catch (error) {
    console.error('Ошибка при получении списка каналов:', error);
    throw error;
  }
};

// Создание нового канала
export const createChannel = async (channelName: string): Promise<Channel> => {
  try {
    if (!sb.currentUser) {
      await initSendbird();
    }
    
    // Создание параметров для нового канала
    const params = new sb.GroupChannelParams();
    params.name = channelName;
    params.isPublic = true;
    params.operatorUserIds = [USER_ID];
    
    // Создание нового канала
    const newChannel = await sb.GroupChannel.createChannel(params);
    
    // Преобразование канала SendBird в формат нашего приложения
    return {
      url: newChannel.url,
      name: newChannel.name,
      memberCount: newChannel.memberCount,
      unreadMessageCount: newChannel.unreadMessageCount,
      lastMessage: '' // Новый канал не имеет сообщений
    };
  } catch (error) {
    console.error('Ошибка при создании канала:', error);
    throw error;
  }
};

// Переключение между каналами
export const switchChannel = async (channelUrl: string): Promise<void> => {
  try {
    if (!sb.currentUser) {
      await initSendbird();
    }
    
    // Получаем канал по его URL
    currentChannel = await sb.GroupChannel.getChannel(channelUrl);
    
    // Отмечаем канал как прочитанный
    await currentChannel.markAsRead();
  } catch (error) {
    console.error('Ошибка при переключении канала:', error);
    throw error;
  }
}; 