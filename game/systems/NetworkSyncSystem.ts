import { Robot, Limb } from '../../types';
import { NETWORK_UPDATE_RATE } from '../../constants';

/**
 * Сжатое состояние лимба (только изменившиеся поля)
 */
export interface CompressedLimb {
  hp?: number;
  exists?: boolean;
}

/**
 * Полное состояние лимба для сравнения
 */
interface FullLimbState {
  hp: number;
  exists: boolean;
}

/**
 * Сжатое состояние игрока (только изменения)
 */
export interface CompressedPlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing?: number;
  onGround?: boolean;
  limbs?: Record<string, CompressedLimb>;
  score?: number;
}

/**
 * Хранит предыдущее состояние для вычисления дельт
 */
interface PreviousState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  limbs: Record<string, FullLimbState>;
}

/**
 * Создаёт начальное предыдущее состояние
 */
export const createPreviousState = (player: Robot, score: number = 0): PreviousState => ({
  x: player.x,
  y: player.y,
  vx: player.vx,
  vy: player.vy,
  facing: player.facing,
  onGround: player.onGround,
  limbs: Object.fromEntries(
    Object.entries(player.limbs).map(([key, limb]: [string, Limb]) => [
      key,
      { hp: limb.hp, exists: limb.exists }
    ])
  )
});

/**
 * Вычисляет дельту (только изменившиеся поля)
 * Это существенно уменьшает размер сетевых пакетов
 */
export const computeDelta = (
  player: Robot,
  prev: PreviousState,
  currentScore: number
): CompressedPlayerState => {
  const delta: CompressedPlayerState = {
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy
  };

  // Добавляем только изменившиеся поля
  if (player.facing !== prev.facing) {
    delta.facing = player.facing;
  }
  if (player.onGround !== prev.onGround) {
    delta.onGround = player.onGround;
  }

  // Проверяем конечности
  const limbsDelta: Record<string, CompressedLimb> = {};
  let hasLimbChanges = false;

  Object.entries(player.limbs).forEach(([key, limb]: [string, Limb]) => {
    const prevLimb = prev.limbs[key];
    if (!prevLimb) return;

    const limbDelta: CompressedLimb = {};
    if (limb.hp !== prevLimb.hp) {
      limbDelta.hp = limb.hp;
      hasLimbChanges = true;
    }
    if (limb.exists !== prevLimb.exists) {
      limbDelta.exists = limb.exists;
      hasLimbChanges = true;
    }

    if (Object.keys(limbDelta).length > 0) {
      limbsDelta[key] = limbDelta;
    }
  });

  if (hasLimbChanges) {
    delta.limbs = limbsDelta;
  }

  return delta;
};

/**
 * Обновляет предыдущее состояние
 */
export const updatePreviousState = (
  prev: PreviousState,
  player: Robot
): PreviousState => ({
  ...prev,
  x: player.x,
  y: player.y,
  vx: player.vx,
  vy: player.vy,
  facing: player.facing,
  onGround: player.onGround,
  limbs: Object.fromEntries(
    Object.entries(player.limbs).map(([key, limb]: [string, Limb]) => [
      key,
      { hp: limb.hp, exists: limb.exists }
    ])
  )
});

/**
 * Система для управления частотой сетевых обновлений
 */
export class NetworkThrottle {
  private lastUpdateTime: number = 0;
  private accumulatedTime: number = 0;
  private updateRate: number;

  constructor(updateRate: number = NETWORK_UPDATE_RATE) {
    this.updateRate = updateRate;
  }

  /**
   * Проверяет, пришло ли время для следующего обновления
   * @param currentTime Текущее время (Date.now())
   * @param deltaTime Время прошедшее с последнего вызова
   */
  shouldUpdate(currentTime: number, deltaTime: number): boolean {
    this.accumulatedTime += deltaTime;

    if (this.accumulatedTime >= this.updateRate) {
      this.accumulatedTime -= this.updateRate;
      this.lastUpdateTime = currentTime;
      return true;
    }
    return false;
  }

  /**
   * Сбрасывает таймер
   */
  reset(): void {
    this.lastUpdateTime = 0;
    this.accumulatedTime = 0;
  }

  /**
   * Устанавливает частоту обновлений
   */
  setUpdateRate(rate: number): void {
    this.updateRate = rate;
  }
}
