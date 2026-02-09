import React, { useState, useEffect } from 'react';
import { WebRTCManager, ConnectionStatus } from '../lib/WebRTCManager';

interface InviteModalProps {
  webrtcManager: WebRTCManager;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
}

const InviteModal: React.FC<InviteModalProps> = ({ webrtcManager, onClose, connectionStatus }) => {
  const [offer, setOffer] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [status, setStatus] = useState<'creating' | 'waiting' | 'connected' | 'error'>('creating');

  useEffect(() => {
    // Создаём offer при загрузке
    let mounted = true;

    const createOffer = async () => {
      try {
        const offerData = await webrtcManager.createOffer();
        if (mounted) {
          setOffer(offerData);
          setStatus('waiting');
        }
      } catch (error) {
        console.error('Failed to create offer:', error);
        if (mounted) {
          setStatus('error');
        }
      }
    };

    createOffer();

    return () => {
      mounted = false;
    };
  }, [webrtcManager]);

  useEffect(() => {
    // Обновляем статус на основе connectionStatus
    if (connectionStatus === 'connected') {
      setStatus('connected');
    } else if (connectionStatus === 'error') {
      setStatus('error');
    }
  }, [connectionStatus]);

  const handleSetAnswer = async () => {
    if (!answer.trim()) return;

    try {
      await webrtcManager.setRemoteAnswer(answer);
      setAnswer(''); // Очищаем после успешного применения
    } catch (error) {
      console.error('Failed to set answer:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'creating': return 'Создание приглашения...';
      case 'waiting': return 'Ожидание ответа от игрока...';
      case 'connected': return 'Игрок подключился!';
      case 'error': return 'Ошибка подключения';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'creating': return 'text-yellow-400';
      case 'waiting': return 'text-blue-400';
      case 'connected': return 'text-green-400';
      case 'error': return 'text-red-400';
    }
  };

  if (status === 'connected') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#1a1a1a] border border-green-500/50 rounded-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-400 uppercase tracking-widest mb-4">
            Подключено!
          </h2>
          <p className="text-gray-400 mb-6">
            Второй игрок успешно подключился к игре.
          </p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-green-500 text-black font-bold uppercase tracking-wider rounded-lg hover:bg-green-400 transition-colors"
          >
            Начать игру
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">
            Пригласить игрока
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status */}
        <div className={`text-center mb-6 ${getStatusColor()}`}>
          {getStatusMessage()}
        </div>

        {status === 'creating' ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Copy Offer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-cyan-400 text-sm uppercase tracking-wider font-bold">
                  1. Скопируйте этот код и отправьте другу:
                </label>
                <button
                  onClick={() => copyToClipboard(offer)}
                  className="text-xs bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded hover:bg-cyan-500/30 transition-colors"
                >
                  Копировать
                </button>
              </div>
              <textarea
                readOnly
                value={offer}
                className="w-full h-24 bg-black/50 border border-white/10 rounded-lg p-3 text-white text-xs font-mono resize-none"
              />
            </div>

            {/* Step 2: Paste Answer */}
            <div>
              <label className="text-cyan-400 text-sm uppercase tracking-wider font-bold block mb-2">
                2. Вставьте ответ от друга:
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Вставьте сюда ответ, который вам прислал друг..."
                className="w-full h-24 bg-black/50 border border-white/10 rounded-lg p-3 text-white text-xs font-mono resize-none focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleSetAnswer}
                disabled={!answer.trim()}
                className={`flex-1 px-6 py-3 font-bold uppercase tracking-wider rounded-lg transition-colors ${
                  answer.trim()
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Подключить
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 text-white font-bold uppercase tracking-wider rounded-lg hover:bg-white/20 transition-colors"
              >
                Закрыть
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-300 text-sm">
                <strong className="block mb-1">Инструкция:</strong>
                1. Скопируйте код выше и отправьте другу любым способом<br />
                2. Друг вставит код у себя и получит ответ<br />
                3. Друг отправит вам ответ, вставьте его в поле выше<br />
                4. Нажмите "Подключить"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteModal;
