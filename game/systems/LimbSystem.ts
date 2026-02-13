import { Robot, LimbType, DetachedLimb } from '../../types';
import {
  DETACHED_LIMB_ARM_WIDTH,
  DETACHED_LIMB_ARM_HEIGHT,
  DETACHED_LIMB_LEG_WIDTH,
  DETACHED_LIMB_LEG_HEIGHT,
  DETACHED_LIMB_VX,
  DETACHED_LIMB_VY_BASE,
  DETACHED_LIMB_VY_VARIANCE,
  DETACHED_LIMB_ROTATION_SPEED,
  LIMB_DESTROY_TIME,
  ARM_MAX_HP,
  LEG_MAX_HP,
  TORSO_MAX_HP,
  HEAD_MAX_HP,
  COLORS
} from '../../constants';

/**
 * Создаёт оторванную конечность
 */
export const createDetachedLimb = (
  limbType: LimbType,
  robot: Robot,
  owner: 'PLAYER' | 'REMOTE_PLAYER',
  ownerId?: string,
  destroyed: boolean = false
): DetachedLimb => {
  const centerX = robot.x + robot.width / 2;
  const centerY = robot.y + robot.height / 2 - 5;
  const limb = robot.limbs[limbType];

  const isArm = limbType.includes('ARM');
  const width = isArm ? DETACHED_LIMB_ARM_WIDTH : DETACHED_LIMB_LEG_WIDTH;
  const height = isArm ? DETACHED_LIMB_ARM_HEIGHT : DETACHED_LIMB_LEG_HEIGHT;
  const color = isArm ? COLORS.ARM : COLORS.LEG;

  const detached: DetachedLimb = {
    limbType,
    x: centerX,
    y: centerY - 10,
    vx: (Math.random() - 0.5) * DETACHED_LIMB_VX,
    vy: -DETACHED_LIMB_VY_BASE - Math.random() * DETACHED_LIMB_VY_VARIANCE,
    width,
    height,
    color,
    rotation: 0,
    rotationSpeed: (Math.random() - 0.5) * DETACHED_LIMB_ROTATION_SPEED,
    owner,
    ownerId,
    hp: Math.max(0, limb.hp),
    maxHp: limb.maxHp,
    destroyed,
    destroyTime: destroyed ? Date.now() + LIMB_DESTROY_TIME : undefined
  };

  return detached;
};

/**
 * Обновляет физику оторванной конечности
 */
export const updateDetachedLimb = (
  limb: DetachedLimb,
  deltaMultiplier: number = 1
): DetachedLimb => {
  return {
    ...limb,
    x: limb.x + limb.vx * deltaMultiplier,
    y: limb.y + limb.vy * deltaMultiplier,
    rotation: limb.rotation + limb.rotationSpeed * deltaMultiplier
  };
};

/**
 * Проверяет, должна ли конечность исчезнуть
 */
export const shouldLimbDisappear = (limb: DetachedLimb): boolean => {
  return limb.destroyed && limb.destroyTime !== undefined && Date.now() >= limb.destroyTime;
};

/**
 * Проверяет, может ли игрок подобрать конечность
 */
export const canPickupLimb = (
  limb: DetachedLimb,
  playerX: number,
  playerY: number,
  pickupDistance: number
): boolean => {
  if (limb.destroyed) return false;

  const limbCenterX = limb.x + limb.width / 2;
  const limbCenterY = limb.y + limb.height / 2;
  const playerCenterX = playerX + 40; // ROBOT_SIZE / 2
  const playerCenterY = playerY + 60; // ROBOT_SIZE * 1.5 / 2

  const dist = Math.sqrt(
    (playerCenterX - limbCenterX) ** 2 +
    (playerCenterY - limbCenterY) ** 2
  );

  return dist < pickupDistance;
};

/**
 * Получает цвет конечности по типу
 */
export const getLimbColor = (limbType: LimbType): string => {
  return limbType.includes('ARM') ? COLORS.ARM : COLORS.LEG;
};

/**
 * Получает максимальное HP конечности
 */
export const getLimbMaxHp = (limbType: LimbType): number => {
  switch (limbType) {
    case LimbType.TORSO:
      return TORSO_MAX_HP;
    case LimbType.HEAD:
      return HEAD_MAX_HP;
    case LimbType.LEFT_ARM:
    case LimbType.RIGHT_ARM:
      return ARM_MAX_HP;
    case LimbType.LEFT_LEG:
    case LimbType.RIGHT_LEG:
      return LEG_MAX_HP;
  }
};

/**
 * Проверяет, критическое ли повреждение (торс/голова)
 */
export const isCriticalHit = (limbType: LimbType): boolean => {
  return limbType === LimbType.TORSO || limbType === LimbType.HEAD;
};

/**
 * Вычисляет шанс отрыва конечности
 */
export const shouldDetachLimb = (
  currentHp: number,
  damage: number,
  detachChance: number
): boolean => {
  const newHp = currentHp - damage;
  return newHp > 0 && Math.random() < detachChance;
};
