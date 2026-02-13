export const GRAVITY = 0.6;
export const FRICTION = 0.8;
export const PLAYER_SPEED = 10; // Увеличена на 25% (было 8)
export const PLAYER_JUMP = -17.5; // Увеличен на 25% (было -14)
export const ACCELERATION_TIME = 1000; // Время (мс) для набора полной скорости (1 секунда)
export const ROBOT_SIZE = 40;
export const BULLET_SPEED = 24;

export const ARM_MAX_HP = 50;
export const LEG_MAX_HP = 75;
export const TORSO_MAX_HP = 100;
export const HEAD_MAX_HP = 50;

// Физические константы
export const ACCELERATION_FACTOR = 0.2; // Коэффициент ускорения движения
export const STUN_JUMP_MULTIPLIER = 0.8; // Множитель прыжка при оглушении
export const STUN_SPEED_MULTIPLIER = 0.5; // Множитель скорости при оглушении
export const CROUCH_SPEED_MULTIPLIER = 0.4; // Множитель скорости при приседании
export const ONE_LEG_SPEED_MULTIPLIER = 0.5; // Множитель скорости с одной ногой
export const NO_LEGS_SPEED_MULTIPLIER = 0.15; // Множитель скорости без ног
export const NO_LEGS_HOP_CHANCE = 0.1; // Шанс подпрыгивания без ног
export const NO_LEGS_HOP_VELOCITY = -6; // Скорость подпрыгивания без ног
export const NO_LEGS_HOP_THRESHOLD = 0.3; // Порог скорости для подпрыгивания

// Управление огнём
export const FIRE_COOLDOWN_LEFT = 200; // мс
export const FIRE_COOLDOWN_RIGHT = 150; // мс
export const FIRE_COOLDOWN_NO_ARM = 400; // мс (когда нет руки)

// Враги
export const ENEMY_BASE_HP = 30;
export const ENEMY_WIDTH = 35;
export const ENEMY_HEIGHT = 35;
export const ENEMY_MIN_FIRE_RATE = 1500;
export const ENEMY_FIRE_RATE_VARIANCE = 1000;
export const ENEMY_SPAWN_MARGIN = 150;
export const ENEMY_MAX_SINGLEPLAYER_BASE = 5;
export const ENEMY_SCORE_DIVISOR_SP = 2000;
export const ENEMY_MAX_MULTIPLAYER_BASE = 3;
export const ENEMY_SCORE_DIVISOR_MP = 3000;
export const ENEMY_SPAWN_CHANCE = 0.015;
export const ENEMY_SYNC_RATE = 500; // мс между синхронизациями врагов

// Снаряды
export const PROJECTILE_WIDTH = 8;
export const PROJECTILE_HEIGHT = 8;
export const PROJECTILE_DAMAGE_PLAYER = 10;
export const PROJECTILE_DAMAGE_ENEMY = 10;

// Коллизии и хитбоксы
export const ARM_OFFSET_Y = -10;
export const ARM_HEIGHT = 12;
export const ARM_WIDTH = 28;
export const LEG_OFFSET_Y = 5;
export const LEG_HEIGHT = 10;
export const LEG_WIDTH = 25;
export const TORSO_OFFSET_Y = -8;
export const TORSO_HEIGHT = 25;
export const TORSO_WIDTH = 30;
export const HEAD_OFFSET_Y = -22;
export const HEAD_SIZE = 16;

// UI и таймеры
export const DAMAGE_FLASH_DURATION = 10; // кадров
export const DEATH_VOID_Y = 1500;
export const LIMB_PICKUP_DISTANCE = 80; // пикселей
export const LIMB_DESTROY_TIME = 500; // мс до исчезновения сломанной конечности
export const LIMB_DETACH_CHANCE = 0.05; // 5% шанс отрыва конечности

// VFX
export const VFX_HIT_SIZE = 20;
export const VFX_DESTROY_SIZE = 30;
export const VFX_LIMB_SIZE = 15;
export const VFX_PICKUP_SIZE = 10;
export const VFX_ENEMY_DEATH_SIZE = 20;

// Звезда
export const STAR_SIZE = 30;
export const STAR_MULTIPLIER = 2;
export const STAR_RESPAWN_TIME = 10000; // 10 секунд

// Интерполяция (для плавного движения удалённых игроков)
export const INTERPOLATION_TIME = 450; // мс

// Сеть
export const NETWORK_UPDATE_RATE = 50; // мс между обновлениями (20Hz)
export const ENEMY_INTERPOLATION_TIME = 450; // мс

// Игровой цикл
export const TARGET_FPS = 60;
export const FRAME_TIME = 1000 / TARGET_FPS; // 16.67мс

// Платформы
export const PLATFORM_GAP = 150;
export const PLATFORM_Y_START = 600;
export const PLATFORM_Y_STEP = 120;
export const PLATFORM_HEIGHT = 20;
export const PLATFORM_MIN_WIDTH = 200;
export const PLATFORM_MAX_WIDTH = 400;

// Оторванные конечности
export const DETACHED_LIMB_ARM_WIDTH = 28;
export const DETACHED_LIMB_ARM_HEIGHT = 12;
export const DETACHED_LIMB_LEG_WIDTH = 25;
export const DETACHED_LIMB_LEG_HEIGHT = 10;
export const DETACHED_LIMB_VX = 2.5; // Максимальная скорость по X
export const DETACHED_LIMB_VY_BASE = -3;
export const DETACHED_LIMB_VY_VARIANCE = 3;
export const DETACHED_LIMB_ROTATION_SPEED = 0.15;

// Очки
export const SCORE_ENEMY_KILL = 150;
export const SCORE_DEATH_PENALTY = 0.5; // Множитель штрафа

export const COLORS = {
  PLAYER: '#00f2ff',
  ENEMY: '#ff0055',
  PLATFORM: '#333333',
  LASER: '#ffea00',
  BG: '#0a0a0a',
  ARM: '#ffdd00', // Жёлтый для рук
  LEG: '#00f2ff'  // Синий для ног
};

export const PLAYER_COLORS = [
  '#00f2ff', // голубой (оригинальный)
  '#00ff66', // зелёный
  '#ff6600', // оранжевый
  '#ff00ff', // пурпурный
];

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Бесплатный TURN сервер от openrelayproject (могут меняться)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];
