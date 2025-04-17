import React, { useState, FormEvent, ChangeEvent } from 'react';
import './MessageInput.css';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, disabled = false }) => {
  const [message, setMessage] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Обработка изменения текста сообщения
  const handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMessage(text);
    setIsValid(text.trim().length > 0);
  };

  // Обработка отправки формы
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!isValid || isSending || disabled) return;
    
    setIsSending(true);
    
    try {
      await onSendMessage(message);
      setMessage('');
      setIsValid(false);
    } catch (error) {
      console.error('Ошибка при отправке:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Обработка нажатия Enter для отправки
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isValid && !isSending && !disabled) {
        handleSubmit(e);
      }
    }
  };

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <div className="message-input-container">
        <textarea
          className="message-input"
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Выберите чат для отправки сообщений..." : "Введите сообщение..."}
          disabled={isSending || disabled}
        />
        <button 
          type="submit" 
          className={`send-button ${isValid && !disabled ? 'active' : 'disabled'}`}
          disabled={!isValid || isSending || disabled}
        >
          {isSending ? (
            <span className="sending-indicator"></span>
          ) : (
            <span className="send-icon">➤</span>
          )}
        </button>
      </div>
      <div className="input-help-text">
        <p>Нажмите Shift+Enter для переноса строки</p>
      </div>
    </form>
  );
};

export default MessageInput; 