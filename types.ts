
export enum LimbType {
  LEFT_ARM = 'LEFT_ARM',
  RIGHT_ARM = 'RIGHT_ARM',
  LEFT_LEG = 'LEFT_LEG',
  RIGHT_LEG = 'RIGHT_LEG',
  TORSO = 'TORSO',
  HEAD = 'HEAD'
}

export enum GameMode {
  MENU = 'MENU',
  SINGLE_PLAYER = 'SINGLE_PLAYER',
  MULTI_PLAYER = 'MULTI_PLAYER'  // Один режим для всех игроков (хост и гости)
}

export interface Limb {
  type: LimbType;
  hp: number;
  maxHp: number;
  exists: boolean;
  damageMultiplier?: number; // 1.0 = normal damage
}

export interface Weapon {
  name: string;
  type: 'PROJECTILE' | 'LASER';
  cooldown: number;
  lastFired: number;
  color: string;
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

export interface Robot extends Entity {
  limbs: Record<LimbType, Limb>;
  leftWeapon: Weapon;
  rightWeapon: Weapon;
  facing: number; // Angle in radians
  isJumping: boolean;
  onGround: boolean;
  stunTimer: number; // Frames remaining of movement stun
}

export interface Projectile extends Entity {
  owner: 'PLAYER' | 'ENEMY';
  damage: number;
  color: string;
  targetLimb?: LimbType; // For enemy targeting
}

export interface Enemy extends Entity {
  hp: number;
  type: 'DRONE' | 'TURRET';
  lastFired: number;
  fireRate: number;
}

export interface ImpactVFX {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameState {
  player: Robot;
  enemies: Enemy[];
  projectiles: Projectile[];
  platforms: Platform[];
  vfx: ImpactVFX[];
  camera: { x: number, y: number };
  score: number;
  gameOver: boolean;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Types for multiplayer
export interface RemotePlayer extends Robot {
  id: string;
  color: string;
}

// Состояние врага для синхронизации
export interface EnemyState {
  id: string; // Уникальный ID врага
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  type: 'DRONE' | 'TURRET';
  lastFired: number;
  fireRate: number;
  facing?: number; // Направление (для турелей)
}

export interface NetworkMessage {
  type: 'PLAYER_UPDATE' | 'PROJECTILE_FIRED' | 'PLAYER_DAMAGE' | 'GAME_STATE' | 'PLAYER_DIED' | 'ENEMY_DIED' | 'LIMB_LOST' | 'PLAYER_JOINED' | 'PLAYER_DISCONNECTED' | 'PLAYER_NAME_CHANGE' | 'PAUSE_TOGGLE' | 'GAME_START' | 'ENEMY_UPDATE' | 'ENEMY_SPAWN' | 'FULL_SYNC';
  playerId: string;
  data: any;
  timestamp: number;
}

export interface MultiplayerState {
  isPaused: boolean;
  gameMode: GameMode;
  localPlayerId: string;
  remotePlayers: Map<string, RemotePlayer>;
}
