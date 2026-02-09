import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GameMode } from '../types';
import { WebRTCManager, PlayerInfo, generatePlayerId } from '../lib/WebRTCManager';
import NameInputModal from './NameInputModal';
import SettingsModal from './SettingsModal';

interface MainMenuProps {
  onStartGame: (mode: GameMode, webrtcManager?: WebRTCManager) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame }) => {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [connectedPlayers, setConnectedPlayers] = useState<PlayerInfo[]>([]);
  const [canStart, setCanStart] = useState(false);
  const [isHosting, setIsHosting] = useState(false);
  const [isGuest, setIsGuest] = useState(false); // Гость в лобби
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState('Player');
  const webrtcManagerRef = React.useRef<WebRTCManager | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const [localPeerId, setLocalPeerId] = useState<string>(''); // Реальный peer ID от PeerJS

  // Генерируем ID один раз (для хоста)
  const playerId = useMemo(() => generatePlayerId(), []);

  // Проверка URL для автоподключения
  useEffect(() => {
    const roomId = WebRTCManager.getRoomIdFromURL();
    if (roomId) {
      // Есть room ID в URL - показываем ввод имени (гость)
      setShowNameInput(true);
    }
    // НЕ очищаем WebRTCManager при размонтировании - он передаётся в App/GameCanvas
  }, []);

  // Быстрая инициализация хоста - один клик
  const quickHost = useCallback(async () => {
    if (initializing || isHosting) return;
    setInitializing(true);

    // Закрываем предыдущее соединение если есть
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.close();
    }

    const defaultName = 'Player';
    setPlayerName(defaultName);
    const manager = new WebRTCManager(true, playerId, defaultName);
    webrtcManagerRef.current = manager;

    try {
      const link = await manager.initAsHost();
      setInviteLink(link);
      setIsHosting(true);

      // Получаем реальный peer ID хоста
      setLocalPeerId(manager.getPeerId());

      // Копируем ссылку в буфер обмена
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);

      // Подписываемся на изменения списка игроков
      manager.onPlayerListChange((players) => {
        setConnectedPlayers(players);
        setCanStart(players.length >= 1); // Можно играть с 1 игрока
      });

      setConnectedPlayers(manager.getConnectedPlayers());
    } catch (error) {
      console.error('Failed to init host:', error);
      setInitializing(false);
    } finally {
      setInitializing(false);
    }
  }, [initializing, isHosting, playerId]);

  // Подключение как гость
  const joinGame = useCallback(async (name: string) => {
    if (initializing) return;
    setInitializing(true);

    // Закрываем предыдущее соединение если есть
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.close();
    }

    setPlayerName(name);
    const manager = new WebRTCManager(false, playerId, name);
    webrtcManagerRef.current = manager;

    let roomId = WebRTCManager.getRoomIdFromURL();

    // Проверяем альтернативный метод (через sessionStorage)
    if (!roomId) {
      const altCode = sessionStorage.getItem('altJoinCode');
      if (altCode) {
        roomId = altCode; // Для альтернативного метода используем код как roomId
        sessionStorage.removeItem('altJoinCode');
      }
    }

    if (!roomId) {
      setShowJoinModal(true);
      setInitializing(false);
      return;
    }

    try {
      await manager.joinAsGuest(roomId);
      WebRTCManager.clearRoomFromURL();

      // Получаем реальный peer ID
      setLocalPeerId(manager.getPeerId());

      // Подписываемся на изменения списка игроков
      manager.onPlayerListChange((players) => {
        setConnectedPlayers(players);
      });

      // Подписываемся на сообщения от хоста (например, GAME_START)
      manager.onMessage((message) => {
        console.log('[MainMenu Guest] Received message:', message.type, message);
        if (message.type === 'GAME_START') {
          console.log('[MainMenu Guest] GAME_START received! Starting game...');
          // Хост начал игру - переходим к игре
          setIsGuest(false); // Выходим из режима лобби
          onStartGame(GameMode.MULTI_PLAYER, manager);
        }
      });

      // Гость остаётся в лобби, НЕ запускаем игру сразу
      setConnectedPlayers(manager.getConnectedPlayers());
      setIsGuest(true); // Входим в режим лобби гостя
      setShowNameInput(false); // Закрываем модалку ввода имени
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Не удалось подключиться к комнате. Возможно, она переполнена или недоступна.');
      WebRTCManager.clearRoomFromURL();
      setInitializing(false);
    } finally {
      setInitializing(false);
    }
  }, [initializing, playerId, onStartGame]);

  // Копирование ссылки (для повторного копирования)
  const copyInviteLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
  };

  // Сохранение изменённого имени
  const saveName = () => {
    const trimmedName = tempName.trim() || 'Player';
    setPlayerName(trimmedName);
    setEditingName(false);

    // Обновляем в WebRTCManager
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.setPlayerName(trimmedName);
    }
  };

  // Начало редактирования имени
  const startEditingName = () => {
    setTempName(playerName);
    setEditingName(true);
  };

  // Начать игру (хост отправляет сигнал всем игрокам)
  const startGame = () => {
    const manager = webrtcManagerRef.current;
    if (manager) {
      console.log('[MainMenu] Host starting game, peerId:', localPeerId || playerId);

      const spawnX = -500 + 100 + Math.random() * (3000 - 200); // Простейшая платформа
      const spawnY = 500 - 100;

      const message = {
        type: 'GAME_START',
        playerId: localPeerId || playerId,
        data: { spawnX, spawnY },
        timestamp: Date.now()
      };

      console.log('[MainMenu] Sending GAME_START message FIRST:', message);

      // СНАЧАЛА отправляем GAME_START пока соединения активны
      manager.send(message);
      console.log('[MainMenu] GAME_START sent, connections:', manager['connections']?.size || 'unknown');

      // ЗАТЕМ хост переходит в игру
      // Используем setTimeout чтобы дать время сообщению уйти
      setTimeout(() => {
        console.log('[MainMenu] Now calling onStartGame');
        onStartGame(GameMode.MULTI_PLAYER, manager);
      }, 50);
    } else {
      console.error('[MainMenu] Cannot start game - manager is null!');
    }
  };

  // Одиночная игра
  const startSinglePlayer = () => {
    onStartGame(GameMode.SINGLE_PLAYER);
  };

  // Модальное окно ввода имени (только для гостей)
  if (showNameInput) {
    return (
      <NameInputModal
        onSubmit={joinGame}
        isHost={false}
        defaultName={playerName}
        initializing={initializing}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0, 242, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 242, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'grid-move 20s linear infinite'
        }} />
      </div>

      <style>{`
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 242, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 242, 255, 0.6); }
        }
        @keyframes title-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(0, 242, 255, 0.5), 0 0 40px rgba(0, 242, 255, 0.3); }
          50% { text-shadow: 0 0 40px rgba(0, 242, 255, 0.8), 0 0 80px rgba(0, 242, 255, 0.5); }
        }
        .menu-btn {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .menu-btn:hover {
          animation: none;
          box-shadow: 0 0 50px rgba(0, 242, 255, 0.8) !important;
        }
      `}</style>

      <div className="relative z-10 flex gap-8 items-center">
        {/* Left side - Menu */}
        <div className="text-center">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-6xl font-black italic tracking-tighter text-white mb-2" style={{ animation: 'title-glow 3s ease-in-out infinite' }}>
              ROBO-DISMANTLE
            </h1>
            <p className="text-xl font-bold text-cyan-400 tracking-[0.5em] uppercase">
              Neon Protocol
            </p>
          </div>

          {/* Menu Buttons */}
          <div className="flex flex-col gap-3 items-center">
            {isGuest ? (
              // Гость в лобби - кнопки отключены
              <>
                <button
                  disabled
                  className="w-64 px-6 py-3 bg-cyan-500/10 border-2 border-cyan-500/30 rounded-lg text-white/50 font-bold uppercase tracking-widest cursor-not-allowed"
                >
                  Одиночная игра
                </button>

                <div className="w-64 px-6 py-3 bg-orange-500/10 border-2 border-orange-500/30 rounded-lg text-center">
                  <p className="text-orange-400 font-bold uppercase text-sm">
                    Ожидание хоста...
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Игра начнётся когда хост нажмёт "Начать игру"
                  </p>
                </div>

                <button
                  disabled
                  className="w-64 px-6 py-3 bg-white/5 border-2 border-white/10 rounded-lg text-white/50 font-bold uppercase tracking-widest cursor-not-allowed"
                >
                  ⚙ Настройки
                </button>

                <button
                  onClick={() => {
                    webrtcManagerRef.current?.close();
                    setIsGuest(false);
                    setConnectedPlayers([]);
                  }}
                  className="w-64 px-6 py-3 bg-red-500/10 border-2 border-red-500/50 rounded-lg text-white font-bold uppercase tracking-widest hover:bg-red-500 hover:text-black transition-all duration-300"
                >
                  ✕ Покинуть лобби
                </button>
              </>
            ) : (
              // Обычное меню или хост
              <>
                <button
                  onClick={startSinglePlayer}
                  disabled={isHosting}
                  className="menu-btn w-64 px-6 py-3 bg-cyan-500/10 border-2 border-cyan-500/50 rounded-lg text-white font-bold uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Одиночная игра
                </button>

                {isHosting ? (
                  <>
                    <button
                      onClick={copyInviteLink}
                      className="menu-btn w-64 px-6 py-3 bg-green-500/10 border-2 border-green-500/50 rounded-lg text-white font-bold uppercase tracking-widest hover:bg-green-500 hover:text-black transition-all duration-300"
                      style={{ animationDelay: '0.2s' }}
                    >
                      {linkCopied ? '✓ Ссылка скопирована!' : '📋 Копировать ссылку'}
                    </button>

                    {canStart && (
                      <button
                        onClick={startGame}
                        className="menu-btn w-64 px-6 py-3 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-lg text-white font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all duration-300 animate-pulse"
                        style={{ animationDelay: '0.3s' }}
                      >
                        ▶ Начать игру
                      </button>
                    )}

                    <button
                      onClick={() => {
                        webrtcManagerRef.current?.close();
                        setIsHosting(false);
                        setInviteLink('');
                        setConnectedPlayers([]);
                        setCanStart(false);
                      }}
                      className="w-64 px-6 py-3 bg-red-500/10 border-2 border-red-500/50 rounded-lg text-white font-bold uppercase tracking-widest hover:bg-red-500 hover:text-black transition-all duration-300"
                    >
                      ✕ Отменить
                    </button>
                  </>
                ) : (
                  <button
                    onClick={quickHost}
                    disabled={initializing}
                    className="menu-btn w-64 px-6 py-3 bg-green-500/10 border-2 border-green-500/50 rounded-lg text-white font-bold uppercase tracking-widest hover:bg-green-500 hover:text-black transition-all duration-300"
                    style={{ animationDelay: '0.2s' }}
                  >
                    {initializing ? '⏳ Создание комнаты...' : '🔗 Ссылка-приглашение'}
                  </button>
                )}

                <button
                  onClick={() => setShowSettings(true)}
                  disabled={isHosting}
                  className="menu-btn w-64 px-6 py-3 bg-white/5 border-2 border-white/20 rounded-lg text-white font-bold uppercase tracking-widest hover:bg-white/10 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ animationDelay: '0.4s' }}
                >
                  ⚙ Настройки
                </button>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 text-gray-500 text-xs">
            <p className="mb-1 uppercase tracking-widest">Управление</p>
            <p>WASD — движение | Space — прыжок | ЛКМ/ПКМ — стрельба</p>
            <p>ESC/P — пауза</p>
          </div>
        </div>

        {/* Right side - Player list (always shown) */}
        <div className="w-72 bg-[#1a1a1a] border border-cyan-500/30 rounded-xl p-6">
          <h3 className="text-cyan-400 text-sm font-black uppercase tracking-widest mb-4 border-b border-cyan-500/30 pb-2">
            Лобби ({connectedPlayers.length}/4)
          </h3>

          <div className="space-y-3">
            {connectedPlayers.map((player) => {
              // Используем реальный peer ID для определения локального игрока
              const realPeerId = webrtcManagerRef.current?.getPeerId() || playerId;
              const isLocalPlayer = player.id === realPeerId;
              const isEditingThis = editingName && isLocalPlayer;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 bg-black/30 rounded-lg p-3 border border-white/10"
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: player.color, boxShadow: `0 0 10px ${player.color}` }}
                  />
                  {isEditingThis ? (
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value.slice(0, 15))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName();
                        if (e.key === 'Escape') {
                          setTempName(playerName);
                          setEditingName(false);
                        }
                      }}
                      onBlur={saveName}
                      className="flex-1 bg-white/10 border border-cyan-500/50 rounded px-2 py-1 text-white text-sm font-mono focus:outline-none focus:border-cyan-500"
                      autoFocus
                      maxLength={15}
                    />
                  ) : (
                    <span className="text-white font-mono text-sm flex-1">
                      {player.name}
                    </span>
                  )}
                  {isLocalPlayer && !isEditingThis && (
                    <button
                      onClick={startEditingName}
                      className="text-gray-400 hover:text-cyan-400 transition-colors text-xs"
                      title="Изменить имя"
                    >
                      ✏️
                    </button>
                  )}
                  {isLocalPlayer && !isEditingThis && (
                    <span className="text-[10px] text-gray-500 uppercase">(вы)</span>
                  )}
                </div>
              );
            })}

            {connectedPlayers.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                {isGuest
                  ? 'Ожидание подключения к хосту...'
                  : !isHosting
                    ? 'Нажмите "Ссылка-приглашение" чтобы создать комнату'
                    : 'Ожидание игроков...'}
              </p>
            )}
          </div>

          {/* Invite link preview (when hosting) */}
          {isHosting && inviteLink && (
            <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/10">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Ссылка для приглашения:</p>
              <p className="text-[10px] text-cyan-400 font-mono break-all">
                {inviteLink.slice(0, 40)}...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onJoinClick={() => {
            setShowSettings(false);
            setIsHosting(false);
            setShowJoinModal(true);
          }}
        />
      )}

      {/* Join Modal (alternative method) */}
      {showJoinModal && !showNameInput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white uppercase tracking-widest">
                Альтернативное подключение
              </h2>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-gray-400 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-400 mb-6">
              Введите код комнаты от хоста:
            </p>

            <textarea
              id="altJoinInput"
              className="w-full h-32 bg-black/50 border border-white/10 rounded-lg p-3 text-white text-xs font-mono resize-none focus:border-orange-500 focus:outline-none mb-4"
              placeholder="Вставьте сюда код приглашения..."
            />

            <div className="flex gap-4">
              <button
                onClick={() => {
                  const code = (document.getElementById('altJoinInput') as HTMLTextAreaElement)?.value;
                  if (code) {
                    setShowJoinModal(false);
                    setIsHosting(false);
                    // Сохраняем для использования после ввода имени
                    sessionStorage.setItem('altJoinCode', code);
                    setShowNameInput(true);
                  }
                }}
                className="flex-1 px-6 py-3 bg-orange-500 text-black font-bold uppercase tracking-wider rounded-lg hover:bg-orange-400 transition-colors"
              >
                Подключиться
              </button>
              <button
                onClick={() => setShowJoinModal(false)}
                className="px-6 py-3 bg-white/10 text-white font-bold uppercase tracking-wider rounded-lg hover:bg-white/20 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
