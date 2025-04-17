import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
  autoSyncing?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  loading = false, 
  autoSyncing = false 
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Определяем ID текущего пользователя
  const currentUserId = localStorage.getItem('sendbird_user_id') || '';
  const currentUserNickname = localStorage.getItem('sendbird_user_nickname') || '';

  // Автопрокрутка к последнему сообщению при добавлении новых
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Форматирование времени
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Проверка, является ли сообщение отправленным текущим пользователем
  const isCurrentUserMessage = (message: Message): boolean => {
    // Проверяем по имени пользователя
    if (message.sender === currentUserNickname || message.sender === 'Вы') {
      return true;
    }
    return false;
  };
  
  // Проверка, является ли сообщение системным
  const isSystemMessage = (message: Message): boolean => {
    return message.sender === 'Система';
  };

  return (
    <div className="message-list">
      {loading ? (
        <div className="loading-messages">
          <div className="loading-spinner"></div>
          <p>Загрузка сообщений...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="no-messages">
          <p>Нет сообщений. Начните общение!</p>
        </div>
      ) : (
        <>
          {autoSyncing && (
            <div className="auto-sync-indicator">
              <span>Получены новые сообщения</span>
            </div>
          )}
          
          {messages.map(message => {
            const isOwn = isCurrentUserMessage(message);
            const isSystem = isSystemMessage(message);
            
            // Определяем класс сообщения в зависимости от отправителя
            let messageClass = 'message';
            if (isSystem) {
              messageClass += ' message-system';
            } else if (isOwn) {
              messageClass += ' message-own';
            } else {
              messageClass += ' message-others';
            }
            
            return (
              <div 
                key={message.id} 
                className={messageClass}
              >
                <div className="message-header">
                  <span className="message-sender">
                    {isOwn ? `${message.sender} (Вы)` : message.sender}
                  </span>
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                </div>
                <div className="message-text">{message.text}</div>
              </div>
            );
          })}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 