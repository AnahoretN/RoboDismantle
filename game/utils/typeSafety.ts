import { Limb, LimbType } from '../../types';

/**
 * Утилиты для улучшения типобезопасности
 * Заменяют использование 'any' на правильные типы
 */

/**
 * Безопасно получает limb из Record<LimbType, Limb>
 */
export const getLimb = (
  limbs: Record<LimbType, Limb>,
  limbType: LimbType
): Limb | undefined => {
  return limbs[limbType];
};

/**
 * Безопасно устанавливает limb в Record
 */
export const setLimb = (
  limbs: Record<LimbType, Limb>,
  limbType: LimbType,
  limb: Limb
): Record<LimbType, Limb> => {
  return {
    ...limbs,
    [limbType]: limb
  };
};

/**
 * Типобезопасный Object.entries для limb record
 */
export const getLimbEntries = (
  limbs: Record<LimbType, Limb>
): Array<[LimbType, Limb]> => {
  return Object.entries(limbs) as Array<[LimbType, Limb]>;
};

/**
 * Проверяет, является ли значение валидным LimbType
 */
export const isValidLimbType = (value: string): value is LimbType => {
  return Object.values(LimbType).includes(value as LimbType);
};

/**
 * Создаёт типобезопасную функцию проверки limb
 */
export const createLimbChecker = () => {
  const cache = new Set<string>();

  return (limbType: string): boolean => {
    if (cache.has(limbType)) return false;
    cache.add(limbType);
    return isValidLimbType(limbType);
  };
};
