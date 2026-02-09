import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  GameState, Robot, LimbType, Projectile, Enemy, Platform,
  Limb, ImpactVFX, GameMode, RemotePlayer, NetworkMessage, EnemyState
} from '../types';
import {
  GRAVITY, FRICTION, PLAYER_JUMP,
  ROBOT_SIZE, BULLET_SPEED, ARM_MAX_HP, LEG_MAX_HP, TORSO_MAX_HP, HEAD_MAX_HP, COLORS, PLAYER_COLORS
} from '../constants';
import HUD from './HUD';
import { WebRTCManager, generatePlayerId, ConnectionStatus, PlayerInfo } from '../lib/WebRTCManager';

// Карта для хранения интерполированных состояний врагов на стороне гостя
interface InterpolatedEnemy extends Enemy {
  id: string;
  targetX: number;
  targetY: number;
  lastUpdate: number;
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
  const lastEnemySync = useRef<number>(0);
  const enemyIdCounter = useRef<number>(0);

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
          const { id, x, y, vx, vy, facing, limbs } = message.data;
          const existing = remotePlayersRef.current.get(id);

          if (existing) {
            // Интерполяция для плавности
            existing.x = x;
            existing.y = y;
            existing.vx = vx;
            existing.vy = vy;
            existing.facing = facing;
            if (limbs) {
              Object.entries(limbs).forEach(([key, limbData]: [string, any]) => {
                if (existing.limbs[key as LimbType]) {
                  existing.limbs[key as LimbType] = limbData;
                }
              });
            }
          } else {
            // Создаём нового удалённого игрока
            const newPlayer: RemotePlayer = {
              ...getDefaultPlayerState(),
              id,
              color: PLAYER_COLORS[Math.min(connectedPlayers.length, 3)], // Цвет по порядку
              x, y, vx, vy, facing,
              limbs: limbs || getDefaultPlayerState().limbs
            };
            remotePlayersRef.current.set(id, newPlayer);
          }
          break;
        }

        case 'PROJECTILE_FIRED': {
          const { x, y, vx, vy, color } = message.data;
          s.projectiles.push({
            x, y, vx, vy,
            width: 8, height: 8,
            owner: 'REMOTE_PLAYER',
            damage: 10,
            color
          });
          break;
        }

        case 'PLAYER_DIED':
        case 'PLAYER_DISCONNECTED': {
          const { id } = message.data;
          remotePlayersRef.current.delete(id);
          break;
        }

        case 'PLAYER_JOINED': {
          // Новый игрок подключился
          const { id, name, color } = message.data;
          if (!remotePlayersRef.current.has(id)) {
            const newPlayer: RemotePlayer = {
              ...getDefaultPlayerState(),
              id,
              color: color || PLAYER_COLORS[1],
              x: 100, y: 300, // Начальная позиция
              vx: 0, vy: 0, facing: 0,
              limbs: getDefaultPlayerState().limbs
            };
            remotePlayersRef.current.set(id, newPlayer);
          }
          break;
        }

        case 'PAUSE_TOGGLE': {
          // Пауза обрабатывается в App.tsx
          break;
        }

        case 'GAME_START': {
          // Хост начал игру - все игроки respawn
          const ground = s.platforms[0];
          // Каждый игрок получает случайную точку на платформе
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

        case 'ENEMY_UPDATE': {
          // Обновление состояния врагов от хоста (для гостей)
          if (!isHost) {
            const { enemies } = message.data;
            const enemyMap = new Map<string, InterpolatedEnemy>();

            // Создаём карту существующих врагов
            s.enemies.forEach((e: any) => {
              if (e.id) enemyMap.set(e.id, e);
            });

            // Обновляем или создаём врагов
            enemies.forEach((enemyData: EnemyState) => {
              const existing = enemyMap.get(enemyData.id);
              if (existing) {
                // Обновляем целевую позицию для интерполяции
                existing.targetX = enemyData.x;
                existing.targetY = enemyData.y;
                existing.x = enemyData.x; // Для простоты используем прямую позицию
                existing.y = enemyData.y;
                existing.vx = enemyData.vx;
                existing.vy = enemyData.vy;
                existing.hp = enemyData.hp;
                existing.lastFired = enemyData.lastFired;
                existing.lastUpdate = Date.now();
              } else {
                // Создаём нового врага
                const newEnemy: InterpolatedEnemy = {
                  ...enemyData,
                  id: enemyData.id,
                  targetX: enemyData.x,
                  targetY: enemyData.y,
                  lastUpdate: Date.now()
                };
                s.enemies.push(newEnemy as any);
              }
            });

            // Удаляем врагов, которых больше нет на хосте
            const receivedIds = new Set(enemies.map((e: EnemyState) => e.id));
            s.enemies = s.enemies.filter((e: any) => !e.id || receivedIds.has(e.id));
          }
          break;
        }

        case 'ENEMY_SPAWN': {
          // Спавн нового врага от хоста
          if (!isHost) {
            const { enemy } = message.data;
            const newEnemy: InterpolatedEnemy = {
              ...enemy,
              id: enemy.id,
              targetX: enemy.x,
              targetY: enemy.y,
              lastUpdate: Date.now()
            };
            s.enemies.push(newEnemy as any);
          }
          break;
        }

        case 'FULL_SYNC': {
          // Полная синхронизация состояния игры от хоста
          if (!isHost) {
            const { enemies, score } = message.data;

            // Синхронизируем врагов
            s.enemies = enemies.map((e: EnemyState) => ({
              ...e,
              targetX: e.x,
              targetY: e.y,
              lastUpdate: Date.now()
            } as any));

            // Синхронизируем счёт (опционально)
            if (score !== undefined) {
              s.score = score;
            }
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
      // Подписываемся на изменения списка игроков
      webrtcManager.onPlayerListChange((players) => {
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
    const enemy: Enemy & { id: string } = {
      id: enemyId,
      x: spawnX, y: spawnY, width: 35, height: 35, vx: 0, vy: 0,
      hp: 30, type: 'DRONE', lastFired: Date.now(), fireRate: 1500 + Math.random() * 1000
    };
    s.enemies.push(enemy);

    // В мультиплеере отправляем информацию о новом враге
    if (isMultiplayer && isHost && webrtcManager?.isConnected()) {
      const realPlayerId = webrtcManager.getPeerId();
      webrtcManager.send({
        type: 'ENEMY_SPAWN',
        playerId: realPlayerId,
        data: {
          enemy: {
            id: enemyId,
            x: spawnX,
            y: spawnY,
            width: 35,
            height: 35,
            vx: 0,
            vy: 0,
            hp: 30,
            type: 'DRONE',
            lastFired: enemy.lastFired,
            fireRate: enemy.fireRate
          }
        },
        timestamp: Date.now()
      });
    }
  };

  // Отправка обновления позиции по сети
  const sendNetworkUpdate = useCallback(() => {
    if (!webrtcManager || !webrtcManager.isConnected()) return;

    const now = Date.now();
    if (now - lastNetworkUpdate.current < 50) return; // Максимум 20 обновлений в секунду
    lastNetworkUpdate.current = now;

    const p = stateRef.current.player;
    // Используем реальный peer ID из WebRTCManager
    const realPlayerId = webrtcManager.getPeerId();

    webrtcManager.send({
      type: 'PLAYER_UPDATE',
      playerId: realPlayerId,
      data: {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        limbs: p.limbs
      },
      timestamp: now
    });
  }, [webrtcManager]);

  // Отправка состояния врагов по сети (только для хоста)
  const sendEnemyUpdate = useCallback(() => {
    if (!webrtcManager || !webrtcManager.isConnected() || !isHost) return;

    const now = Date.now();
    if (now - lastEnemySync.current < 100) return; // Максимум 10 обновлений в секунду для врагов
    lastEnemySync.current = now;

    const s = stateRef.current;
    const realPlayerId = webrtcManager.getPeerId();

    // Подготавливаем данные врагов для отправки
    const enemiesData: EnemyState[] = s.enemies.map((e: any) => ({
      id: e.id || 'unknown',
      x: e.x,
      y: e.y,
      vx: e.vx,
      vy: e.vy,
      width: e.width,
      height: e.height,
      hp: e.hp,
      type: e.type,
      lastFired: e.lastFired,
      fireRate: e.fireRate
    }));

    webrtcManager.send({
      type: 'ENEMY_UPDATE',
      playerId: realPlayerId,
      data: { enemies: enemiesData },
      timestamp: now
    });
  }, [webrtcManager, isHost]);

  const update = () => {
    const s = stateRef.current;

    // Проверка паузы - при пауза всё замирает (даже враги и снаряды)
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
    lastKeys.current = { ...keys.current };
    p.vx *= FRICTION;
    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;

    // Death void
    if (p.y > 1500) {
      s.gameOver = true;
      p.limbs[LimbType.TORSO].hp = 0;
      p.limbs[LimbType.TORSO].exists = false;

      // Уведомляем о смерти
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
    s.platforms.forEach(plat => {
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

    // Стрельба
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const worldMouseX = mouse.current.x - rect.left + s.camera.x;
      const worldMouseY = mouse.current.y - rect.top + s.camera.y;
      const shoulderY = p.y + p.height / 2 - 12 + (isCrouching ? p.height * 0.2 : 0);
      p.facing = Math.atan2(worldMouseY - shoulderY, worldMouseX - (p.x + p.width / 2));
      const now = Date.now();

      // Левая рука
      if (mouse.current.left && p.limbs.LEFT_ARM.exists && now - p.leftWeapon.lastFired > p.leftWeapon.cooldown) {
        const projX = p.x + p.width / 2 - 15 + Math.cos(p.facing) * 28;
        const projY = shoulderY + Math.sin(p.facing) * 28;
        const projVx = Math.cos(p.facing) * BULLET_SPEED;
        const projVy = Math.sin(p.facing) * BULLET_SPEED;

        s.projectiles.push({
          x: projX, y: projY, vx: projVx, vy: projVy,
          width: 8, height: 8, owner: 'PLAYER', damage: 10, color: p.leftWeapon.color
        });
        p.leftWeapon.lastFired = now;

        // Отправляем информацию о выстреле в мультиплеере
        if (webrtcManager?.isConnected()) {
          const realPlayerId = webrtcManager.getPeerId();
          webrtcManager.send({
            type: 'PROJECTILE_FIRED',
            playerId: realPlayerId,
            data: { x: projX, y: projY, vx: projVx, vy: projVy, color: p.leftWeapon.color },
            timestamp: now
          });
        }
      }

      // Правая рука
      if (mouse.current.right && p.limbs.RIGHT_ARM.exists && now - p.rightWeapon.lastFired > p.rightWeapon.cooldown) {
        const projX = p.x + p.width / 2 + 15 + Math.cos(p.facing) * 28;
        const projY = shoulderY + Math.sin(p.facing) * 28;
        const projVx = Math.cos(p.facing) * BULLET_SPEED;
        const projVy = Math.sin(p.facing) * BULLET_SPEED;

        s.projectiles.push({
          x: projX, y: projY, vx: projVx, vy: projVy,
          width: 8, height: 8, owner: 'PLAYER', damage: 10, color: p.rightWeapon.color
        });
        p.rightWeapon.lastFired = now;

        // Отправляем информацию о выстреле в мультиплеере
        if (webrtcManager?.isConnected()) {
          const realPlayerId = webrtcManager.getPeerId();
          webrtcManager.send({
            type: 'PROJECTILE_FIRED',
            playerId: realPlayerId,
            data: { x: projX, y: projY, vx: projVx, vy: projVy, color: p.rightWeapon.color },
            timestamp: now
          });
        }
      }
    }

    // Спавн врагов (только для одиночной игры и хоста)
    if (gameMode === GameMode.SINGLE_PLAYER || isHost) {
      if (s.enemies.length < 5 + Math.floor(s.score / 2000) && Math.random() < 0.02) {
        spawnEnemy();
      }

      // Обновление врагов (только хост вычисляет AI)
      s.enemies.forEach((enemy, idx) => {
        const dx = p.x + p.width / 2 - enemy.x;
        const dy = p.y + p.height / 2 - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const desired = 250 + Math.sin(Date.now() / 1000 + idx) * 50;

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

        if (Date.now() - enemy.lastFired > enemy.fireRate && dist < 800) {
          const pool = (Object.values(p.limbs) as Limb[]).filter(l => l.exists).map(l => l.type);
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
    }

    // Обновление снарядов
    s.projectiles = s.projectiles.filter(proj => {
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
      }

      return true;
    });

    s.vfx = s.vfx.filter(v => { v.life--; return v.life > 0; });

    // Обновление камеры
    const canvas = canvasRef.current;
    if (canvas) {
      s.camera.x += (p.x + p.vx * 10 - canvas.width / 2 - s.camera.x) * 0.08;
      s.camera.y += (p.y + p.vy * 5 - canvas.height / 2 - s.camera.y) * 0.08;
    }

    setHudState({ ...s });

    // Отправляем сетевое обновление
    sendNetworkUpdate();
    sendEnemyUpdate(); // Отправляем состояние врагов (только хост)
  };

  const drawPlayer = (
    ctx: CanvasRenderingContext2D,
    p: Robot | RemotePlayer,
    color: string,
    isLocal: boolean
  ) => {
    const isCrouching = keys.current['KeyS'] || keys.current['ArrowDown'];
    const crouchOff = isCrouching && isLocal ? p.height * 0.2 : 0;
    const headOff = isCrouching && isLocal ? 8 : 0;
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
    const jump = !(p as any).onGround ? (p.vy < 0 ? -0.4 : 0.4) : 0;

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
      ctx.fillStyle = color;
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
    s.platforms.forEach(plat => {
      ctx.fillStyle = COLORS.PLATFORM;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'black';
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    });

    // Удалённые игроки
    remotePlayersRef.current.forEach(remotePlayer => {
      drawPlayer(ctx, remotePlayer, remotePlayer.color, false);
    });

    // Локальный игрок
    drawPlayer(ctx, p, getPlayerColor(), true);

    // Враги
    s.enemies.forEach(e => {
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
    s.projectiles.forEach(pr => {
      ctx.fillStyle = pr.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x + 4, pr.y + 4, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // VFX
    s.vfx.forEach(v => {
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
    // Случайная точка спавна на нижней платформе
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

    // В мультиплеере отправляем сигнал о рестарте
    if (isMultiplayer && webrtcManager && isHost) {
      const realPlayerId = webrtcManager.getPeerId();
      webrtcManager.send({
        type: 'GAME_START',
        playerId: realPlayerId,
        data: { spawnX, spawnY }, // Хост сообщает свою точку спавна
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
