import { ImpactVFX } from '../../types';
import {
  VFX_HIT_SIZE,
  VFX_DESTROY_SIZE,
  VFX_LIMB_SIZE,
  VFX_PICKUP_SIZE,
  VFX_ENEMY_DEATH_SIZE
} from '../../constants';

/**
 * Создаёт эффект попадания
 */
export const spawnHitVFX = (
  vfxArray: ImpactVFX[],
  x: number,
  y: number,
  color: string
): void => {
  vfxArray.push({
    x,
    y,
    life: VFX_HIT_SIZE,
    maxLife: VFX_HIT_SIZE,
    color,
    size: VFX_HIT_SIZE
  });
};

/**
 * Создаёт эффект уничтожения
 */
export const spawnDestroyVFX = (
  vfxArray: ImpactVFX[],
  x: number,
  y: number,
  color: string
): void => {
  vfxArray.push({
    x,
    y,
    life: VFX_DESTROY_SIZE,
    maxLife: VFX_DESTROY_SIZE,
    color,
    size: VFX_DESTROY_SIZE
  });
};

/**
 * Создаёт эффект подбора конечности
 */
export const spawnPickupVFX = (
  vfxArray: ImpactVFX[],
  x: number,
  y: number
): void => {
  vfxArray.push({
    x,
    y,
    life: VFX_PICKUP_SIZE,
    maxLife: VFX_PICKUP_SIZE,
    color: '#ffffff',
    size: VFX_PICKUP_SIZE
  });
};

/**
 * Создаёт эффект смерти врага
 */
export const spawnEnemyDeathVFX = (
  vfxArray: ImpactVFX[],
  x: number,
  y: number
): void => {
  vfxArray.push({
    x,
    y,
    life: VFX_ENEMY_DEATH_SIZE,
    maxLife: VFX_ENEMY_DEATH_SIZE,
    color: '#ff0055',
    size: VFX_ENEMY_DEATH_SIZE
  });
};

/**
 * Обновляет все VFX эффекты
 * @param vfxArray Массив эффектов
 * @param deltaMultiplier Множитель delta time
 * @returns Массив обновлённых эффектов (без удалённых)
 */
export const updateVFX = (
  vfxArray: ImpactVFX[],
  deltaMultiplier: number = 1
): ImpactVFX[] => {
  return vfxArray.filter(vfx => {
    vfx.life -= 1 * deltaMultiplier;
    return vfx.life > 0;
  });
};
