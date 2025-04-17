import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
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

  // Загрузка истории сообщений
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Инициализация SendBird
        await sendbirdService.initSendbird();
        setConnected(true);
        
        // Получение истории сообщений
        const messages = await sendbirdService.getMessages();
        setMessages(messages);
        
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
    <section className="chat-container">
      {renderNicknameModal()}
      
      <h1>Чат в реальном времени с SendBird</h1>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Закрыть</button>
        </div>
      )}
      
      {loading ? (
        <div className="loading-indicator">
          <p>Подключение к SendBird...</p>
        </div>
      ) : (
        <>
          {autoSyncing && (
            <div className="auto-sync-indicator">
              <span>Получены новые сообщения</span>
            </div>
          )}
          
          <MessageList messages={messages} />
          <MessageInput onSendMessage={handleSendMessage} />
          
          {connected && (
            <div className="connection-status connected">
              <span>Соединение установлено</span>
              <button 
                onClick={handleSyncMessages} 
                disabled={syncing}
                className={`sync-button ${syncing ? 'syncing' : ''}`}
              >
                {syncing ? 'Синхронизация...' : 'Синхронизировать'}
              </button>
              <button 
                onClick={() => setShowNicknameModal(true)}
                className="change-name-button"
              >
                Изменить имя
              </button>
            </div>
          )}
          
          {!connected && !loading && !showNicknameModal && (
            <div className="connection-status disconnected">
              <span>Соединение разорвано</span>
              <button onClick={() => window.location.reload()}>Переподключиться</button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ChatContainer; 