  import { Message } from '../types';

// Имитация задержки сети
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Имитация хранилища данных
let messageStore: Message[] = [
  {
    id: 1,
    text: 'Привет! Как дела?',
    sender: 'Пользователь 1',
    timestamp: new Date(Date.now() - 3600000)
  },
  {
    id: 2,
    text: 'Всё хорошо, спасибо! А у тебя?',
    sender: 'Пользователь 2',
    timestamp: new Date(Date.now() - 3500000)
  }
];

// Функция для получения всех сообщений
export const getMessages = async (): Promise<Message[]> => {
  // Имитация задержки сети
  await delay(800);
  
  // Имитация ошибки сети с 10% вероятностью
  if (Math.random() < 0.1) {
    throw new Error('Ошибка сети при получении сообщений');
  }
  
  return [...messageStore];
};

// Функция для отправки нового сообщения
export const sendMessage = async (text: string, sender: string): Promise<Message> => {
  // Имитация задержки сети
  await delay(500);
  
  // Имитация ошибки сети с 10% вероятностью
  if (Math.random() < 0.1) {
    throw new Error('Ошибка сети при отправке сообщения');
  }
  
  const newMessage: Message = {
    id: Date.now(),
    text,
    sender,
    timestamp: new Date()
  };
  
  // Добавление сообщения в хранилище
  messageStore.push(newMessage);
  
  return newMessage;
};

// Функция для получения автоматического ответа от "бота"
export const getAutoResponse = async (message: string): Promise<Message> => {
  // Имитация задержки ответа
  await delay(1000);
  
  // Простой алгоритм генерации ответа
  let responseText = '';
  
  if (message.toLowerCase().includes('привет')) {
    responseText = 'Привет! Как я могу помочь вам сегодня?';
  } else if (message.toLowerCase().includes('пока') || message.toLowerCase().includes('до свидания')) {
    responseText = 'До свидания! Буду рад помочь вам снова!';
  } else if (message.endsWith('?')) {
    responseText = 'Хороший вопрос! Давайте обсудим это подробнее.';
  } else {
    responseText = 'Спасибо за сообщение! Чем я могу помочь?';
  }
  
  const autoResponse: Message = {
    id: Date.now() + 1,
    text: responseText,
    sender: 'Бот',
    timestamp: new Date()
  };
  
  // Добавление ответа в хранилище
  messageStore.push(autoResponse);
  
  return autoResponse;
}; 