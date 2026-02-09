import React, { useState, useCallback, useRef, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/MainMenu';
import { GameMode } from './types';
import { WebRTCManager, generatePlayerId } from './lib/WebRTCManager';

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.MENU);
  const [isPaused, setIsPaused] = useState(false);
  const [globalPaused, setGlobalPaused] = useState(false); // Глобальная пауза для мультиплеера
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const localPlayerIdRef = useRef<string>(generatePlayerId());
  const localPlayerNameRef = useRef<string>('Player');

  // Обработчик начала игры
  const handleStartGame = useCallback((mode: GameMode, webrtcManager?: WebRTCManager) => {
    console.log('[App] handleStartGame called, mode:', mode, 'hasManager:', !!webrtcManager);
    setGameMode(mode);
    setIsPaused(false);
    setGlobalPaused(false);

    if (webrtcManager) {
      webrtcManagerRef.current = webrtcManager;
      localPlayerNameRef.current = webrtcManager.getLocalPlayerName();
      const realPeerId = webrtcManager.getPeerId();
      localPlayerIdRef.current = realPeerId; // Получаем реальный peer ID
      console.log('[App] Game started, realPeerId:', realPeerId);

      // Подписываемся на сообщения о паузе
      webrtcManager.onMessage((message) => {
        console.log('[App] Message received in game:', message.type);
        if (message.type === 'PAUSE_TOGGLE') {
          setGlobalPaused(message.data.paused);
        } else if (message.type === 'PLAYER_NAME_CHANGE') {
          // Обновляем имя игрока
          // Можно добавить логику для отображения обновлённых имён
        }
      });
    }
  }, []);

  // Обработчик паузы (локальной или глобальной)
  const handlePauseToggle = useCallback(() => {
    if (gameMode === GameMode.MENU) return;

    // В мультиплеере только хост может управлять паузой
    const isHost = webrtcManagerRef.current?.isHostMode();

    if (gameMode === GameMode.SINGLE_PLAYER || gameMode === GameMode.MULTI_PLAYER || isHost) {
      // Переключаем локальную паузу
      setIsPaused(prev => {
        const newPaused = !prev;
        setGlobalPaused(newPaused);

        // В мультиплеере рассылаем всем
        if (isHost && webrtcManagerRef.current) {
          const realPlayerId = webrtcManagerRef.current.getPeerId();
          webrtcManagerRef.current.send({
            type: 'PAUSE_TOGGLE',
            playerId: realPlayerId,
            data: { paused: newPaused },
            timestamp: Date.now()
          });
        }

        return newPaused;
      });
    }
  }, [gameMode]);

  // Обработчик смены имени
  const handleNameChange = useCallback((newName: string) => {
    localPlayerNameRef.current = newName;
    webrtcManagerRef.current?.setPlayerName(newName);
  }, []);

  // Обработчик рестарта
  const handleRestart = useCallback(() => {
    setIsPaused(false);
    setGlobalPaused(false);
  }, []);

  // Обработчик выхода в меню
  const handleBackToMenu = useCallback(() => {
    setGameMode(GameMode.MENU);
    setIsPaused(false);
    setGlobalPaused(false);
    webrtcManagerRef.current?.close();
    webrtcManagerRef.current = null;
  }, []);

  // Очистка только при закрытии вкладки
  useEffect(() => {
    return () => {
      webrtcManagerRef.current?.close();
    };
  }, []);

  // Эффект паузы = локальная ИЛИ глобальная
  const effectivePaused = isPaused || globalPaused;

  return (
    <div id="game-container" className="bg-[#0a0a0a] h-screen w-screen overflow-hidden flex flex-col">
      {gameMode === GameMode.MENU ? (
        <MainMenu onStartGame={handleStartGame} />
      ) : (
        <>
          <GameCanvas
            gameMode={gameMode}
            isPaused={effectivePaused}
            globalPaused={globalPaused}
            onPauseToggle={handlePauseToggle}
            onRestart={handleRestart}
            onBackToMenu={handleBackToMenu}
            onNameChange={handleNameChange}
            webrtcManager={webrtcManagerRef.current}
            localPlayerId={localPlayerIdRef.current}
            localPlayerName={localPlayerNameRef.current}
          />

          <div className="absolute bottom-4 right-4 text-white/30 text-[10px] uppercase tracking-widest pointer-events-none">
            WASD to Move | Space: Jump | ESC/P: Pause
          </div>
        </>
      )}
    </div>
  );
};

export default App;
