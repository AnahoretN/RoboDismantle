import { Robot, LimbType } from '../../types';
import {
  GRAVITY,
  FRICTION,
  PLAYER_SPEED,
  PLAYER_JUMP,
  ACCELERATION_TIME,
  ACCELERATION_FACTOR,
  STUN_JUMP_MULTIPLIER,
  STUN_SPEED_MULTIPLIER,
  CROUCH_SPEED_MULTIPLIER,
  ONE_LEG_SPEED_MULTIPLIER,
  NO_LEGS_SPEED_MULTIPLIER,
  NO_LEGS_HOP_CHANCE,
  NO_LEGS_HOP_VELOCITY,
  NO_LEGS_HOP_THRESHOLD,
  DEATH_VOID_Y
} from '../../constants';

/**
 * Состояние ввода для движения игрока
 */
export interface MovementInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  justJumped: boolean;  // Прыжок только что нажат
  crouch: boolean;
}

/**
 * Обновляет физику игрока
 * @param player Игрок
 * @param input Состояние ввода
 * @param deltaMultiplier Множитель delta time
 * @param onGroundCallback Колбэк для установки onGround
 */
export const updatePlayerPhysics = (
  player: Robot,
  input: MovementInput,
  deltaMultiplier: number = 1,
  onGroundCallback?: () => void
): void => {
  // Уменьшаем таймер оглушения
  if (player.stunTimer > 0) {
    player.stunTimer -= 1 * deltaMultiplier;
  }

  const isCrouching = input.crouch;
  const stunSpeedFactor = player.stunTimer > 0 ? STUN_SPEED_MULTIPLIER : 1;
  const legsCount = [
    player.limbs.LEFT_LEG.exists,
    player.limbs.RIGHT_LEG.exists
  ].filter(Boolean).length;
  const noLegs = legsCount === 0;

  // Вычисляем множитель скорости
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
  if (input.justJumped && player.onGround && legsCount > 0) {
    player.vy = PLAYER_JUMP * (player.stunTimer > 0 ? STUN_JUMP_MULTIPLIER : 1);
    player.onGround = false;
  }

  // Автоматические маленькие прыжки когда нет ног
  if (noLegs && player.onGround && Math.abs(player.vx) > NO_LEGS_HOP_THRESHOLD) {
    if (Math.random() < NO_LEGS_HOP_CHANCE) {
      player.vy = NO_LEGS_HOP_VELOCITY;
      player.onGround = false;
    }
  }

  // Применяем трение и гравитацию
  player.vx *= FRICTION;
  player.vy += GRAVITY * deltaMultiplier;

  // Применяем скорость
  player.x += player.vx * deltaMultiplier;
  player.y += player.vy * deltaMultiplier;

  // Проверка смерти (падение в пустоту)
  if (player.y > DEATH_VOID_Y) {
    // Обрабатывается в основном коде
  }

  // Уведомляем если на земле
  if (player.onGround && onGroundCallback) {
    onGroundCallback();
  }
};

/**
 * Применяет физику к каждому finality (damage flash timer)
 */
export const updateLimbsState = (player: Robot, deltaMultiplier: number = 1): void => {
  Object.values(player.limbs).forEach(limb => {
    if (limb.damageFlashTimer && limb.damageFlashTimer > 0) {
      limb.damageFlashTimer -= 1 * deltaMultiplier;
    }
  });
};
