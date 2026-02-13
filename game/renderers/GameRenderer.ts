import { Robot, LimbType, Enemy, Projectile, ImpactVFX, DetachedLimb, Star, Platform } from '../../types';
import { COLORS } from '../../constants';

/**
 * Отрисовщик игры - отделяет логику от визуализации
 * Все draw методы принимают CanvasRenderingContext2D и рисуют элементы
 */

/**
 * Рисует конечность робота
 */
export const drawLimb = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  exists: boolean,
  hp: number,
  maxHp: number,
  damageFlashTimer?: number
): void => {
  if (!exists) return;

  ctx.save();
  ctx.fillStyle = color;

  // Мигание красным при получении урона
  if (damageFlashTimer && damageFlashTimer > 0) {
    ctx.fillStyle = '#ff4444';
  }

  // Затемнение если HP мало
  const hpPercent = hp / maxHp;
  if (hpPercent < 0.3) {
    ctx.globalAlpha = 0.6;
  }

  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6);
  ctx.fill();
  ctx.restore();

  // HP бар
  if (hp < maxHp) {
    const barWidth = width + 4;
    const barHeight = 4;
    const barX = x + width / 2 - barWidth / 2;
    const barY = y - 8;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpWidth = barWidth * hpPercent;
    ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : '#ffaa00';
    ctx.fillRect(barX + 1, barY + 1, hpWidth - 2, barHeight - 2);
  }
};

/**
 * Рисует робота (игрока или удалённого)
 */
export const drawRobot = (
  ctx: CanvasRenderingContext2D,
  robot: Robot,
  color: string,
  isLocal: boolean = false
): void => {
  const centerX = robot.x + robot.width / 2;
  const centerY = robot.y + robot.height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);

  // Поворот в сторону цели (только для локального игрока)
  if (isLocal) {
    // facing можно использовать для поворота спрайта
  }

  const p = robot;

  // Правая рука
  const rightArmX = centerX + 7 - 14;
  const rightArmY = centerY - 10 - 6;
  drawLimb(ctx, rightArmX, rightArmY, 28, 12, color, p.limbs.RIGHT_ARM.exists,
    p.limbs.RIGHT_ARM.hp, p.limbs.RIGHT_ARM.maxHp, p.limbs.RIGHT_ARM.damageFlashTimer);

  // Левая рука
  const leftArmX = centerX - 35 - 14;
  const leftArmY = centerY - 10 - 6;
  drawLimb(ctx, leftArmX, leftArmY, 28, 12, color, p.limbs.LEFT_ARM.exists,
    p.limbs.LEFT_ARM.hp, p.limbs.LEFT_ARM.maxHp, p.limbs.LEFT_ARM.damageFlashTimer);

  // Правая нога
  const rightLegX = centerX + 5 - 12.5;
  const rightLegY = centerY + 5 - 5;
  drawLimb(ctx, rightLegX, rightLegY, 25, 10, color, p.limbs.RIGHT_LEG.exists,
    p.limbs.RIGHT_LEG.hp, p.limbs.RIGHT_LEG.maxHp, p.limbs.RIGHT_LEG.damageFlashTimer);

  // Левая нога
  const leftLegX = centerX - 25 - 12.5;
  const leftLegY = centerY + 5 - 5;
  drawLimb(ctx, leftLegX, leftLegY, 25, 10, color, p.limbs.LEFT_LEG.exists,
    p.limbs.LEFT_LEG.hp, p.limbs.LEFT_LEG.maxHp, p.limbs.LEFT_LEG.damageFlashTimer);

  // Тorso
  const torsoX = centerX - 15;
  const torsoY = centerY - 8 - 12.5;
  drawLimb(ctx, torsoX, torsoY, 30, 25, color, p.limbs.TORSO.exists,
    p.limbs.TORSO.hp, p.limbs.TORSO.maxHp, p.limbs.TORSO.damageFlashTimer);

  // Голова
  const headX = centerX - 8;
  const headY = centerY - 22 - 8;
  drawLimb(ctx, headX, headY, 16, 16, color, p.limbs.HEAD.exists,
    p.limbs.HEAD.hp, p.limbs.HEAD.maxHp, p.limbs.HEAD.damageFlashTimer);

  // Линия прицеливания (для локального игрока)
  if (isLocal) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(robot.facing) * 100, Math.sin(robot.facing) * 100);
    ctx.stroke();
  }

  ctx.restore();
};

/**
 * Рисует врага
 */
export const drawEnemy = (
  ctx: CanvasRenderingContext2D,
  enemy: Enemy
): void => {
  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = COLORS.ENEMY;
  ctx.fillStyle = COLORS.ENEMY;
  ctx.beginPath();
  ctx.arc(
    enemy.x + enemy.width / 2,
    enemy.y + enemy.height / 2,
    enemy.width / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Детали (глаза)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(enemy.x + enemy.width / 2 - 5, enemy.y + enemy.height / 2 - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(enemy.x + enemy.width / 2 + 5, enemy.y + enemy.height / 2 - 3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/**
 * Рисует снаряд
 */
export const drawProjectile = (
  ctx: CanvasRenderingContext2D,
  proj: Projectile
): void => {
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = proj.color;
  ctx.fillStyle = proj.color;
  ctx.beginPath();
  ctx.arc(
    proj.x + proj.width / 2,
    proj.y + proj.height / 2,
    proj.width / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
};

/**
 * Рисует платформу
 */
export const drawPlatform = (
  ctx: CanvasRenderingContext2D,
  plat: Platform
): void => {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.PLATFORM;
  ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

  // Неоновая обводка
  ctx.strokeStyle = 'rgba(0, 242, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
  ctx.restore();
};

/**
 * Рисует VFX эффект
 */
export const drawVFX = (
  ctx: CanvasRenderingContext2D,
  vfx: ImpactVFX
): void => {
  const alpha = vfx.life / vfx.maxLife;
  const size = vfx.size * alpha;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = vfx.color;
  ctx.shadowBlur = 15;
  ctx.shadowColor = vfx.color;
  ctx.beginPath();
  ctx.arc(vfx.x, vfx.y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * Рисует оторванную конечность
 */
export const drawDetachedLimb = (
  ctx: CanvasRenderingContext2D,
  limb: DetachedLimb,
  isNearPlayer: boolean
): void => {
  ctx.save();
  ctx.translate(limb.x + limb.width / 2, limb.y + limb.height / 2);
  ctx.rotate(limb.rotation);

  // Сломанные конечности темнее и полупрозрачные
  if (limb.destroyed) {
    ctx.fillStyle = limb.color + '66';
    ctx.globalAlpha = 0.6;
  } else {
    ctx.fillStyle = limb.color;
    ctx.globalAlpha = 1.0;
  }

  ctx.shadowBlur = 10;
  ctx.shadowColor = limb.color;
  ctx.beginPath();
  ctx.roundRect(-limb.width / 2, -limb.height / 2, limb.width, limb.height, 6);
  ctx.fill();
  ctx.restore();

  // Белый кружок над конечностью если рядом и она не сломана
  if (isNearPlayer && !limb.destroyed) {
    const pulse = Math.sin(Date.now() / 200) * 3;
    ctx.save();
    ctx.translate(limb.x + limb.width / 2, limb.y - 15);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 8 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
};

/**
 * Рисует звезду
 */
export const drawStar = (
  ctx: CanvasRenderingContext2D,
  star: Star
): void => {
  if (star.collected) return;

  const pulse = Math.sin(Date.now() / 300) * 0.3 + 1;
  const size = 15 * pulse;

  ctx.save();
  ctx.translate(star.x, star.y);

  // Свечение
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#ffff00';

  // Рисуем звезду
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();

  // 5 лучей
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i;
    const innerSize = size * 0.4;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
  }

  ctx.closePath();
  ctx.fill();

  // Центр
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, innerSize, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/**
 * Очищает canvas
 */
export const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgColor: string = COLORS.BG
): void => {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
};

/**
 * Применяет камеру к контексту
 */
export const applyCamera = (
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number
): void => {
  ctx.translate(-cameraX, -cameraY);
};
