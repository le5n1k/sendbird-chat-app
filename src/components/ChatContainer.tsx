import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ChannelList, { Channel } from './ChannelList';
import { Message } from '../types';
import * as sendbirdService from '../services/sendbirdService';
import './ChatContainer.css';

const ChatContainer: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [autoSyncing, setAutoSyncing] = useState<boolean>(false);
  const [nickname, setNickname] = useState<string>('');
  const [showNicknameModal, setShowNicknameModal] = useState<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showChannelList, setShowChannelList] = useState<boolean>(true);

  // Проверка на наличие сохраненного имени пользователя
  useEffect(() => {
    const savedNickname = localStorage.getItem('sendbird_user_nickname');
    if (!savedNickname || savedNickname === 'Пользователь') {
      setShowNicknameModal(true);
    } else {
      setNickname(savedNickname);
    }
  }, []);

  // Сохранение имени пользователя
  const handleNicknameSave = () => {
    if (nickname.trim()) {
      localStorage.setItem('sendbird_user_nickname', nickname);
      setShowNicknameModal(false);
      // Перезагружаем страницу, чтобы применить новое имя при подключении к SendBird
      window.location.reload();
    }
  };

  // Обработчик выбора канала
  const handleChannelSelect = async (channel: Channel) => {
    setLoading(true);
    setError(null);
    setMessages([]);
    
    try {
      await sendbirdService.switchChannel(channel.url);
      setSelectedChannel(channel);
      
      // Получение истории сообщений для выбранного канала
      const messages = await sendbirdService.getMessages();
      setMessages(messages);
    } catch (err: any) {
      console.error('Ошибка при переключении канала:', err);
      setError('Не удалось загрузить сообщения для выбранного чата. ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // Загрузка истории сообщений
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Инициализация SendBird
        await sendbirdService.initSendbird();
        setConnected(true);
        
        // Получение списка каналов и выбор первого канала по умолчанию
        const channels = await sendbirdService.getChannelList();
        if (channels.length > 0 && !selectedChannel) {
          await handleChannelSelect(channels[0]);
        } else {
          // Получение истории сообщений
          const messages = await sendbirdService.getMessages();
          setMessages(messages);
        }
        
        // Подписываемся на обновления канала
        await sendbirdService.subscribeToChannelUpdates();
        
        // Запускаем немедленную синхронизацию для получения последних сообщений
        const syncedMessages = await sendbirdService.syncMessages();
        
        // Добавляем только те сообщения, которых еще нет в списке
        if (syncedMessages.length > 0) {
          setMessages(prevMessages => {
            const existingIds = new Set(prevMessages.map((msg: Message) => msg.id));
            const newMessages = syncedMessages.filter((msg: Message) => !existingIds.has(msg.id));
            
            if (newMessages.length > 0) {
              return [...prevMessages, ...newMessages];
            }
            
            return prevMessages;
          });
        }
      } catch (err: any) {
        console.error('Ошибка при загрузке сообщений:', err);
        setError('Не удалось загрузить сообщения. Пожалуйста, попробуйте снова. ' + (err.message || ''));
      } finally {
        setLoading(false);
      }
    };

    // Загружаем сообщения только если не показывается модальное окно с вводом имени
    if (!showNicknameModal) {
      fetchMessages();
    }
  }, [showNicknameModal]);

  // Настройка обработчика сообщений в реальном времени
  useEffect(() => {
    if (!connected) return;

    let removeAutoSync: (() => void) | undefined;
    
    // Запускаем автоматическую синхронизацию сообщений
    try {
      removeAutoSync = sendbirdService.startAutoSync((newMessages: Message[]) => {
        console.log('Получены новые сообщения при автосинхронизации:', newMessages);
        // Показываем индикатор автосинхронизации
        setAutoSyncing(true);
        // Добавляем новые сообщения в список
        setMessages(prevMessages => [...prevMessages, ...newMessages]);
        // Скрываем индикатор через 2 секунды
        setTimeout(() => setAutoSyncing(false), 2000);
      });
    } catch (err) {
      console.error('Ошибка при запуске автосинхронизации:', err);
    }
    
    // Установка обработчика новых сообщений
    const removeHandler = sendbirdService.setupMessageHandler((message: Message) => {
      console.log('Получено сообщение в компоненте:', message);
      setMessages(prevMessages => [...prevMessages, message]);
    });

    // Очистка обработчика при размонтировании компонента
    return () => {
      removeHandler();
      if (removeAutoSync) {
        removeAutoSync();
      }
    };
  }, [connected]);

  // Обработчик отправки нового сообщения
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !connected) return;
    
    setError(null);
    
    try {
      // Получаем имя пользователя из localStorage
      const userNickname = localStorage.getItem('sendbird_user_nickname') || 'Вы';
      
      // Отправка сообщения через SendBird
      const newMessage = await sendbirdService.sendMessage(text, userNickname);
      setMessages(prevMessages => [...prevMessages, newMessage]);
    } catch (err: any) {
      console.error('Ошибка при отправке сообщения:', err);
      setError('Не удалось отправить сообщение. Пожалуйста, попробуйте снова. ' + (err.message || ''));
    }
  };

  // Обработчик для синхронизации сообщений
  const handleSyncMessages = async () => {
    if (!connected || syncing) return;
    
    setSyncing(true);
    setError(null);
    
    try {
      // Синхронизация сообщений
      const syncedMessages = await sendbirdService.syncMessages();
      
      // Обновляем список сообщений, избегая дубликатов
      setMessages(prevMessages => {
        const existingIds = new Set(prevMessages.map((msg: Message) => msg.id));
        const newMessages = syncedMessages.filter((msg: Message) => !existingIds.has(msg.id));
        
        if (newMessages.length > 0) {
          return [...prevMessages, ...newMessages];
        }
        
        return prevMessages;
      });
    } catch (err: any) {
      console.error('Ошибка при синхронизации сообщений:', err);
      setError('Не удалось синхронизировать сообщения. ' + (err.message || ''));
    } finally {
      setSyncing(false);
    }
  };

  // Переключение отображения списка каналов
  const toggleChannelList = () => {
    setShowChannelList(prev => !prev);
  };

  // Модальное окно для ввода имени пользователя
  const renderNicknameModal = () => {
    if (!showNicknameModal) return null;
    
    return (
      <div className="nickname-modal-overlay">
        <div className="nickname-modal">
          <h2>Представьтесь, пожалуйста</h2>
          <p>Введите ваше имя для участия в чате</p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Ваше имя"
            className="nickname-input"
            autoFocus
          />
          <button
            className="save-nickname-button"
            onClick={handleNicknameSave}
            disabled={!nickname.trim()}
          >
            Сохранить и войти в чат
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="chat-container">
      {renderNicknameModal()}
      
      <div className="chat-layout">
        {showChannelList && (
          <ChannelList 
            onChannelSelect={handleChannelSelect} 
            selectedChannelUrl={selectedChannel?.url}
          />
        )}
        
        <div className="chat-main">
          <div className="chat-header">
            <button className="toggle-channel-list" onClick={toggleChannelList}>
              {showChannelList ? '←' : '→'}
            </button>
            <h2 className="channel-title">
              {selectedChannel ? selectedChannel.name : 'Чат'}
              {selectedChannel && <span className="channel-members-count"> ({selectedChannel.memberCount})</span>}
            </h2>
            
            <div className="chat-actions">
              <button className="sync-button" onClick={handleSyncMessages} disabled={syncing || loading}>
                {syncing ? "Синхронизация..." : "Обновить"}
              </button>
            </div>
          </div>
          
          <div className="chat-content">
            {error && <div className="error-message">{error}</div>}
            
            <MessageList 
              messages={messages} 
              loading={loading} 
              autoSyncing={autoSyncing}
            />
            
            <MessageInput 
              onSendMessage={handleSendMessage} 
              disabled={!connected || loading || !selectedChannel}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatContainer; 