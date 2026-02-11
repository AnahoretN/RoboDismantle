
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
  damageFlashTimer?: number; // Таймер мигания красным при получении урона
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

// Hitbox для конкретной части тела
export interface LimbHitbox {
  limbType: LimbType;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Оторванная конечность
export interface DetachedLimb {
  limbType: LimbType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  owner: 'PLAYER' | 'REMOTE_PLAYER';
  ownerId?: string; // для удалённых игроков
  hp: number; // Текущее HP конечности
  maxHp: number; // Максимальное HP
  destroyed?: boolean; // Если true - конечность сломана (0 HP), нельзя подобрать
  destroyTime?: number; // Время когда конечность исчезнет (для сломанных)
}

// Звезда для удвоения очков
export interface Star {
  x: number;
  y: number;
  collected: boolean;
  respawnTime?: number; // Время когда звезда появится снова
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
  detachedLimbs: DetachedLimb[]; // Оторванные конечности
  star: Star; // Звезда для удвоения очков
  gameStartTime: number; // Время начала игры
  gameDuration: number; // Длительность игры в мс (5 минут = 300000)
  gameEnded: boolean; // Игра закончена
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

// Минимальное состояние врага для синхронизации (только то, что нужно)
export interface EnemySyncState {
  id: string;
  x: number;
  y: number;
  hp: number;
  alive: boolean; // для удаления/создания
}

// Выстрел игрока - только точка и направление
export interface PlayerShot {
  playerId: string;
  x: number;
  y: number;
  angle: number;
  weapon: 'left' | 'right'; // какое оружие
}

export interface NetworkMessage {
  type: 'PLAYER_UPDATE' | 'PLAYER_SHOT' | 'ENEMY_SYNC' | 'PLAYER_DAMAGE' | 'GAME_STATE' | 'PLAYER_DIED' | 'ENEMY_DIED' | 'LIMB_LOST' | 'PLAYER_JOINED' | 'PLAYER_DISCONNECTED' | 'PLAYER_NAME_CHANGE' | 'PAUSE_TOGGLE' | 'GAME_START' | 'LIMB_DETACHED' | 'LIMB_ATTACHED' | 'STAR_COLLECTED' | 'GAME_END';
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
