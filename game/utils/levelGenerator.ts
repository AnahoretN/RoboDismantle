import { Platform } from '../../types';
import {
  PLATFORM_GAP,
  PLATFORM_Y_START,
  PLATFORM_Y_STEP,
  PLATFORM_HEIGHT,
  PLATFORM_MIN_WIDTH,
  PLATFORM_MAX_WIDTH,
  ROBOT_SIZE
} from '../../constants';

/**
 * Конфигурация для генерации уровня
 */
export interface LevelConfig {
  platformCount: number;
  scaleFactor: number;  // Для масштабирования платформ выше
  groundWidth: number;
}

/**
 * Базовая конфигурация уровня
 */
export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  platformCount: 17,
  scaleFactor: 0.9,
  groundWidth: 3000
};

/**
 * Генерирует базовые платформы уровня
 */
export const generateBasePlatforms = (config: LevelConfig = DEFAULT_LEVEL_CONFIG): Platform[] => {
  const platforms: Platform[] = [];

  // Земля (нижняя большая платформа)
  platforms.push({
    x: -500,
    y: 500,
    width: config.groundWidth,
    height: 60
  });

  // Платформы по возрастающей Y
  const platformData = [
    { x: 300, y: 400, width: 250 },
    { x: 700, y: 320, width: 250 },
    { x: 150, y: 220, width: 200 },
    { x: 1000, y: 420, width: 300 },
    { x: 400, y: 100, width: 200 },
    { x: 800, y: 0, width: 250 },
    { x: 1200, y: -80, width: 200 },
    { x: 1500, y: -200, width: 300 },
    { x: 1100, y: -350, width: 200 },
    { x: 700, y: -450, width: 250 },
    { x: 300, y: -600, width: 200 },
    { x: 0, y: -750, width: 250 },
    { x: 400, y: -900, width: 300 },
    { x: 900, y: -1050, width: 200 },
    { x: 1300, y: -1200, width: 250 },
    { x: 1000, y: -1400, width: 150 },
    { x: 600, y: -1550, width: 150 },
    { x: 200, y: -1700, width: 150 },
    { x: 500, y: -1900, width: 400 },
    { x: 1000, y: -2100, width: 200 },
    { x: 1400, y: -2300, width: 250 },
    { x: 800, y: -2500, width: 500 }
  ];

  platformData.forEach((plat, index) => {
    const height = PLATFORM_HEIGHT;

    // Применяем scale для платформ выше y=500
    if (plat.y < 500) {
      platforms.push({
        x: plat.x * config.scaleFactor,
        y: plat.y * config.scaleFactor,
        width: plat.width,
        height
      });
    } else {
      platforms.push({
        x: plat.x,
        y: plat.y,
        width: plat.width,
        height
      });
    }
  });

  return platforms;
};

/**
 * Находит самую высокую платформу
 */
export const findTopPlatform = (platforms: Platform[]): Platform => {
  return platforms.reduce((top, plat) =>
    plat.y < top.y ? plat : top
  );
};

/**
 * Генерирует случайную позицию для спавна игрока
 */
export const getRandomSpawnPosition = (platforms: Platform[]): { x: number; y: number } => {
  const ground = platforms[0];
  return {
    x: ground.x + 100 + Math.random() * (ground.width - 200),
    y: ground.y - 100
  };
};

/**
 * Создаёт звёзду в верхней части карты
 */
export const createStar = (platforms: Platform[]): { x: number; y: number } => {
  const topPlatform = findTopPlatform(platforms);
  return {
    x: topPlatform.x + topPlatform.width / 2 - 10,
    y: topPlatform.y - 30
  };
};
