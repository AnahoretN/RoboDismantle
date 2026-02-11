export const GRAVITY = 0.6;
export const FRICTION = 0.8;
export const PLAYER_SPEED = 8;
export const PLAYER_JUMP = -17.5; // Увеличен на 25% (было -14)
export const ROBOT_SIZE = 40;
export const BULLET_SPEED = 24;

export const ARM_MAX_HP = 50;
export const LEG_MAX_HP = 75;
export const TORSO_MAX_HP = 100;
export const HEAD_MAX_HP = 50;

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
