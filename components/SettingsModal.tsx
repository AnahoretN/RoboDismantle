import React from 'react';

interface SettingsModalProps {
  onClose: () => void;
  onJoinClick: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onJoinClick }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">
            Настройки
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Alternative connection method */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <h3 className="text-orange-400 font-bold uppercase tracking-wider mb-2">
              Альтернативное подключение
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Используйте этот метод, если ссылка-приглашение не работает. Вам нужно будет вручную обменяться кодами с хостом.
            </p>
            <button
              onClick={onJoinClick}
              className="w-full px-6 py-3 bg-orange-500 text-black font-bold uppercase tracking-wider rounded-lg hover:bg-orange-400 transition-colors"
            >
              Подключиться по коду
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-xs">
              <strong className="block mb-1">ℹ️ О методах подключения:</strong>
              • <strong>По ссылке</strong> — нажмите кнопку на главном меню чтобы создать комнату<br />
              • <strong>По коду</strong> — работает даже если PeerJS сервер недоступен
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
