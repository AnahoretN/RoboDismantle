import { Robot, LimbType, Limb } from '../../types';
import {
  ROBOT_SIZE,
  ARM_MAX_HP,
  LEG_MAX_HP,
  TORSO_MAX_HP,
  HEAD_MAX_HP,
  COLORS
} from '../../constants';

/**
 * Создаёт дефолтное состояние конечности
 */
export const createLimb = (type: LimbType, hp: number, maxHp: number): Limb => ({
  type,
  hp,
  maxHp,
  exists: true,
  damageMultiplier: 1.0,
  damageFlashTimer: 0
});

/**
 * Создаёт дефолтного игрока с заданными параметрами
 */
export const createDefaultPlayer = (x: number = 100, y: number = 300): Robot => ({
  x,
  y,
  width: ROBOT_SIZE,
  height: ROBOT_SIZE * 1.5,
  vx: 0,
  vy: 0,
  facing: 0,
  isJumping: false,
  onGround: false,
  stunTimer: 0,
  moveStartTime: undefined,
  lastMoveDir: 0,
  limbs: {
    [LimbType.TORSO]: createLimb(LimbType.TORSO, TORSO_MAX_HP, TORSO_MAX_HP),
    [LimbType.HEAD]: createLimb(LimbType.HEAD, HEAD_MAX_HP, HEAD_MAX_HP),
    [LimbType.LEFT_ARM]: createLimb(LimbType.LEFT_ARM, ARM_MAX_HP, ARM_MAX_HP),
    [LimbType.RIGHT_ARM]: createLimb(LimbType.RIGHT_ARM, ARM_MAX_HP, ARM_MAX_HP),
    [LimbType.LEFT_LEG]: createLimb(LimbType.LEFT_LEG, LEG_MAX_HP, LEG_MAX_HP),
    [LimbType.RIGHT_LEG]: createLimb(LimbType.RIGHT_LEG, LEG_MAX_HP, LEG_MAX_HP),
  },
  leftWeapon: { name: 'Plasma', type: 'PROJECTILE', cooldown: 200, lastFired: 0, color: COLORS.ARM },
  rightWeapon: { name: 'Laser', type: 'PROJECTILE', cooldown: 150, lastFired: 0, color: COLORS.ARM },
});

/**
 * Создаёт дефолтные конечности (для сброса)
 */
export const createDefaultLimbs = (): Record<LimbType, Limb> => ({
  [LimbType.TORSO]: createLimb(LimbType.TORSO, TORSO_MAX_HP, TORSO_MAX_HP),
  [LimbType.HEAD]: createLimb(LimbType.HEAD, HEAD_MAX_HP, HEAD_MAX_HP),
  [LimbType.LEFT_ARM]: createLimb(LimbType.LEFT_ARM, ARM_MAX_HP, ARM_MAX_HP),
  [LimbType.RIGHT_ARM]: createLimb(LimbType.RIGHT_ARM, ARM_MAX_HP, ARM_MAX_HP),
  [LimbType.LEFT_LEG]: createLimb(LimbType.LEFT_LEG, LEG_MAX_HP, LEG_MAX_HP),
  [LimbType.RIGHT_LEG]: createLimb(LimbType.RIGHT_LEG, LEG_MAX_HP, LEG_MAX_HP),
});
