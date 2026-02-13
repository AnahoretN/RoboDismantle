/**
 * GameCanvasRefactored - Новый компонент с интегрированными системами
 * Это пример показывает как использовать все созданные системы
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  GameState, Robot, LimbType, Enemy, Platform,
  Limb, GameMode, RemotePlayer, NetworkMessage, Star
} from '../types';
import {
  BULLET_SPEED, COLORS, PLAYER_COLORS,
  ENEMY_SPAWN_MARGIN, ENEMY_BASE_HP, ENEMY_MIN_FIRE_RATE, ENEMY_FIRE_RATE_VARIANCE,
  ENEMY_WIDTH, ENEMY_HEIGHT,
  LIMB_PICKUP_DISTANCE, LIMB_DESTROY_TIME,
  VFX_HIT_SIZE, VFX_DESTROY_SIZE,
  PROJECTILE_WIDTH, PROJECTILE_HEIGHT, PROJECTILE_DAMAGE_PLAYER,
  NETWORK_UPDATE_RATE, ENEMY_SYNC_RATE, ENEMY_INTERPOLATION_TIME,
  DAMAGE_FLASH_DURATION,
  GRAVITY, FRICTION, PLAYER_SPEED, PLAYER_JUMP, ACCELERATION_TIME,
  ACCELERATION_FACTOR, STUN_JUMP_MULTIPLIER, STUN_SPEED_MULTIPLIER,
  CROUCH_SPEED_MULTIPLIER, ONE_LEG_SPEED_MULTIPLIER, NO_LEGS_SPEED_MULTIPLIER,
  NO_LEGS_HOP_CHANCE, NO_LEGS_HOP_VELOCITY, NO_LEGS_HOP_THRESHOLD,
  DEATH_VOID_Y,
  SCORE_ENEMY_KILL, SCORE_DEATH_PENALTY,
  FIRE_COOLDOWN_LEFT, FIRE_COOLDOWN_RIGHT, FIRE_COOLDOWN_NO_ARM
} from '../constants';
import HUD from './HUD';
import { WebRTCManager, ConnectionStatus, PlayerInfo } from '../lib/WebRTCManager';

// === ИМПОРТ ВСЕХ СИСТЕМ ===
import { createDefaultPlayer } from '../game/utils/playerFactory';
import { generateBasePlatforms, findTopPlatform, createStar, getRandomSpawnPosition } from '../game/utils/levelGenerator';
import {
  createTimeState, updateTime, getDeltaFactor
} from '../game/systems/TimeSystem';
import {
  checkLimbHit,
  checkPlatformCollisions,
  checkCollision
} from '../game/systems/CollisionSystem';
import {
  spawnHitVFX,
  spawnDestroyVFX,
  updateVFX
} from '../game/systems/VFXSystem';
import {
  PreviousState,
  createPreviousState,
  computeDelta,
  updatePreviousState,
  NetworkThrottle
} from '../game/systems/NetworkSyncSystem';
import {
  createEnemy,
  canEnemyFire,
  computeEnemySpawnPosition,
  computeMaxEnemies,
  damageEnemy,
  isEnemyAlive
} from '../game/systems/EnemySystem';
import {
  createProjectile,
  updateProjectile,
  isProjectileOutOfBounds,
  checkProjectileRectCollision
} from '../game/systems/ProjectileSystem';
import {
  createDetachedLimb,
  updateDetachedLimb,
  shouldLimbDisappear,
  canPickupLimb,
  getLimbColor
} from '../game/systems/LimbSystem';
import { InputManager } from '../game/systems/InputSystem';
import {
  createPerformanceMonitor,
  startFrame,
  endFrame
} from '../game/systems/PerformanceMonitor';
import {
  clearCanvas,
  drawRobot,
  drawEnemy,
  drawProjectile,
  drawVFX,
  drawDetachedLimb,
  drawStar,
  drawPlatform,
  applyCamera
} from '../game/renderers/GameRenderer';
import {
  createDirtyRegionManager,
  createOffscreenCache,
  initOffscreenCanvas,
  renderStaticElements,
  drawCachedElements
} from '../game/renderers/OffscreenCanvas';
import {
  updatePlayer,
  applyDamageToPlayer,
  createProjectile as createProjImmutable,
  createVFX,
  addToArray,
  removeFromArrayByIndex,
  filterArray
} from '../game/systems/ImmutableState';

// Враг на клиенте с ID
interface EnemyWithId extends Enemy {
  id: string;
  targetX?: number;
  targetY?: number;
  interpolationStartTime?: number;
}

// Карта интерполяции для каждого врага на клиенте
interface EnemyInterpolation {
  targetX: number;
  targetY: number;
  startTime: number;
  startX: number;
  startY: number;
}

interface GameCanvasProps {
  gameMode: GameMode;
  isPaused: boolean;
  globalPaused: boolean;
  onPauseToggle: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
  onNameChange?: (name: string) => void;
  webrtcManager: WebRTCManager | null;
  localPlayerId: string;
  localPlayerName: string;
}

const GameCanvasRefactored: React.FC<GameCanvasProps> = ({
  gameMode,
  isPaused,
  globalPaused,
  onPauseToggle,
  onRestart,
  onBackToMenu,
  onNameChange,
  webrtcManager,
  localPlayerId,
  localPlayerName
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // === СИСТЕМЫ ===
  const timeState = createTimeState();
  const performance = createPerformanceMonitor();
  const inputManager = useRef<InputManager>(new InputManager());
  const offscreenCache = useRef(createOffscreenCache());
  const dirtyRegions = useRef(createDirtyRegionManager(0, 0));

  // === СОСТОЯНИЕ ===
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectedPlayers, setConnectedPlayers] = useState<PlayerInfo[]>([]);
  const [hudState, setHudState] = useState<GameState | null>(null);

  // Ссылки на мапы для быстрого доступа
  const remotePlayersRef = useRef<Map<string, RemotePlayer>>(new Map());
  const playerScoresRef = useRef<Map<string, number>>(new Map());
  const enemyInterpolationRef = useRef<Map<string, EnemyInterpolation>>(new Map());

  // Сетевые переменные
  const lastNetworkUpdate = useRef<number>(0);
  const enemyIdCounter = useRef<number>(0);
  const lastLimbsHash = useRef<string>('');
  const canvasRect = useRef<DOMRect | null>(null);
  const networkThrottleRef = useRef<NetworkThrottle>(new NetworkThrottle(NETWORK_UPDATE_RATE));
  const previousPlayerStateRef = useRef<PreviousState | null>(null);

  // Определяем режим
  const isMultiplayer = gameMode === GameMode.MULTI_PLAYER;
  const isHost = webrtcManager?.isHostMode() ?? false;

  // === ИНИЦИАЛИЗАЦИЯ ИГРЫ ===
  const basePlatforms = generateBasePlatforms();
  const initialStar = createStar(basePlatforms);

  // Создаём начальное состояние
  const initializeGameState = useCallback(() => {
    const spawnPos = getRandomSpawnPosition(basePlatforms);

    return {
      player: createDefaultPlayer(spawnPos.x, spawnPos.y),
      enemies: [],
      projectiles: [],
      platforms: basePlatforms,
      vfx: [],
      camera: { x: 0, y: 0 },
      score: 0,
      gameOver: false,
      detachedLimbs: [],
      star: initialStar,
      gameStartTime: Date.now(),
      gameDuration: 300000, // 5 минут
      gameEnded: false
    };
  }, [basePlatforms, initialStar]);

  // === ОСНОВНОЙ ИГРОВОЙ ЦИКЛ ===
  const gameLoopCallback = useCallback((deltaTime: number, deltaMultiplier: number) => {
    if (!hudState) return;

    const s = hudState;

    // Проверка паузы
    const isGamePaused = isPaused || globalPaused;
    if (isGamePaused || s.gameOver || s.gameEnded) {
      return;
    }

    // Проверка таймера игры
    if (!s.gameEnded && s.gameStartTime) {
      const elapsed = Date.now() - s.gameStartTime;
      if (elapsed >= s.gameDuration) {
        s.gameEnded = true;
        if (webrtcManager?.isConnected()) {
          webrtcManager.send({
            type: 'GAME_END',
            playerId: localPlayerId,
            data: { score: s.score },
            timestamp: Date.now()
          });
        }
      }
    }

    // === ОБНОВЛЕНИЕ ИГРОВА ===
    updateGameState(deltaMultiplier);
    updateProjectiles(deltaMultiplier);
    updateEnemies(deltaMultiplier);
    updateVFX(s.vfx, deltaMultiplier);

    // === ОТРИСОВКА ===
    renderGame();
    setHudState({ ...s });
  }, [hudState, isPaused, globalPaused, localPlayerId, webrtcManager]);

  // === ОБНОВЛЕНИЕ СОСТОЯНИЯ ИГРЫ ===
  const updateGameState = useCallback((deltaMultiplier: number) => {
    if (!hudState) return;
    const s = hudState;
    const p = s.player;

    // Обновляем stun timer
    if (p.stunTimer > 0) {
      p.stunTimer -= 1 * deltaMultiplier;
    }

    // Обработка ввода
    const input = inputManager.current.getState();

    // Движение и физика игрока
    handlePlayerMovement(p, input, deltaMultiplier);

    // Проверка коллизий с платформами
    const legsCount = [p.limbs.LEFT_LEG.exists, p.limbs.RIGHT_LEG.exists].filter(Boolean).length;
    const noLegs = legsCount === 0;
    checkPlatformCollisions(p, s.platforms, noLegs);

    // Проверка смерти
    if (p.y > DEATH_VOID_Y) {
      s.score = Math.floor(s.score * SCORE_DEATH_PENALTY);
      s.gameOver = true;

      if (webrtcManager?.isConnected()) {
        const realPlayerId = webrtcManager.getPeerId();
        webrtcManager.send({
          type: 'PLAYER_DIED',
          playerId: realPlayerId,
          data: { id: realPlayerId, score: s.score },
          timestamp: Date.now()
        });
      }
    }
  }, [hudState, webrtcManager, localPlayerId]);

  // === ОБРАБОТКА ВВОДА ИГРОКА ===
  const handlePlayerMovement = useCallback((
    player: Robot,
    input: { left: boolean; right: boolean; jump: boolean; crouch: boolean },
    deltaMultiplier: number
  ) => {
    const isCrouching = input.crouch;
    const stunSpeedFactor = player.stunTimer > 0 ? STUN_SPEED_MULTIPLIER : 1;
    const legsCount = [
      player.limbs.LEFT_LEG.exists,
      player.limbs.RIGHT_LEG.exists
    ].filter(Boolean).length;
    const noLegs = legsCount === 0;

    let speedMult = (isCrouching ? CROUCH_SPEED_MULTIPLIER : 1) * stunSpeedFactor;
    if (legsCount === 1) speedMult *= ONE_LEG_SPEED_MULTIPLIER;
    if (noLegs) speedMult *= NO_LEGS_SPEED_MULTIPLIER;

    // Определяем направление движения
    let moveDir = 0;
    if (input.left) moveDir = -1;
    if (input.right) moveDir = 1;

    // Плавное ускорение
    const now = Date.now();
    if (moveDir !== 0) {
      if (player.lastMoveDir !== moveDir) {
        player.moveStartTime = now;
        player.lastMoveDir = moveDir;
      }
      const moveDuration = now - (player.moveStartTime || now);
      const accelPercent = Math.min(1, moveDuration / ACCELERATION_TIME);
      const currentSpeed = PLAYER_SPEED * accelPercent * speedMult;
      player.vx += moveDir * currentSpeed * ACCELERATION_FACTOR * deltaMultiplier;
    } else {
      player.lastMoveDir = 0;
      player.moveStartTime = undefined;
    }

    // Прыжок
    if (input.jump && player.onGround && legsCount > 0) {
      player.vy = PLAYER_JUMP * (player.stunTimer > 0 ? STUN_JUMP_MULTIPLIER : 1);
      player.onGround = false;
    }

    // Автоматические маленькие прыжки без ног
    if (noLegs && player.onGround && Math.abs(player.vx) > NO_LEGS_HOP_THRESHOLD) {
      if (Math.random() < NO_LEGS_HOP_CHANCE) {
        player.vy = NO_LEGS_HOP_VELOCITY;
        player.onGround = false;
      }
    }

    // Трение и гравитация
    player.vx *= FRICTION;
    player.vy += GRAVITY * deltaMultiplier;
    player.x += player.vx * deltaMultiplier;
    player.y += player.vy * deltaMultiplier;

    // Обновляем таймеры мигания при получении урона
    Object.values(player.limbs).forEach(limb => {
      if (limb.damageFlashTimer && limb.damageFlashTimer > 0) {
        limb.damageFlashTimer -= 1 * deltaMultiplier;
      }
    });
  }, []);

  // === ОБНОВЛЕНИЕ СНАРЯДОВ ===
  const updateProjectiles = useCallback((deltaMultiplier: number) => {
    if (!hudState) return;
    const s = hudState;

    s.projectiles = filterArray(s.projectiles, proj => {
      updateProjectile(proj, deltaMultiplier);
      return !isProjectileOutOfBounds(proj);
    });
  }, []);

  // === ОБНОВЛЕНИЕ ВРАГОВ ===
  const updateEnemies = useCallback((deltaMultiplier: number) => {
    if (!hudState) return;
    const s = hudState;

    // Спавн врагов
    if (isMultiplayer) {
      const allScores = [s.score, ...Array.from(playerScoresRef.current.values())];
      const avgScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
      const maxEnemies = computeMaxEnemies(avgScore, true);

      if (s.enemies.length < maxEnemies && Math.random() < ENEMY_SPAWN_CHANCE) {
        const spawnPos = computeEnemySpawnPosition(
          s.camera.x,
          s.camera.y,
          canvasRef.current?.width || window.innerWidth,
          canvasRef.current?.height || window.innerHeight
        );
        const newEnemy = createEnemy(spawnPos.x, spawnPos.y);
        const enemyWithId = { ...newEnemy, id: `enemy_${enemyIdCounter.current++}_${Date.now()}` };
        s.enemies.push(enemyWithId);
      }
    } else {
      const maxEnemies = computeMaxEnemies(s.score, false);
      if (s.enemies.length < maxEnemies && Math.random() < ENEMY_SPAWN_CHANCE) {
        const spawnPos = computeEnemySpawnPosition(
          s.camera.x,
          s.camera.y,
          canvasRef.current?.width || window.innerWidth,
          canvasRef.current?.height || window.innerHeight
        );
        s.enemies.push(createEnemy(spawnPos.x, spawnPos.y));
      }
    }
  }, []);

  // === ОТРИСОВКА ===
  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !hudState) return;

    const s = hudState;
    const width = canvas.width;
    const height = canvas.height;

    // Очищаем canvas
    clearCanvas(ctx, width, height);

    // Применяем камеру
    ctx.save();
    applyCamera(ctx, s.camera.x, s.camera.y);

    // Рисуем платформы
    s.platforms.forEach(plat => drawPlatform(ctx, plat));

    // Рисуем звезду
    drawStar(ctx, s.star);

    // Рисуем оторванные конечности
    s.detachedLimbs.forEach(limb => {
      const isNearPlayer = canPickupLimb(
        limb,
        s.player.x,
        s.player.y,
        LIMB_PICKUP_DISTANCE
      );
      drawDetachedLimb(ctx, limb, isNearPlayer);
    });

    // Рисуем врагов
    s.enemies.forEach(enemy => drawEnemy(ctx, enemy));

    // Рисуем снаряды
    s.projectiles.forEach(proj => drawProjectile(ctx, proj));

    // Рисуем игрока
    drawRobot(ctx, s.player, COLORS.PLAYER_COLORS[0], true);

    // Рисуем удалённых игроков
    remotePlayersRef.current.forEach(player => {
      drawRobot(ctx, player, player.color, false);
    });

    // Рисуем VFX
    s.vfx.forEach(vfx => drawVFX(ctx, vfx));

    ctx.restore();
  }, [hudState]);

  // === ЗАПУСК ИГРОВОГО ЦИКЛА ===
  const startGameLoop = useCallback(() => {
    if (!canvasRef.current) return;

    // Инициализируем offscreen cache
    const cache = offscreenCache.current;
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    initOffscreenCanvas(cache, width, height);

    // Рендерим статичные элементы в кэш
    renderStaticElements(cache, ctx => {
      basePlatforms.forEach(plat => drawPlatform(ctx, plat));
    });

    // Запоминаем время последнего обновления для network throttle
    lastNetworkUpdate.current = Date.now();

    // Сбрасываем состояние
    const initialState = initializeGameState();
    setHudState(initialState);

    // Создаём request animation loop
    const loop = () => {
      startFrame(performance);
      const currentTime = performance.now();

      // Обновляем время
      const updatedTimeState = updateTime(timeState, currentTime);
      const deltaTime = updatedTimeState.deltaTime;
      const deltaMultiplier = getDeltaFactor(deltaTime);

      // Вызываем игровой цикл
      gameLoopCallback(deltaTime, deltaMultiplier);

      // Завершаем измерение кадра
      const metrics = endFrame(performance);

      // Логируем проблемы
      if (metrics.isLagging) {
        console.warn(`[Game] Low FPS: ${metrics.fps}, frame time: ${metrics.frameTime.toFixed(2)}ms`);
      }

      requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  }, []);

  // === ОСТАНОВ ИГРОВОГО ЦИКЛА ===
  useEffect(() => {
    const loopId = requestRef.current;
    return () => {
      if (loopId) {
        cancelAnimationFrame(loopId);
      }
      inputManager.current.reset();
    };
  }, []);

  // === ОБРАБОТКА СОБЫТИЙ КЛАВИАТУРЫ ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      inputManager.current.onKeyDown(e);

      // Escape для паузы
      if (e.code === 'Escape') {
        onPauseToggle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      inputManager.current.onKeyUp(e);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      inputManager.current.onMouseMove(e, canvasRef.current);
    };

    const handleMouseDown = (e: MouseEvent) => {
      inputManager.current.onMouseDown(e);

      // Стрельба левой кнопкой мыши
      if (!hudState || hudState.gameOver || hudState.gameEnded) return;
      const s = hudState;
      const now = Date.now();

      if (e.button === 0) { // ЛКМ
        const cooldown = s.player.limbs.LEFT_ARM.exists
          ? FIRE_COOLDOWN_LEFT
          : FIRE_COOLDOWN_NO_ARM;

        if (now - s.player.leftWeapon.lastFired > cooldown) {
          s.player.leftWeapon.lastFired = now;

          const angle = Math.atan2(
            e.clientY - canvasRect.current!.top - (s.player.y + s.player.height / 2),
            e.clientX - canvasRect.current!.left - (s.player.x + s.player.width / 2)
          );

          const proj = createProjectile(
            s.player.x + s.player.width / 2,
            s.player.y + s.player.height / 2 - 10,
            angle,
            'PLAYER',
            COLORS.ARM
          );

          s.projectiles.push(proj);

          // Отправляем в мультиплеере
          if (webrtcManager?.isConnected()) {
            webrtcManager.send({
              type: 'PLAYER_SHOT',
              playerId: localPlayerId,
              data: { x: proj.x, y: proj.y, angle, color: proj.color },
              timestamp: now
            });
          }
        }
      }

      if (e.button === 2) { // ПКМ
        const cooldown = s.player.limbs.RIGHT_ARM.exists
          ? FIRE_COOLDOWN_RIGHT
          : FIRE_COOLDOWN_NO_ARM;

        if (now - s.player.rightWeapon.lastFired > cooldown) {
          s.player.rightWeapon.lastFired = now;

          const angle = Math.atan2(
            e.clientY - canvasRect.current!.top - (s.player.y + s.player.height / 2),
            e.clientX - canvasRect.current!.left - (s.player.x + s.player.width / 2)
          );

          const proj = createProjectile(
            s.player.x + s.player.width / 2,
            s.player.y + s.player.height / 2 - 10,
            angle,
            'PLAYER',
            COLORS.ARM
          );

          s.projectiles.push(proj);

          // Отправляем в мультиплеере
          if (webrtcManager?.isConnected()) {
            webrtcManager.send({
              type: 'PLAYER_SHOT',
              playerId: localPlayerId,
              data: { x: proj.x, y: proj.y, angle, color: proj.color },
              timestamp: now
            });
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      inputManager.current.onMouseUp(e);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // === ОБРАБОТКА WEBRTC СООБЩЕНИЙ ===
  useEffect(() => {
    if (!webrtcManager) return;

    const handleMessage = (message: NetworkMessage) => {
      if (!hudState) return;
      const s = hudState;

      switch (message.type) {
        case 'PLAYER_UPDATE': {
          const { id, x, y, vx, vy, facing, limbs, onGround, score } = message.data;
          const existing = remotePlayersRef.current.get(id);

          // Сохраняем очки
          if (score !== undefined) {
            playerScoresRef.current.set(id, score);
          }

          if (existing) {
            existing.x = x;
            existing.y = y;
            existing.vx = vx;
            existing.vy = vy;
            existing.facing = facing;
            if (onGround !== undefined) existing.onGround = onGround;
            if (limbs) {
              Object.entries(limbs).forEach(([key, limbData]) => {
                if (existing.limbs[key as LimbType]) {
                  existing.limbs[key as LimbType] = limbData;
                }
              });
            }
          } else {
            const newPlayer = createDefaultPlayer(100, 300);
            remotePlayersRef.current.set(id, {
              ...newPlayer,
              id,
              color: PLAYER_COLORS[Math.min(connectedPlayers.length, 3)],
              x, y, vx, vy, facing,
              limbs: limbs || newPlayer.limbs
            });
          }
          break;
        }

        case 'PLAYER_SHOT': {
          const { x, y, angle, color } = message.data;
          const proj = createProjectile(x, y, angle, 'REMOTE_PLAYER', color);
          s.projectiles.push(proj);
          break;
        }

        case 'PLAYER_DIED': {
          const { id, score: deadScore } = message.data;
          if (deadScore !== undefined) {
            playerScoresRef.current.set(id, deadScore);
          }
          remotePlayersRef.current.delete(id);
          break;
        }

        case 'PLAYER_DISCONNECTED': {
          const { id } = message.data;
          remotePlayersRef.current.delete(id);
          break;
        }

        case 'PLAYER_JOINED': {
          const { id, color } = message.data;
          if (!remotePlayersRef.current.has(id)) {
            const newPlayer = createDefaultPlayer(100, 300);
            remotePlayersRef.current.set(id, {
              ...newPlayer,
              id,
              color: color || PLAYER_COLORS[1],
              limbs: newPlayer.limbs
            });
          }
          break;
        }

        case 'LIMB_DETACHED': {
          const { limbType, x, y, vx, vy, color, hp, maxHp, destroyed } = message.data;
          s.detachedLimbs.push({
            limbType,
            x, y,
            vx, vy,
            width: limbType.includes('ARM') ? 28 : 25,
            height: limbType.includes('ARM') ? 12 : 10,
            color,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            owner: 'REMOTE_PLAYER',
            ownerId: message.playerId,
            hp,
            maxHp,
            destroyed,
            destroyTime: destroyed ? Date.now() + LIMB_DESTROY_TIME : undefined
          });
          spawnHitVFX(s.vfx, x, y, color);
          break;
        }

        case 'LIMB_ATTACHED': {
          // Гость подобрал конечность
          break;
        }

        case 'STAR_COLLECTED': {
          if (message.playerId === localPlayerId) {
            s.star.collected = true;
            s.star.respawnTime = Date.now() + STAR_RESPAWN_TIME;
          } else {
            s.detachedLimbs = s.detachedLimbs.filter(l => l.owner !== 'REMOTE_PLAYER' || l.ownerId !== message.playerId);
          }
          break;
        }

        case 'GAME_START': {
          // Начинаем игру
          if (!isHost) {
            const initialState = initializeGameState();
            Object.assign(s, initialState);
          }
          break;
        }

        case 'GAME_END': {
          s.gameEnded = true;
          break;
        }
      }
    };

    webrtcManager.onMessage(handleMessage);

    webrtcManager.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    webrtcManager.onPlayerListChange((players) => {
      setConnectedPlayers(players);
    });
  }, [webrtcManager, localPlayerId]);

  // === РЕСТАРТ ИГРЫ ===
  const handleRestart = useCallback(() => {
    if (!hudState) return;
    const s = hudState;

    // Сохраняем очки и таймер
    const preservedScore = s.score;
    const preservedStartTime = s.gameStartTime;
    const preservedStar = s.star;

    // Создаём нового игрока
    s.player = createDefaultPlayer(100, 300);
    s.projectiles = [];
    s.vfx = [];
    s.gameOver = false;

    // НЕ сбрасываем
    s.score = preservedScore;
    s.gameStartTime = preservedStartTime;
    s.star = preservedStar;
    s.camera = { x: 100 - window.innerWidth / 2, y: 300 - window.innerHeight / 2 };

    // Сбрасываем состояние offscreen cache
    offscreenCache.current.needsUpdate = true;

    setHudState({ ...s });
  }, [hudState]);

  // === ВОЗВРАТ В МЕНЮ ===
  const handleBackToMenu = useCallback(() => {
    const loopId = requestRef.current;
    if (loopId) {
      cancelAnimationFrame(loopId);
    }
    setHudState(null);
    onBackToMenu();
  }, [onBackToMenu]);

  // === HUD РЕНДЕРИНГ ===
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', margin: '0 auto', background: '#000' }}
      />

      {hudState && (
        <HUD
          gameState={hudState}
          connectionStatus={connectionStatus}
          connectedPlayers={connectedPlayers}
          onRestart={handleRestart}
          onBackToMenu={handleBackToMenu}
          onPauseToggle={onPauseToggle}
          localPlayerName={localPlayerName}
          onNameChange={onNameChange}
        />
      )}
    </>
  );
};

export default GameCanvasRefactored;
