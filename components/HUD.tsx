import React, { useEffect, useState, useCallback } from 'react';
import { GameState, LimbType } from '../types';
import { ConnectionStatus, PlayerInfo } from '../lib/WebRTCManager';

interface HUDProps {
  state: GameState;
  onRespawn: () => void;
  onNewGame: () => void;
  isPaused?: boolean;
  globalPaused?: boolean;
  isMultiplayer?: boolean;
  isHost?: boolean;
  connectionStatus?: ConnectionStatus;
  onBackToMenu?: () => void;
  onNameChange?: (name: string) => void;
  localPlayerName?: string;
  localPlayerId?: string;
  connectedPlayers?: PlayerInfo[];
  playerScores?: Map<string, number>;
}

const HUD: React.FC<HUDProps> = ({
  state,
  onRespawn,
  onNewGame,
  isPaused = false,
  globalPaused = false,
  isMultiplayer = false,
  isHost = false,
  connectionStatus = 'disconnected',
  onBackToMenu,
  onNameChange,
  localPlayerName = 'Player',
  localPlayerId = '',
  connectedPlayers = [],
  playerScores = new Map()
}) => {
  const { player, score, gameOver, gameStartTime, gameDuration, gameEnded } = state;
  const [timer, setTimer] = useState(10);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(localPlayerName);
  const [gameTimeLeft, setGameTimeLeft] = useState(300); // 5 minutes in seconds

  useEffect(() => {
    setTempName(localPlayerName);
  }, [localPlayerName]);

  // Game timer effect
  useEffect(() => {
    if (!gameStartTime || gameOver || gameEnded) return;

    const updateTimer = () => {
      const elapsed = Date.now() - gameStartTime;
      const remaining = Math.max(0, Math.ceil((gameDuration - elapsed) / 1000));
      setGameTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameStartTime, gameDuration, gameOver, gameEnded]);

  useEffect(() => {
    let interval: any;
    if (gameOver) {
      setTimer(10);
      interval = setInterval(() => {
        setTimer(prev => Math.max(0, prev - 1));
      }, 1000);
    } else {
      setTimer(10);
    }
    return () => clearInterval(interval);
  }, [gameOver]);

  const handleNameSubmit = useCallback(() => {
    const trimmedName = tempName.trim().slice(0, 15) || 'Player';
    setTempName(trimmedName);
    setEditingName(false);
    onNameChange?.(trimmedName);
  }, [tempName, onNameChange]);

  const handleNameKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(localPlayerName);
      setEditingName(false);
    }
  }, [handleNameSubmit, localPlayerName]);

  const renderLimbStatus = (type: LimbType, label: string) => {
    const limb = player.limbs[type];
    const percentage = Math.max(0, (limb.hp / limb.maxHp) * 100);
    const color = !limb.exists ? 'bg-red-900 opacity-50' : percentage > 50 ? 'bg-cyan-500' : 'bg-orange-500';

    return (
      <div className="mb-1.5" key={type}>
        <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400 mb-0.5">
          <span>{label}</span>
          <span>
            {`${Math.max(0, Math.round(limb.hp))}/${limb.maxHp}`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const externalLimbs = [LimbType.LEFT_ARM, LimbType.RIGHT_ARM, LimbType.LEFT_LEG, LimbType.RIGHT_LEG];
  const activeLimbCount = externalLimbs.filter(type => player.limbs[type].exists).length;
  const resistancePercent = activeLimbCount * 15;

  const getConnectionStatusText = (): string => {
    switch (connectionStatus) {
      case 'connecting': return 'Подключение...';
      case 'connected': return 'Подключено';
      case 'error': return 'Ошибка';
      default: return 'Отключено';
    }
  };

  const getConnectionStatusColor = (): string => {
    switch (connectionStatus) {
      case 'connecting': return 'text-yellow-400';
      case 'connected': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isGamePaused = isPaused || globalPaused;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
      {/* Top Center Score and Timer */}
      <div className="self-center flex flex-col items-center gap-2">
        {/* Timer and Score in one line */}
        {!gameEnded && !gameOver && (
          <div className="bg-black/40 px-6 py-2 rounded-full border border-white/10 backdrop-blur-sm flex items-center gap-4">
            <span className={`font-mono text-lg tracking-widest ${gameTimeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
              {formatTime(gameTimeLeft)}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-cyan-500 font-mono text-xl tracking-widest">{score.toString().padStart(6, '0')}</span>
          </div>
        )}

        {/* Multiplayer Connection Status */}
        {isMultiplayer && (
          <div className={`bg-black/40 border border-white/10 px-4 py-1 rounded text-[10px] uppercase font-black backdrop-blur-sm tracking-widest ${getConnectionStatusColor()}`}>
            {getConnectionStatusText()} {connectedPlayers.length > 0 && `(${connectedPlayers.length}/4)`}
          </div>
        )}
      </div>

      {/* Connected Players List (in multiplayer) */}
      {isMultiplayer && connectedPlayers.length > 0 && (
        <div className="absolute top-6 right-6 bg-black/60 border border-white/10 rounded-lg p-3 backdrop-blur-md">
          {connectedPlayers.map((p) => (
            <div key={p.id} className="flex items-center gap-2 mb-1 last:mb-0">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` }}
              />
              <span className="text-white text-xs font-mono">{p.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Left Status */}
      <div className="w-72 bg-black/60 border border-white/10 p-5 rounded-lg backdrop-blur-md">
        <h3 className="text-white text-[11px] font-black uppercase tracking-[0.2em] mb-2 border-b border-white/10 pb-1.5">Unit Vital Systems</h3>

        <div className="grid grid-cols-2 gap-x-4">
           {renderLimbStatus(LimbType.HEAD, 'Brain Matrix')}
           {renderLimbStatus(LimbType.TORSO, 'Core')}
        </div>

        <div className="mt-1.5 pt-2 border-t border-white/5">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              {renderLimbStatus(LimbType.LEFT_ARM, 'L-Manipulator')}
              {renderLimbStatus(LimbType.LEFT_LEG, 'L-Actuator')}
            </div>
            <div>
              {renderLimbStatus(LimbType.RIGHT_ARM, 'R-Manipulator')}
              {renderLimbStatus(LimbType.RIGHT_LEG, 'R-Actuator')}
            </div>
          </div>
        </div>
      </div>

      {/* Pause Overlay */}
      {isGamePaused && !gameOver && (
        <div className="absolute inset-0 bg-black/80 pointer-events-auto flex items-center justify-center backdrop-blur-xl">
          <div className="text-center p-12 border-2 border-cyan-500/30 rounded-2xl bg-black/40">
            <h1 className="text-5xl font-black text-white italic tracking-tighter mb-4">
              {globalPaused ? 'PAUSED (Host)' : 'PAUSED'}
            </h1>

            {/* Player Name Edit */}
            <div className="mb-6">
              {editingName ? (
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value.slice(0, 15))}
                    onKeyPress={handleNameKeyPress}
                    maxLength={15}
                    className="px-4 py-2 bg-black/50 border-2 border-cyan-500/50 rounded-lg text-white text-center font-mono focus:border-cyan-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleNameSubmit}
                    className="px-4 py-2 bg-cyan-500 text-black font-bold uppercase rounded hover:bg-cyan-400"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-mono underline decoration-dashed"
                >
                  {localPlayerName} ✏
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {isHost && (
                <p className="text-yellow-400 text-sm">
                  Вы хост — пауза применяется ко всем игрокам
                </p>
              )}
              {!isHost && globalPaused && (
                <p className="text-gray-400 text-sm">
                  Хост поставил игру на паузу
                </p>
              )}
              <button
                onClick={() => onBackToMenu?.()}
                className="px-10 py-4 font-bold uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-lg"
              >
                Главное меню
              </button>
            </div>

            <p className="mt-6 text-gray-400 text-sm">
              {isHost ? 'Нажмите ESC или P чтобы продолжить' : 'Ожидание продолжения хостом...'}
            </p>
          </div>
        </div>
      )}

      {/* Game End Overlay (Victory Screen) - показывается когда время вышло */}
      {gameEnded && (
        <div className="absolute inset-0 bg-black/90 pointer-events-auto flex items-center justify-center backdrop-blur-xl">
          <div className="text-center p-12 border-4 border-yellow-500/30 rounded-2xl bg-black/40 max-w-2xl">
            <h1 className="text-6xl font-black text-yellow-400 italic tracking-tighter mb-2">TIME'S UP!</h1>
            <p className="text-xl text-white/80 uppercase tracking-[0.3em] mb-8">Final Rankings</p>

            {/* Player Rankings */}
            <div className="mb-8">
              {(() => {
                // Collect all player scores
                const allScores: { name: string; score: number; isLocal: boolean; color: string }[] = [
                  { name: localPlayerName, score: score, isLocal: true, color: '#00f2ff' }
                ];

                // Add connected players (use playerScores if available, otherwise 0)
                connectedPlayers.forEach((p) => {
                  if (p.id !== localPlayerId) {
                    allScores.push({
                      name: p.name,
                      score: playerScores.get(p.id) || 0,
                      isLocal: false,
                      color: p.color
                    });
                  }
                });

                // Sort by score descending
                allScores.sort((a, b) => b.score - a.score);

                const getRankMedal = (rank: number): string => {
                  switch (rank) {
                    case 1: return '🥇';
                    case 2: return '🥈';
                    case 3: return '🥉';
                    default: return `#${rank}`;
                  }
                };

                return allScores.map((p, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-6 py-3 mb-2 rounded-lg ${
                      p.isLocal ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{getRankMedal(idx + 1)}</span>
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }}
                      />
                      <span className={`text-lg font-bold ${p.isLocal ? 'text-cyan-400' : 'text-white'}`}>
                        {p.name}
                        {p.isLocal && <span className="text-xs text-cyan-500 ml-2">(YOU)</span>}
                      </span>
                    </div>
                    <span className="text-xl font-mono text-yellow-400">
                      {p.score.toString().padStart(6, '0')}
                    </span>
                  </div>
                ));
              })()}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={onNewGame}
                className="px-12 py-5 font-bold uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.5)] bg-cyan-500 text-black hover:bg-white"
              >
                Play Again
              </button>

              <button
                onClick={() => onBackToMenu?.()}
                className="px-12 py-5 font-bold uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-lg"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay - только если игра НЕ закончена по таймеру */}
      {gameOver && !gameEnded && (
        <div className="absolute inset-0 bg-red-950/85 pointer-events-auto flex items-center justify-center backdrop-blur-xl">
          <div className="text-center p-12 border-4 border-red-500/30 rounded-2xl bg-black/40">
            <h1 className="text-7xl font-black text-white italic tracking-tighter mb-2 animate-pulse">UNIT DESTROYED</h1>
            <p className="text-xl text-red-400 uppercase tracking-[0.3em] mb-10">Critical Component Failure</p>

            {timer > 0 ? (
              <div className="text-cyan-400 font-mono text-2xl tracking-[0.5em] mb-4">
                RE-INITIALIZING IN: {timer}s
              </div>
            ) : null}

            <div className="flex gap-4 justify-center">
              <button
                disabled={timer > 0}
                onClick={onRespawn}
                className={`px-12 py-5 font-bold uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.5)] ${
                  timer > 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-cyan-500 text-black hover:bg-white'
                }`}
              >
                System Re-Initialize
              </button>

              <button
                onClick={() => onBackToMenu?.()}
                className="px-12 py-5 font-bold uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-lg"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HUD;
