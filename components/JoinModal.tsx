import React, { useState, useEffect } from 'react';
import { WebRTCManager, ConnectionStatus } from '../lib/WebRTCManager';

interface JoinModalProps {
  webrtcManager: WebRTCManager;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
}

const JoinModal: React.FC<JoinModalProps> = ({ webrtcManager, onClose, connectionStatus }) => {
  const [offer, setOffer] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [answerGenerated, setAnswerGenerated] = useState<string>('');
  const [status, setStatus] = useState<'input' | 'generating' | 'waiting' | 'connected' | 'error'>('input');

  useEffect(() => {
    // Загружаем сохранённый offer
    const savedOffer = sessionStorage.getItem('joinOffer');
    if (savedOffer) {
      setOffer(savedOffer);
    }
  }, []);

  useEffect(() => {
    // Обновляем статус на основе connectionStatus
    if (connectionStatus === 'connected') {
      setStatus('connected');
    } else if (connectionStatus === 'error') {
      setStatus('error');
    }
  }, [connectionStatus]);

  const handleGenerateAnswer = async () => {
    if (!offer.trim()) return;

    setStatus('generating');

    try {
      const answerData = await webrtcManager.createAnswer(offer);
      setAnswerGenerated(answerData);
      setStatus('waiting');
      sessionStorage.removeItem('joinOffer'); // Очищаем после использования
    } catch (error) {
      console.error('Failed to create answer:', error);
      setStatus('error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'input': return 'Введите код приглашения';
      case 'generating': return 'Создание ответа...';
      case 'waiting': return 'Отправьте ответ хосту';
      case 'connected': return 'Подключено к хосту!';
      case 'error': return 'Ошибка подключения';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'input': return 'text-gray-400';
      case 'generating': return 'text-yellow-400';
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
            Вы успешно подключились к игре.
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
            Подключиться к игре
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

        {status === 'input' || status === 'error' ? (
          <div className="space-y-6">
            {/* Step 1: Paste Offer */}
            <div>
              <label className="text-orange-400 text-sm uppercase tracking-wider font-bold block mb-2">
                Вставьте код приглашения от хоста:
              </label>
              <textarea
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Вставьте сюда код приглашения от хоста..."
                className="w-full h-32 bg-black/50 border border-white/10 rounded-lg p-3 text-white text-xs font-mono resize-none focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Action */}
            <div className="flex gap-4">
              <button
                onClick={handleGenerateAnswer}
                disabled={!offer.trim()}
                className={`flex-1 px-6 py-3 font-bold uppercase tracking-wider rounded-lg transition-colors ${
                  offer.trim()
                    ? 'bg-orange-500 text-black hover:bg-orange-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Создать ответ
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 text-white font-bold uppercase tracking-wider rounded-lg hover:bg-white/20 transition-colors"
              >
                Отмена
              </button>
            </div>

            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-300 text-sm">
                  Не удалось подключиться. Проверьте, что код приглашения скопирован правильно.
                </p>
              </div>
            )}
          </div>
        ) : status === 'generating' ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Generated Answer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-green-400 text-sm uppercase tracking-wider font-bold">
                  Ваш ответ (скопируйте и отправьте хосту):
                </label>
                <button
                  onClick={() => copyToClipboard(answerGenerated)}
                  className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded hover:bg-green-500/30 transition-colors"
                >
                  Копировать
                </button>
              </div>
              <textarea
                readOnly
                value={answerGenerated}
                className="w-full h-32 bg-black/50 border border-white/10 rounded-lg p-3 text-white text-xs font-mono resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-white/10 text-white font-bold uppercase tracking-wider rounded-lg hover:bg-white/20 transition-colors"
              >
                Играть (ожидание подключения)
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-300 text-sm">
                <strong className="block mb-1">Инструкция:</strong>
                1. Скопируйте ответ выше<br />
                2. Отправьте ответ хосту любым способом<br />
                3. Хост применит ответ и подключение будет установлено<br />
                4. Можете начать играть!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinModal;
