import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  GameState, Robot, LimbType, Enemy, Platform,
  Limb, GameMode, RemotePlayer, NetworkMessage
} from '../types';
import {
  GRAVITY, FRICTION, PLAYER_JUMP,
  ROBOT_SIZE, BULLET_SPEED, ARM_MAX_HP, LEG_MAX_HP, TORSO_MAX_HP, HEAD_MAX_HP, COLORS, PLAYER_COLORS
} from '../constants';
import HUD from './HUD';
import { WebRTCManager, ConnectionStatus, PlayerInfo } from '../lib/WebRTCManager';

// Враг на клиенте с ID
interface EnemyWithId extends Enemy {
  id: string;
  // Поля для интерполяции на клиенте (не хост)
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

const GameCanvas: React.FC<GameCanvasProps> = ({
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
  const requestRef = useRef<number>(0);
  const keys = useRef<Record<string, boolean>>({});
  const lastKeys = useRef<Record<string, boolean>>({});
  const mouse = useRef({ x: 0, y: 0, left: false, right: false });
  const remotePlayersRef = useRef<Map<string, RemotePlayer>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectedPlayers, setConnectedPlayers] = useState<PlayerInfo[]>([]);
  const lastNetworkUpdate = useRef<number>(0);
  const enemyIdCounter = useRef<number>(0);
  const lastLimbsHash = useRef<string>(''); // Для оптимизации отправки limbs
  const canvasRect = useRef<DOMRect | null>(null); // Кэш для getBoundingClientRect
  // Интерполяция врагов на клиенте (targetX, targetY, startTime, startX, startY)
  const enemyInterpolationRef = useRef<Map<string, EnemyInterpolation>>(new Map());

  // Определяем режим мультиплеера и роль игрока
  const isMultiplayer = gameMode === GameMode.MULTI_PLAYER;
  const isHost = webrtcManager?.isHostMode() ?? false;

  // Определяем цвет игрока на основе режима
  const getPlayerColor = useCallback((): string => {
    return PLAYER_COLORS[0]; // Хост всегда голубой
  }, []);

  const basePlatforms: Platform[] = [
    { x: -500, y: 500, width: 3000, height: 60 },
    { x: 300, y: 400, width: 250, height: 25 },
    { x: 700, y: 320, width: 250, height: 25 },
    { x: 150, y: 220, width: 200, height: 25 },
    { x: 1000, y: 420, width: 300, height: 25 },
    { x: 400, y: 100, width: 200, height: 25 },
    { x: 800, y: 0, width: 250, height: 25 },
    { x: 1200, y: -80, width: 200, height: 25 },
    { x: 1500, y: -200, width: 300, height: 30 },
    { x: 1100, y: -350, width: 200, height: 25 },
    { x: 700, y: -450, width: 250, height: 25 },
    { x: 300, y: -600, width: 200, height: 25 },
    { x: 0, y: -750, width: 250, height: 25 },
    { x: 400, y: -900, width: 300, height: 30 },
    { x: 900, y: -1050, width: 200, height: 25 },
    { x: 1300, y: -1200, width: 250, height: 25 },
    { x: 1000, y: -1400, width: 150, height: 25 },
    { x: 600, y: -1550, width: 150, height: 25 },
    { x: 200, y: -1700, width: 150, height: 25 },
    { x: 500, y: -1900, width: 400, height: 40 },
    { x: 1000, y: -2100, width: 200, height: 25 },
    { x: 1400, y: -2300, width: 250, height: 25 },
    { x: 800, y: -2500, width: 500, height: 50 },
  ].map(p => {
    if (p.y < 500) {
      return { ...p, x: p.x * 0.9, y: p.y * 0.9 };
    }
    return p;
  });

  const getDefaultPlayerState = (): Robot => ({
    x: 100, y: 300, width: ROBOT_SIZE, height: ROBOT_SIZE * 1.5,
    vx: 0, vy: 0, facing: 0, isJumping: false, onGround: false,
    stunTimer: 0,
    limbs: {
      [LimbType.TORSO]: { type: LimbType.TORSO, hp: TORSO_MAX_HP, maxHp: TORSO_MAX_HP, exists: true, damageMultiplier: 1.0 },
      [LimbType.HEAD]: { type: LimbType.HEAD, hp: HEAD_MAX_HP, maxHp: HEAD_MAX_HP, exists: true, damageMultiplier: 1.0 },
      [LimbType.LEFT_ARM]: { type: LimbType.LEFT_ARM, hp: ARM_MAX_HP, maxHp: ARM_MAX_HP, exists: true, damageMultiplier: 1.0 },
      [LimbType.RIGHT_ARM]: { type: LimbType.RIGHT_ARM, hp: ARM_MAX_HP, maxHp: ARM_MAX_HP, exists: true, damageMultiplier: 1.0 },
      [LimbType.LEFT_LEG]: { type: LimbType.LEFT_LEG, hp: LEG_MAX_HP, maxHp: LEG_MAX_HP, exists: true, damageMultiplier: 1.0 },
      [LimbType.RIGHT_LEG]: { type: LimbType.RIGHT_LEG, hp: LEG_MAX_HP, maxHp: LEG_MAX_HP, exists: true, damageMultiplier: 1.0 },
    },
    leftWeapon: { name: 'Plasma', type: 'PROJECTILE', cooldown: 200, lastFired: 0, color: '#00f2ff' },
    rightWeapon: { name: 'Laser', type: 'PROJECTILE', cooldown: 150, lastFired: 0, color: '#ffea00' },
  });

  const stateRef = useRef<GameState>({
    player: getDefaultPlayerState(),
    enemies: [],
    projectiles: [],
    platforms: basePlatforms,
    vfx: [],
    camera: { x: 0, y: 0 },
    score: 0,
    gameOver: false,
  });

  const [hudState, setHudState] = useState<GameState>(stateRef.current);

  // Обработка WebRTC сообщений
  useEffect(() => {
    if (!webrtcManager) return;

    const handleMessage = (message: NetworkMessage) => {
      const s = stateRef.current;

      switch (message.type) {
        case 'PLAYER_UPDATE': {
          const { id, x, y, vx, vy, facing, limbs, onGround } = message.data;
          const existing = remotePlayersRef.current.get(id);

          if (existing) {
            existing.x = x;
            existing.y = y;
            existing.vx = vx;
            existing.vy = vy;
            existing.facing = facing;
            if (onGround !== undefined) existing.onGround = onGround;
            if (limbs) {
              Object.entries(limbs).forEach(([key, limbData]: [string, any]) => {
                if (existing.limbs[key as LimbType]) {
                  existing.limbs[key as LimbType] = limbData;
                }
              });
            }
          } else {
            const newPlayer: RemotePlayer = {
              ...getDefaultPlayerState(),
              id,
              color: PLAYER_COLORS[Math.min(connectedPlayers.length, 3)],
              x, y, vx, vy, facing,
              limbs: limbs || getDefaultPlayerState().limbs
            };
            if (onGround !== undefined) newPlayer.onGround = onGround;
            remotePlayersRef.current.set(id, newPlayer);
          }
          break;
        }

        case 'PLAYER_SHOT': {
          // Игрок выстрелил - создаём снаряд локально
          const { x, y, angle, color } = message.data;
          const projVx = Math.cos(angle) * BULLET_SPEED;
          const projVy = Math.sin(angle) * BULLET_SPEED;

          s.projectiles.push({
            x, y, vx: projVx, vy: projVy,
            width: 8, height: 8,
            owner: 'REMOTE_PLAYER',
            ownerId: message.playerId, // Запоминаем кто выстрелил
            damage: 10,
            color
          } as any);
          break;
        }

        case 'PLAYER_DIED':
        case 'PLAYER_DISCONNECTED': {
          const { id } = message.data;
          remotePlayersRef.current.delete(id);
          break;
        }

        case 'PLAYER_JOINED': {
          const { id, color } = message.data;
          if (!remotePlayersRef.current.has(id)) {
            const newPlayer: RemotePlayer = {
              ...getDefaultPlayerState(),
              id,
              color: color || PLAYER_COLORS[1],
              x: 100, y: 300,
              vx: 0, vy: 0, facing: 0,
              limbs: getDefaultPlayerState().limbs
            };
            remotePlayersRef.current.set(id, newPlayer);
          }
          break;
        }

        case 'PAUSE_TOGGLE': {
          break;
        }

        case 'PLAYER_DAMAGE': {
          // Другой игрок нанёс урон нам
          const { targetId, limbKey, damage } = message.data;
          if (targetId === localPlayerId) {
            const limb = s.player.limbs[limbKey as LimbType];
            if (limb && limb.exists) {
              limb.hp -= damage;
              s.player.stunTimer = 12;
              if (limb.hp <= 0) {
                limb.exists = false;
                if (limbKey === LimbType.TORSO || limbKey === LimbType.HEAD) {
                  s.gameOver = true;
                }
              }
            }
          }
          break;
        }

        case 'GAME_START': {
          const ground = s.platforms[0];
          const spawnX = ground.x + 100 + Math.random() * (ground.width - 200);
          const spawnY = ground.y - 100;

          s.player = getDefaultPlayerState();
          s.player.x = spawnX;
          s.player.y = spawnY;
          s.enemies = [];
          s.projectiles = [];
          s.vfx = [];
          s.score = 0;
          s.gameOver = false;
          s.camera = { x: spawnX - window.innerWidth / 2, y: spawnY - window.innerHeight / 2 };
          setHudState({ ...s });
          break;
        }

        case 'ENEMY_SYNC': {
          // Хост отправляет состояние врагов 2 раза в секунду
          if (!isHost) {
            const { enemies } = message.data;
            const enemyMap = new Map<string, any>();
            const now = Date.now();
            const interpolationMap = enemyInterpolationRef.current;

            // Создаём карту существующих врагов
            s.enemies.forEach((e: any) => {
              if (e.id) enemyMap.set(e.id, e);
            });

            enemies.forEach((enemyData: any) => {
              const existing = enemyMap.get(enemyData.id);
              if (existing) {
                // Устанавливаем целевую позицию для интерполяции
                interpolationMap.set(enemyData.id, {
                  targetX: enemyData.x,
                  targetY: enemyData.y,
                  startTime: now,
                  startX: existing.x,
                  startY: existing.y
                });
                existing.hp = enemyData.hp;
              } else {
                // Создаём нового врага (без интерполяции для первого появления)
                const newEnemy: any = {
                  x: enemyData.x,
                  y: enemyData.y,
                  width: 35,
                  height: 35,
                  vx: 0,
                  vy: 0,
                  hp: enemyData.hp,
                  type: 'DRONE',
                  lastFired: 0,
                  fireRate: 1500 + Math.random() * 1000,
                  id: enemyData.id
                };
                s.enemies.push(newEnemy);
              }
            });

            // Удаляем врагов, которых нет на хосте
            const receivedIds = new Set(enemies.map((e: any) => e.id));
            s.enemies = s.enemies.filter((e: any) => !e.id || receivedIds.has(e.id));
            // Также удаляем интерполяцию для удалённых врагов
            Array.from(interpolationMap.keys()).forEach(id => {
              if (!receivedIds.has(id)) interpolationMap.delete(id);
            });
          }
          break;
        }
      }
    };

    webrtcManager.onMessage(handleMessage);

    return () => {
      webrtcManager.offMessage(handleMessage);
    };
  }, [webrtcManager, connectedPlayers.length, isHost]);

  // Отслеживание статуса соединения
  useEffect(() => {
    if (!webrtcManager) return;

    const handleStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };

    webrtcManager.onStatusChange(handleStatusChange);

    return () => {
      // Cleanup handled by WebRTCManager
    };
  }, [webrtcManager]);

  // Инициализация для мультиплеера
  useEffect(() => {
    if (gameMode === GameMode.MULTI_PLAYER && webrtcManager) {
      webrtcManager.onPlayerListChange((players: PlayerInfo[]) => {
        setConnectedPlayers(players);
      });
      setConnectedPlayers(webrtcManager.getConnectedPlayers());
    }
  }, [gameMode, webrtcManager]);

  const spawnVFX = (x: number, y: number, color: string, size: number = 15) => {
    stateRef.current.vfx.push({
      x, y, color, size,
      life: 8,
      maxLife: 8
    });
  };

  const spawnEnemy = () => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const margin = 150;
    const side = Math.floor(Math.random() * 3);
    let spawnX = 0, spawnY = 0;
    if (side === 0) { spawnX = s.camera.x - margin; spawnY = s.camera.y + Math.random() * canvas.height; }
    else if (side === 1) { spawnX = s.camera.x + canvas.width + margin; spawnY = s.camera.y + Math.random() * canvas.height; }
    else { spawnX = s.camera.x + Math.random() * canvas.width; spawnY = s.camera.y - margin; }

    const enemyId = `enemy_${enemyIdCounter.current++}_${Date.now()}`;
    const enemy: EnemyWithId = {
      id: enemyId,
      x: spawnX, y: spawnY, width: 35, height: 35, vx: 0, vy: 0,
      hp: 30, type: 'DRONE', lastFired: 0, fireRate: 1500 + Math.random() * 1000
    };
    s.enemies.push(enemy);
  };

  // Отправка обновления позиции по сети
  const sendNetworkUpdate = useCallback(() => {
    if (!webrtcManager || !webrtcManager.isConnected()) return;

    const now = Date.now();
    if (now - lastNetworkUpdate.current < 50) return;
    lastNetworkUpdate.current = now;

    const p = stateRef.current.player;
    const realPlayerId = webrtcManager.getPeerId();

    // Оптимизация: вычисляем hash limbs только если что-то изменилось
    const limbsChanged = Object.values(p.limbs).some((l: Limb) => !l.exists || l.hp < l.maxHp);
    let limbsToSend = undefined;
    if (limbsChanged) {
      const hash = JSON.stringify(p.limbs);
      if (hash !== lastLimbsHash.current) {
        lastLimbsHash.current = hash;
        limbsToSend = p.limbs;
      }
    }

    webrtcManager.send({
      type: 'PLAYER_UPDATE',
      playerId: realPlayerId,
      data: {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        onGround: p.onGround,
        limbs: limbsToSend
      },
      timestamp: now
    });
  }, [webrtcManager]);

  // Отправка состояния врагов 2 раза в секунду (только хост)
  const lastEnemySyncRef = useRef<number>(0);
  const sendEnemySync = useCallback(() => {
    if (!webrtcManager?.isConnected() || !isHost) return;

    const now = Date.now();
    if (now - lastEnemySyncRef.current < 500) return; // 2 раза в секунду
    lastEnemySyncRef.current = now;

    const s = stateRef.current;
    const realPlayerId = webrtcManager.getPeerId();

    // Собираем состояние врагов
    const enemiesData = s.enemies.map((e: any) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      hp: e.hp
    }));

    webrtcManager.send({
      type: 'ENEMY_SYNC',
      playerId: realPlayerId,
      data: { enemies: enemiesData },
      timestamp: now
    });
  }, [webrtcManager, isHost]);

  // Отправка выстрела игрока
  const sendPlayerShot = useCallback((x: number, y: number, angle: number, color: string) => {
    if (!webrtcManager?.isConnected()) return;

    const realPlayerId = webrtcManager.getPeerId();
    webrtcManager.send({
      type: 'PLAYER_SHOT',
      playerId: realPlayerId,
      data: { x, y, angle, color },
      timestamp: Date.now()
    });
  }, [webrtcManager]);

  const update = () => {
    const s = stateRef.current;

    if (isPaused || s.gameOver) return;

    const p = s.player;
    if (p.stunTimer > 0) p.stunTimer--;
    const isCrouching = keys.current['KeyS'] || keys.current['ArrowDown'];
    const stunSpeedFactor = p.stunTimer > 0 ? 0.5 : 1.0;
    let speedMult = (isCrouching ? 0.4 : 1.0) * stunSpeedFactor;
    const legsCount = [p.limbs.LEFT_LEG.exists, p.limbs.RIGHT_LEG.exists].filter(Boolean).length;
    if (legsCount === 1) speedMult *= 0.5;
    if (legsCount === 0) speedMult *= 0.2;
    if (keys.current['KeyA']) p.vx -= 1.2 * speedMult;
    if (keys.current['KeyD']) p.vx += 1.2 * speedMult;
    if (keys.current['Space'] && !lastKeys.current['Space'] && p.onGround && legsCount > 0) {
      p.vy = PLAYER_JUMP * (p.stunTimer > 0 ? 0.8 : 1.0);
      p.onGround = false;
    }
    // Оптимизация: отслеживаем только пробел для прыжка
    lastKeys.current['Space'] = keys.current['Space'];
    p.vx *= FRICTION;
    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;

    // Death void
    if (p.y > 1500) {
      s.gameOver = true;
      p.limbs[LimbType.TORSO].hp = 0;
      p.limbs[LimbType.TORSO].exists = false;

      if (webrtcManager?.isConnected()) {
        const realPlayerId = webrtcManager.getPeerId();
        webrtcManager.send({
          type: 'PLAYER_DIED',
          playerId: realPlayerId,
          data: { id: realPlayerId },
          timestamp: Date.now()
        });
      }
    }

    p.onGround = false;
    s.platforms.forEach((plat: Platform) => {
      if (p.x + p.width > plat.x && p.x < plat.x + plat.width) {
        const feetPos = p.y + p.height;
        if (feetPos >= plat.y && feetPos <= plat.y + plat.height + Math.max(0, p.vy) + 1) {
          if (p.vy >= 0) { p.y = plat.y - p.height; p.vy = 0; p.onGround = true; }
        }
      }
    });

    // Прыжок на врагов
    if (p.vy > 0 && legsCount > 0) {
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        if (p.x + p.width > e.x && p.x < e.x + e.width && p.y + p.height > e.y && p.y + p.height < e.y + e.height + p.vy) {
          p.vy = PLAYER_JUMP / 2;
          p.onGround = true;
          e.hp -= 20;
          spawnVFX(p.x + p.width / 2, p.y + p.height, '#ffffff', 30);
          if (e.hp <= 0) {
            s.enemies.splice(i, 1);
            s.score += 250;
          }
          break;
        }
      }
    }

    // Стрельба (оптимизация: кэшируем getBoundingClientRect)
    let rect = canvasRect.current;
    if (!rect || rect.width !== canvasRef.current?.width || rect.height !== canvasRef.current?.height) {
      rect = canvasRef.current?.getBoundingClientRect() || null;
      canvasRect.current = rect;
    }
    if (rect) {
      const worldMouseX = mouse.current.x - rect.left + s.camera.x;
      const worldMouseY = mouse.current.y - rect.top + s.camera.y;
      const shoulderY = p.y + p.height / 2 - 12 + (isCrouching ? p.height * 0.2 : 0);
      p.facing = Math.atan2(worldMouseY - shoulderY, worldMouseX - (p.x + p.width / 2));
      const now = Date.now();

      // Левая рука (оптимизация: вычисляем trig один раз)
      const cosFacing = Math.cos(p.facing);
      const sinFacing = Math.sin(p.facing);
      const projSpeedX = cosFacing * BULLET_SPEED;
      const projSpeedY = sinFacing * BULLET_SPEED;

      if (mouse.current.left && p.limbs.LEFT_ARM.exists && now - p.leftWeapon.lastFired > p.leftWeapon.cooldown) {
        const projX = p.x + p.width / 2 - 15 + cosFacing * 28;
        const projY = shoulderY + sinFacing * 28;

        s.projectiles.push({
          x: projX, y: projY, vx: projSpeedX, vy: projSpeedY,
          width: 8, height: 8, owner: 'PLAYER', damage: 10, color: p.leftWeapon.color
        });
        p.leftWeapon.lastFired = now;

        if (isMultiplayer) {
          sendPlayerShot(projX, projY, p.facing, p.leftWeapon.color);
        }
      }

      // Правая рука
      if (mouse.current.right && p.limbs.RIGHT_ARM.exists && now - p.rightWeapon.lastFired > p.rightWeapon.cooldown) {
        const projX = p.x + p.width / 2 + 15 + cosFacing * 28;
        const projY = shoulderY + sinFacing * 28;

        s.projectiles.push({
          x: projX, y: projY, vx: projSpeedX, vy: projSpeedY,
          width: 8, height: 8, owner: 'PLAYER', damage: 10, color: p.rightWeapon.color
        });
        p.rightWeapon.lastFired = now;

        if (isMultiplayer) {
          sendPlayerShot(projX, projY, p.facing, p.rightWeapon.color);
        }
      }
    }

    // Спавн врагов - локально на каждом клиенте независимо
    // Интенсивность снижена на 25% (было 0.02, стало 0.015)
    // В мультиплеере каждый клиент спавнит врагов самостоятельно для визуализации
    const maxEnemies = gameMode === GameMode.SINGLE_PLAYER
      ? 5 + Math.floor(s.score / 2000)
      : 3 + Math.floor(s.score / 3000); // Меньше врагов в мультиплеере для оптимизации

    if (s.enemies.length < maxEnemies && Math.random() < 0.015) {
      spawnEnemy();
    }

    // Интерполяция врагов на клиенте (только для гостей)
    // Двигаем врагов к целевой позиции в течение 0.45 секунд
    if (!isHost && isMultiplayer) {
      const now = Date.now();
      const INTERPOLATION_TIME = 450; // 0.45 секунды в миллисекундах

      s.enemies.forEach((enemy: any) => {
        if (enemy.id) {
          const interp = enemyInterpolationRef.current.get(enemy.id);
          if (interp) {
            const elapsed = now - interp.startTime;
            if (elapsed < INTERPOLATION_TIME) {
              // Линейная интерполяция к целевой позиции
              const t = elapsed / INTERPOLATION_TIME; // 0..1
              enemy.x = interp.startX + (interp.targetX - interp.startX) * t;
              enemy.y = interp.startY + (interp.targetY - interp.startY) * t;
            } else {
              // Время истекло - устанавливаем целевую позицию
              enemy.x = interp.targetX;
              enemy.y = interp.targetY;
              enemyInterpolationRef.current.delete(enemy.id);
            }
          }
        }
      });
    }

    // Обновление врагов - локально на всех клиентах
    // Каждый враг выбирает случайного игрока (локального или удалённого) как цель
    s.enemies.forEach((enemy, idx) => {
      // Собираем всех игроков: локального + удалённых
      const allPlayers: Robot[] = [p];
      remotePlayersRef.current.forEach((rp) => {
        if (rp.limbs[LimbType.TORSO].exists) { // Только живые игроки
          allPlayers.push(rp);
        }
      });

      // Выбираем случайного игрока как цель (но меняем редко для плавности)
      if (!(enemy as any).targetPlayerId || Math.random() < 0.01) {
        const targetPlayer = allPlayers[Math.floor(Math.random() * allPlayers.length)];
        (enemy as any).targetPlayerId = targetPlayer === p ? 'local' : (targetPlayer as RemotePlayer).id;
      }

      // Находим цель
      const targetId = (enemy as any).targetPlayerId;
      let target = p;
      if (targetId !== 'local') {
        const found = remotePlayersRef.current.get(targetId);
        if (found && found.limbs[LimbType.TORSO].exists) {
          target = found;
        } else {
          target = p; // Fallback на локального игрока
        }
      }

      const dx = target.x + target.width / 2 - enemy.x;
      const dy = target.y + target.height / 2 - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const desired = 250 + Math.sin(Date.now() / 1000 + idx) * 50;

      // На клиенте пропускаем обновление позиции, если есть активная интерполяция
      const hasActiveInterpolation = !isHost && isMultiplayer && (enemy as any).id && enemyInterpolationRef.current.has((enemy as any).id);

      if (!hasActiveInterpolation) {
        if (dist > desired + 50) {
          enemy.vx += Math.cos(angle) * 0.35;
          enemy.vy += Math.sin(angle) * 0.35;
        } else if (dist < desired - 50) {
          enemy.vx -= Math.cos(angle) * 0.17;
          enemy.vy -= Math.sin(angle) * 0.17;
        }
        enemy.vx *= 0.94;
        enemy.vy *= 0.94;
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
      }

      // Стрельба по цели
      if (Date.now() - enemy.lastFired > enemy.fireRate && dist < 800) {
        const pool = (Object.values(target.limbs) as Limb[]).filter(l => l.exists).map(l => l.type);
        s.projectiles.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          vx: Math.cos(angle) * 8,
          vy: Math.sin(angle) * 8,
          width: 8, height: 8,
          owner: 'ENEMY',
          damage: 8,
          color: COLORS.ENEMY,
          targetLimb: pool[Math.floor(Math.random() * pool.length)]
        });
        enemy.lastFired = Date.now();
      }
    });

    // Обновление снарядов
    s.projectiles = s.projectiles.filter((proj) => {
      proj.x += proj.vx;
      proj.y += proj.vy;
      if (Math.abs(proj.x - p.x) > 2000) return false;

      if (proj.owner === 'ENEMY') {
        if (proj.x > p.x && proj.x < p.x + p.width && proj.y > p.y && proj.y < p.y + p.height) {
          const limbKey = proj.targetLimb || LimbType.TORSO;
          const limb = p.limbs[limbKey];
          if (limb.exists) {
            let finalDamage = proj.damage * (limb.damageMultiplier || 1.0);
            if (limbKey === LimbType.TORSO || limbKey === LimbType.HEAD) {
              const activeLimbs = [LimbType.LEFT_ARM, LimbType.RIGHT_ARM, LimbType.LEFT_LEG, LimbType.RIGHT_LEG].filter(t => p.limbs[t].exists).length;
              finalDamage *= (1 - activeLimbs * 0.15);
              spawnVFX(proj.x, proj.y, COLORS.PLAYER, 12);
            } else {
              spawnVFX(proj.x, proj.y, proj.color, 8);
            }
            limb.hp -= finalDamage;
            p.stunTimer = 12;
            p.vx += proj.vx * 1.2;
            if (limb.hp <= 0) {
              limb.exists = false;
              if (limbKey === LimbType.TORSO || limbKey === LimbType.HEAD) {
                s.gameOver = true;
              }
            }
          }
          return false;
        }
      } else if (proj.owner === 'PLAYER' || proj.owner === 'REMOTE_PLAYER') {
        // Проверяем попадание по врагам
        for (let i = s.enemies.length - 1; i >= 0; i--) {
          const e = s.enemies[i];
          if (proj.x > e.x && proj.x < e.x + e.width && proj.y > e.y && proj.y < e.y + e.height) {
            e.hp -= proj.damage;
            spawnVFX(proj.x, proj.y, proj.color, 20);
            if (e.hp <= 0) {
              s.enemies.splice(i, 1);
              s.score += 150;
            }
            return false;
          }
        }

        // Friendly fire: проверяем попадание по другим игрокам в мультиплеере
        if (isMultiplayer) {
          for (const [id, target] of remotePlayersRef.current) {
            // Определяем владельца пули
            let ownerId: string;
            if (proj.owner === 'PLAYER') {
              ownerId = localPlayerId;
            } else if (proj.owner === 'REMOTE_PLAYER') {
              ownerId = (proj as any).ownerId;
              if (!ownerId) continue; // Нет ID - пропускаем
            } else {
              continue;
            }

            // Пропускаем если пуля принадлежит этому игроку (нельзя себя ранить)
            if (ownerId === id) continue;

            // Проверка попадания
            if (proj.x > target.x && proj.x < target.x + target.width &&
                proj.y > target.y && proj.y < target.y + target.height) {
              // Выбираем случайную конечность для попадания
              const limbs = Object.entries(target.limbs).filter(([_, l]: [string, any]) => l.exists);
              if (limbs.length > 0) {
                const [limbKey, limb] = limbs[Math.floor(Math.random() * limbs.length)] as [LimbType, Limb];

                let finalDamage = proj.damage * (limb.damageMultiplier || 1.0);
                if (limbKey === LimbType.TORSO || limbKey === LimbType.HEAD) {
                  const activeLimbs = [LimbType.LEFT_ARM, LimbType.RIGHT_ARM, LimbType.LEFT_LEG, LimbType.RIGHT_LEG]
                    .filter(t => target.limbs[t].exists).length;
                  finalDamage *= (1 - activeLimbs * 0.15);
                }

                limb.hp -= finalDamage;

                // Отправляем сообщение о повреждении
                if (proj.owner === 'PLAYER' && webrtcManager?.isConnected()) {
                  webrtcManager.send({
                    type: 'PLAYER_DAMAGE',
                    playerId: localPlayerId,
                    data: {
                      targetId: id,
                      limbKey,
                      damage: finalDamage
                    },
                    timestamp: Date.now()
                  });
                }

                spawnVFX(proj.x, proj.y, proj.color, 15);
                return false;
              }
            }
          }
        }
      }

      return true;
    });

    s.vfx = s.vfx.filter((v) => { v.life--; return v.life > 0; });

    // Обновление камеры
    const canvas = canvasRef.current;
    if (canvas) {
      s.camera.x += (p.x + p.vx * 10 - canvas.width / 2 - s.camera.x) * 0.08;
      s.camera.y += (p.y + p.vy * 5 - canvas.height / 2 - s.camera.y) * 0.08;
    }

    setHudState({ ...s });

    // Отправляем сетевые обновления
    sendNetworkUpdate();
    sendEnemySync();
  };

  const drawPlayer = (
    ctx: CanvasRenderingContext2D,
    p: Robot | RemotePlayer,
    color: string,
    isLocal: boolean
  ) => {
    const isCrouching = isLocal ? (keys.current['KeyS'] || keys.current['ArrowDown']) : false;
    const crouchOff = isCrouching ? p.height * 0.2 : 0;
    const headOff = isCrouching ? 8 : 0;
    const centerX = p.x + p.width / 2;
    const centerY = p.y + p.height / 2 - 5;
    const hipY = centerY + 10;

    const drawLimb = (type: LimbType, px: number, py: number, lw: number, lh: number, ang: number, col: string) => {
      if (!p.limbs[type].exists) return;
      ctx.save();
      ctx.translate(px, py);
      if (type.includes('ARM')) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = col;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.rotate(ang);
      ctx.fillStyle = (p as any).stunTimer > 0 ? '#ff4444' : col;
      ctx.beginPath();
      ctx.roundRect(0, -lh / 2, lw, lh, 6);
      ctx.fill();
      ctx.restore();
    };

    const time = Date.now() / 120;
    const walk = Math.abs(p.vx) > 0.5 ? Math.sin(time) * 0.6 : 0;
    const onGround = (p as any).onGround ?? true;
    const jump = !onGround ? (p.vy < 0 ? -0.4 : 0.4) : 0;

    // Рисуем ноги
    drawLimb(LimbType.LEFT_LEG, centerX - 8, hipY, 25, 10, Math.PI / 2 + walk + jump, color);
    drawLimb(LimbType.RIGHT_LEG, centerX + 8, hipY, 25, 10, Math.PI / 2 - walk + jump, color);

    ctx.save();
    ctx.translate(centerX, hipY);
    if (!p.limbs.LEFT_LEG.exists && p.limbs.RIGHT_LEG.exists) ctx.rotate(-0.15);
    else if (p.limbs.LEFT_LEG.exists && !p.limbs.RIGHT_LEG.exists) ctx.rotate(0.15);
    ctx.translate(-centerX, -hipY + crouchOff);

    // Торс
    if (p.limbs[LimbType.TORSO].exists) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fillStyle = (p as any).stunTimer > 0 ? '#ff4444' : color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Голова
    if (p.limbs[LimbType.HEAD].exists) {
      const hY = centerY - 32 + headOff;
      ctx.save();
      ctx.translate(centerX, hY + 16);
      if (isCrouching && isLocal) ctx.rotate(0.1);
      ctx.translate(-centerX, -(hY + 16));
      ctx.fillStyle = (p as any).stunTimer > 0 ? '#ff4444' : color;
      ctx.beginPath();
      ctx.roundRect(centerX - 10, hY, 20, 16, 8);
      ctx.fill();
      ctx.restore();
    }

    // Руки
    drawLimb(LimbType.LEFT_ARM, centerX - 15, centerY - 7, 28, 12, p.facing, p.leftWeapon.color);
    drawLimb(LimbType.RIGHT_ARM, centerX + 15, centerY - 7, 28, 12, p.facing, p.rightWeapon.color);

    ctx.restore();

    // Имя игрока для удалённых
    if (!isLocal) {
      ctx.fillStyle = (p as RemotePlayer).color;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('P2', centerX, p.y - 15);
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    const p = s.player;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.translate(-s.camera.x, -s.camera.y);

    // Фоновая сетка
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    const startX = Math.floor(s.camera.x / 100) * 100;
    const startY = Math.floor(s.camera.y / 100) * 100;
    for (let x = startX; x < startX + ctx.canvas.width + 100; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + ctx.canvas.height + 100);
      ctx.stroke();
    }
    for (let y = startY; y < startY + ctx.canvas.height + 100; y += 100) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + ctx.canvas.width + 100, y);
      ctx.stroke();
    }

    // Платформы
    s.platforms.forEach((plat) => {
      ctx.fillStyle = COLORS.PLATFORM;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'black';
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    });

    // Удалённые игроки
    remotePlayersRef.current.forEach((remotePlayer) => {
      drawPlayer(ctx, remotePlayer, remotePlayer.color, false);
    });

    // Локальный игрок
    drawPlayer(ctx, p, getPlayerColor(), true);

    // Враги
    s.enemies.forEach((e) => {
      ctx.save();
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
      ctx.rotate(e.vx * 0.05);
      ctx.fillStyle = COLORS.ENEMY;
      ctx.beginPath();
      ctx.roundRect(-e.width / 2, -e.height / 2, e.width, e.height, 8);
      ctx.fill();
      ctx.restore();
    });

    // Снаряды
    s.projectiles.forEach((pr) => {
      ctx.fillStyle = pr.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x + 4, pr.y + 4, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // VFX
    s.vfx.forEach((v) => {
      ctx.globalAlpha = v.life / v.maxLife;
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 20;
      ctx.shadowColor = v.color;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.size * (v.life / v.maxLife), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  };

  // Обработка ESC и P для паузы
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || (e.code === 'KeyP' && !e.repeat)) {
        onPauseToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPauseToggle]);

  useEffect(() => {
    const loop = () => {
      update();
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx);
      requestRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener('keydown', e => { keys.current[e.code] = true; });
    window.addEventListener('keyup', e => { keys.current[e.code] = false; });
    window.addEventListener('mousemove', e => { mouse.current.x = e.clientX; mouse.current.y = e.clientY; });
    window.addEventListener('mousedown', e => { if (e.button === 0) mouse.current.left = true; if (e.button === 2) mouse.current.right = true; });
    window.addEventListener('mouseup', e => { if (e.button === 0) mouse.current.left = false; if (e.button === 2) mouse.current.right = false; });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } });

    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const handleRestart = useCallback(() => {
    const s = stateRef.current;
    const ground = s.platforms[0];
    const spawnX = ground.x + 100 + Math.random() * (ground.width - 200);
    const spawnY = ground.y - 100;

    s.player = getDefaultPlayerState();
    s.player.x = spawnX;
    s.player.y = spawnY;
    s.enemies = [];
    s.projectiles = [];
    s.vfx = [];
    s.score = 0;
    s.gameOver = false;
    s.camera = { x: spawnX - window.innerWidth / 2, y: spawnY - window.innerHeight / 2 };
    setHudState({ ...s });

    if (isMultiplayer && webrtcManager && isHost) {
      const realPlayerId = webrtcManager.getPeerId();
      webrtcManager.send({
        type: 'GAME_START',
        playerId: realPlayerId,
        data: { spawnX, spawnY },
        timestamp: Date.now()
      });
    }
  }, [isMultiplayer, webrtcManager, isHost]);

  return (
    <>
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="flex-grow" />
      <HUD
        state={hudState}
        onRestart={handleRestart}
        isPaused={isPaused}
        globalPaused={globalPaused}
        isMultiplayer={isMultiplayer}
        isHost={isHost}
        connectionStatus={connectionStatus}
        onBackToMenu={onBackToMenu}
        onNameChange={onNameChange}
        localPlayerName={localPlayerName}
        connectedPlayers={connectedPlayers}
      />
    </>
  );
};

export default GameCanvas;
