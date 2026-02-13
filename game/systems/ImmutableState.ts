import { GameState, Robot, Enemy, Projectile, ImpactVFX, DetachedLimb } from '../../types';

/**
 * Утилиты для иммутабельного обновления состояния
 * Позволяют отслеживать изменения и избегать побочных эффектов
 */

/**
 * Безопасно обновляет поле объекта
 */
export const setField = <T extends object, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K]
): T => ({
  ...obj,
  [key]: value
});

/**
 * Безопасно обновляет несколько полей объекта
 */
export const setFields = <T extends object>(
  obj: T,
  updates: Partial<T>
): T => ({
  ...obj,
  ...updates
});

/**
 * Создаёт нового игрока с обновлёнными полями
 */
export const updatePlayer = (player: Robot, updates: Partial<Robot>): Robot => {
  return {
    ...player,
    ...updates
  };
};

/**
 * Обновляет HP конечности
 */
export const updateLimbHP = (
  limbs: Record<string, any>,
  limbType: string,
  newHP: number
): Record<string, any> => ({
  ...limbs,
  [limbType]: {
    ...limbs[limbType],
    hp: newHP
  }
});

/**
 * Обновляет существование конечности
 */
export const updateLimbExists = (
  limbs: Record<string, any>,
  limbType: string,
  exists: boolean
): Record<string, any> => ({
  ...limbs,
  [limbType]: {
    ...limbs[limbType],
    exists
  }
});

/**
 * Добавляет элемент в массив (иммутабельно)
 */
export const addToArray = <T>(array: T[], item: T): T[] => [...array, item];

/**
 * Удаляет элемент из массива по индексу (иммутабельно)
 */
export const removeFromArrayByIndex = <T>(array: T[], index: number): T[] => [
  ...array.slice(0, index),
  ...array.slice(index + 1)
];

/**
 * Удаляет элементы из массива по условию (иммутабельно)
 */
export const removeFromArrayWhere = <T>(
  array: T[],
  predicate: (item: T, index: number) => boolean
): T[] => {
  const index = array.findLastIndex(predicate);
  if (index === -1) return array;
  return removeFromArrayByIndex(array, index);
};

/**
 * Фильтрует массив (иммутабельно)
 */
export const filterArray = <T>(
  array: T[],
  predicate: (item: T, index: number) => boolean
): T[] => array.filter(predicate);

/**
 * Обновляет счёт (иммутабельно)
 */
export const updateScore = (currentScore: number, delta: number): number => currentScore + delta;

/**
 * Создаёт новое состояние игры с обновлениями
 */
export const createGameStateUpdate = (
  state: GameState,
  updates: Partial<GameState>
): GameState => ({
  ...state,
  ...updates
});

/**
 * Патчит состояние игрока при получении урона
 */
export const applyDamageToPlayer = (
  player: Robot,
  limbType: string,
  damage: number,
  damageFlashDuration: number = 10
): Robot => {
  const newLimbs = { ...player.limbs };
  if (newLimbs[limbType]) {
    newLimbs[limbType] = {
      ...newLimbs[limbType],
      hp: Math.max(0, newLimbs[limbType].hp - damage),
      damageFlashTimer: damageFlashDuration
    };
  }

  return {
    ...player,
    limbs: newLimbs
  };
};

/**
 * Перемещает объект (для камеры и т.д.)
 */
export const moveObject = <T extends { x: number; y: number }>(
  obj: T,
  dx: number,
  dy: number
): T => ({
    ...obj,
    x: obj.x + dx,
    y: obj.y + dy
});

/**
 * Создаёт снаряд (иммутабельно)
 */
export const createProjectile = (
  x: number,
  y: number,
  vx: number,
  vy: number,
  owner: 'PLAYER' | 'ENEMY',
  damage: number,
  color: string
): Projectile => ({
  x,
  y,
  vx,
  vy,
  width: 8,
  height: 8,
  owner,
  damage,
  color
});

/**
 * Создаёт VFX эффект (иммутабельно)
 */
export const createVFX = (
  x: number,
  y: number,
  color: string,
  size: number
): ImpactVFX => ({
  x,
  y,
  life: size,
  maxLife: size,
  color,
  size
});
