import { Projectile } from '../../types';
import {
  BULLET_SPEED,
  PROJECTILE_WIDTH,
  PROJECTILE_HEIGHT,
  PROJECTILE_DAMAGE_PLAYER,
  PROJECTILE_DAMAGE_ENEMY
} from '../../constants';

/**
 * Создаёт снаряд
 */
export const createProjectile = (
  x: number,
  y: number,
  angle: number,
  owner: 'PLAYER' | 'ENEMY',
  color: string,
  ownerId?: string
): Projectile => {
  const vx = Math.cos(angle) * BULLET_SPEED;
  const vy = Math.sin(angle) * BULLET_SPEED;
  const damage = owner === 'PLAYER' ? PROJECTILE_DAMAGE_ENEMY : PROJECTILE_DAMAGE_PLAYER;

  return {
    x,
    y,
    vx,
    vy,
    width: PROJECTILE_WIDTH,
    height: PROJECTILE_HEIGHT,
    owner,
    ownerId,
    damage,
    color
  };
};

/**
 * Обновляет позицию снаряда
 */
export const updateProjectile = (
  proj: Projectile,
  deltaMultiplier: number = 1
): void => {
  proj.x += proj.vx * deltaMultiplier;
  proj.y += proj.vy * deltaMultiplier;
};

/**
 * Проверяет, вылетел ли снаряд за пределы карты
 */
export const isProjectileOutOfBounds = (
  proj: Projectile,
  maxY: number = 2000
): boolean => {
  return proj.y > maxY;
};

/**
 * Создаёт снаряд для игрока
 */
export const createPlayerProjectile = (
  x: number,
  y: number,
  angle: number,
  color: string,
  ownerId?: string
): Projectile => createProjectile(x, y, angle, 'PLAYER', color, ownerId);

/**
 * Создаёт снаряд для врага
 */
export const createEnemyProjectile = (
  x: number,
  y: number,
  targetX: number,
  targetY: number
): Projectile => {
  const angle = Math.atan2(targetY - y, targetX - x);
  return createProjectile(x, y, angle, 'ENEMY', '#ff0055');
};

/**
 * Проверяет коллизию снаряда с прямоугольником
 */
export const checkProjectileRectCollision = (
  proj: Projectile,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean => {
  return proj.x < rx + rw &&
         proj.x + proj.width > rx &&
         proj.y < ry + rh &&
         proj.y + proj.height > ry;
};
