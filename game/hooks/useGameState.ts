import { useRef, useCallback } from 'react';
import { GameState } from '../../types';
import { createDefaultPlayer } from '../utils/playerFactory';

/**
 * Хук для управления игровым состоянием
 * Позволяет избежать повторного создания дефолтных значений
 */
export const useGameState = (platforms: any[], star: any) => {
  const stateRef = useRef<GameState>({
    player: createDefaultPlayer(100, 300),
    enemies: [],
    projectiles: [],
    platforms,
    vfx: [],
    camera: { x: 0, y: 0 },
    score: 0,
    gameOver: false,
    detachedLimbs: [],
    star,
    gameStartTime: Date.now(),
    gameDuration: 300000, // 5 minutes
    gameEnded: false
  });

  /**
   * Сбрасывает состояние игрока (для респавна)
   */
  const resetPlayer = useCallback((preserveStats: boolean = false) => {
    const s = stateRef.current;
    const newPlayer = createDefaultPlayer(100, 300);

    if (preserveStats) {
      // Сохраняем очки, таймер и звезду
      stateRef.current.player = newPlayer;
    } else {
      // Полный сброс
      stateRef.current.player = newPlayer;
      stateRef.current.score = 0;
      stateRef.current.gameStartTime = Date.now();
      stateRef.current.gameEnded = false;
    }
  }, []);

  /**
   * Полный сброс игры
   */
  const resetGame = useCallback(() => {
    const s = stateRef.current;
    stateRef.current.player = createDefaultPlayer(100, 300);
    stateRef.current.enemies = [];
    stateRef.current.projectiles = [];
    stateRef.current.vfx = [];
    stateRef.current.detachedLimbs = [];
    stateRef.current.score = 0;
    stateRef.current.gameOver = false;
    stateRef.current.gameStartTime = Date.now();
    stateRef.current.gameEnded = false;
  }, []);

  return {
    state: stateRef,
    resetPlayer,
    resetGame
  };
};
