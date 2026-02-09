import React, { useState, useEffect } from 'react';

interface NameInputModalProps {
  onSubmit: (name: string) => void;
  isHost: boolean;
  defaultName: string;
  initializing?: boolean;
}

const NameInputModal: React.FC<NameInputModalProps> = ({ onSubmit, isHost, defaultName, initializing = false }) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    // Проверяем есть ли сохранённый код альтернативного подключения
    const altCode = sessionStorage.getItem('altJoinCode');
    if (altCode && !isHost) {
      // Парсим имя из кода если есть
      try {
        const data = JSON.parse(altCode);
        if (data.hostId) {
          // Есть код, можно продолжать
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
  }, [isHost]);

  const handleSubmit = () => {
    const trimmedName = name.trim() || 'Player';
    onSubmit(trimmedName);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-cyan-500/30 rounded-2xl p-10 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-4xl">🤖</span>
          </div>
          <h2 className="text-3xl font-bold text-white uppercase tracking-widest mb-2">
            {isHost ? 'Создание комнаты' : 'Подключение'}
          </h2>
          <p className="text-gray-400">
            {isHost ? 'Введите имя для создания комнаты' : 'Введите имя для присоединения к игре'}
          </p>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 15))}
          onKeyPress={handleKeyPress}
          placeholder="Ваше имя"
          maxLength={15}
          className="w-full px-6 py-4 bg-black/50 border-2 border-cyan-500/30 rounded-lg text-white text-center text-xl font-mono focus:border-cyan-500 focus:outline-none transition-colors"
          autoFocus
        />

        <div className="mt-4 text-gray-500 text-sm">
          {name.length}/15 символов
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={handleSubmit}
            disabled={initializing}
            className="flex-1 px-8 py-4 bg-cyan-500 text-black font-bold uppercase tracking-widest rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initializing ? '⏳ Подключение...' : (isHost ? 'Создать' : 'Подключиться')}
          </button>
        </div>

        <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
          <p className="text-cyan-400 text-xs">
            <strong className="block mb-1">ℹ️ Info:</strong>
            {isHost
              ? 'После создания комнаты вы сможете скопировать ссылку-приглашение для друзей.'
              : 'Вы попадёте в лобби хоста и сможете начать игру вместе.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NameInputModal;
