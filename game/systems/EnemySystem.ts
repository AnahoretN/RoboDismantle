import { Enemy } from '../../types';
import {
  ENEMY_BASE_HP,
  ENEMY_MIN_FIRE_RATE,
  ENEMY_FIRE_RATE_VARIANCE,
  ENEMY_WIDTH,
  ENEMY_HEIGHT,
  ENEMY_SPAWN_MARGIN
} from '../../constants';

/**
 * Создаёт нового врага
 */
export const createEnemy = (x: number, y: number): Enemy => ({
  x,
  y,
  width: ENEMY_WIDTH,
  height: ENEMY_HEIGHT,
  vx: 0,
  vy: 0,
  hp: ENEMY_BASE_HP,
  type: 'DRONE',
  lastFired: 0,
  fireRate: ENEMY_MIN_FIRE_RATE + Math.random() * ENEMY_FIRE_RATE_VARIANCE
});

/**
 * Проверяет, может ли враг стрелять
 */
export const canEnemyFire = (enemy: Enemy, currentTime: number): boolean => {
  return currentTime - enemy.lastFired >= enemy.fireRate;
};

/**
 * Обновляет время последнего выстрела врага
 */
export const updateEnemyFireTime = (enemy: Enemy, currentTime: number): void => {
  enemy.lastFired = currentTime;
};

/**
 * Вычисляет позицию спавна врага за пределами экрана
 */
export const computeEnemySpawnPosition = (
  cameraX: number,
  cameraY: number,
  screenWidth: number,
  screenHeight: number,
  margin: number = ENEMY_SPAWN_MARGIN
): { x: number; y: number } => {
  const side = Math.floor(Math.random() * 3);
  let spawnX = 0, spawnY = 0;

  if (side === 0) {
    spawnX = cameraX - margin;
    spawnY = cameraY + Math.random() * screenHeight;
  } else if (side === 1) {
    spawnX = cameraX + screenWidth + margin;
    spawnY = cameraY + Math.random() * screenHeight;
  } else {
    spawnX = cameraX + Math.random() * screenWidth;
    spawnY = cameraY - margin;
  }

  return { x: spawnX, y: spawnY };
};

/**
 * Вычисляет максимальное количество врагов на основе очков
 */
export const computeMaxEnemies = (
  avgScore: number,
  isMultiplayer: boolean
): number => {
  if (isMultiplayer) {
    return 3 + Math.floor(avgScore / 3000);
  }
  return 5 + Math.floor(avgScore / 2000);
};

/**
 * Проверяет, жив ли враг
 */
export const isEnemyAlive = (enemy: Enemy): boolean => {
  return enemy.hp > 0;
};

/**
 * Наносит урон врагу
 */
export const damageEnemy = (enemy: Enemy, damage: number): void => {
  enemy.hp -= damage;
};
