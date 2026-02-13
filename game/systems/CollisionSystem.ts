import { Robot, LimbType } from '../../types';
import { Platform } from '../../types';
import {
  ARM_OFFSET_Y,
  ARM_HEIGHT,
  ARM_WIDTH,
  LEG_OFFSET_Y,
  LEG_HEIGHT,
  LEG_WIDTH,
  TORSO_OFFSET_Y,
  TORSO_HEIGHT,
  TORSO_WIDTH,
  HEAD_OFFSET_Y,
  HEAD_SIZE
} from '../../constants';

/**
 * Проверка пересечения двух прямоугольников
 */
export const rectIntersect = (
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean => {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
};

/**
 * Получает хитбокс для конкретной части тела робота
 */
export const getLimbHitbox = (
  robot: Robot,
  limbType: LimbType
): { x: number; y: number; width: number; height: number } => {
  const centerX = robot.x + robot.width / 2;
  const centerY = robot.y + robot.height / 2;

  switch (limbType) {
    case LimbType.LEFT_ARM:
      return {
        x: centerX - 35,
        y: centerY + ARM_OFFSET_Y - ARM_HEIGHT / 2,
        width: ARM_WIDTH,
        height: ARM_HEIGHT
      };
    case LimbType.RIGHT_ARM:
      return {
        x: centerX + 7,
        y: centerY + ARM_OFFSET_Y - ARM_HEIGHT / 2,
        width: ARM_WIDTH,
        height: ARM_HEIGHT
      };
    case LimbType.LEFT_LEG:
      return {
        x: centerX - 25,
        y: centerY + LEG_OFFSET_Y - LEG_HEIGHT / 2,
        width: LEG_WIDTH,
        height: LEG_HEIGHT
      };
    case LimbType.RIGHT_LEG:
      return {
        x: centerX + 5,
        y: centerY + LEG_OFFSET_Y - LEG_HEIGHT / 2,
        width: LEG_WIDTH,
        height: LEG_HEIGHT
      };
    case LimbType.TORSO:
      return {
        x: centerX - TORSO_WIDTH / 2,
        y: centerY + TORSO_OFFSET_Y - TORSO_HEIGHT / 2,
        width: TORSO_WIDTH,
        height: TORSO_HEIGHT
      };
    case LimbType.HEAD:
      return {
        x: centerX - HEAD_SIZE / 2,
        y: centerY + HEAD_OFFSET_Y - HEAD_SIZE / 2,
        width: HEAD_SIZE,
        height: HEAD_SIZE
      };
    default:
      return { x: robot.x, y: robot.y, width: robot.width, height: robot.height };
  }
};

/**
 * Проверяет попадание в конечность робота
 * @param robot Робот для проверки
 * @param x X координата снаряда/точки
 * @param y Y координата снаряда/точки
 * @returns Тип конечности или null
 */
export const checkLimbHit = (
  robot: Robot,
  x: number,
  y: number
): LimbType | null => {
  // Проверяем каждую конечность по очереди (от конечностей к торсу/голове)
  const limbOrder: LimbType[] = [
    LimbType.LEFT_ARM,
    LimbType.RIGHT_ARM,
    LimbType.LEFT_LEG,
    LimbType.RIGHT_LEG,
    LimbType.TORSO,
    LimbType.HEAD
  ];

  for (const limbType of limbOrder) {
    const limb = robot.limbs[limbType];
    if (!limb.exists) continue; // Пропускаем оторванные конечности

    const hitbox = getLimbHitbox(robot, limbType);
    if (x >= hitbox.x && x <= hitbox.x + hitbox.width &&
        y >= hitbox.y && y <= hitbox.y + hitbox.height) {
      return limbType;
    }
  }

  return null;
};

/**
 * Проверяет коллизию игрока с платформами
 * @param player Игрок
 * @param platforms Массив платформ
 * @param noLegs Есть ли ноги у игрока
 */
export const checkPlatformCollisions = (
  player: Robot,
  platforms: Platform[],
  noLegs: boolean
): void => {
  player.onGround = false;

  // Когда нет ног, используем нижнюю часть туловища для коллизии
  const feetY = noLegs ? player.y + player.height * 0.6 : player.y + player.height;

  platforms.forEach((plat) => {
    // Горизонтальная коллизия с платформой
    if (player.x + player.width > plat.x && player.x < plat.x + plat.width) {
      // Вертикальная коллизия - приземление
      if (player.y + player.height >= plat.y &&
          player.y + player.height <= plat.y + plat.height + 10 && // +10 для tolerance
          player.vy >= 0) { // Падаем вниз
        player.y = plat.y - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }
  });
};

/**
 * Проверяет коллизию двух прямоугольников (для снарядов, врагов и т.д.)
 */
export const checkCollision = (
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean => {
  return rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2);
};
