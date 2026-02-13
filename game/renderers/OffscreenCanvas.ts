/**
 * Offscreen canvas для оптимизации отрисовки
 * Статические элементы (платформы, звёзды) рендерятся один раз
 */

export interface OffscreenCache {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  needsUpdate: boolean;
}

/**
 * Создаёт offscreen canvas кэш
 */
export const createOffscreenCache = (): OffscreenCache => ({
  canvas: null,
  ctx: null,
  needsUpdate: true
});

/**
 * Инициализирует offscreen canvas
 */
export const initOffscreenCanvas = (
  cache: OffscreenCache,
  width: number,
  height: number
): void => {
  if (cache.canvas) return;

  cache.canvas = document.createElement('canvas');
  cache.canvas.width = width;
  cache.canvas.height = height;
  cache.ctx = cache.canvas.getContext('2d');
  cache.needsUpdate = true;
};

/**
 * Отрисовывает статичные элементы в offscreen canvas
 */
export const renderStaticElements = (
  cache: OffscreenCache,
  drawCallback: (ctx: CanvasRenderingContext2D) => void
): void => {
  if (!cache.ctx || !cache.needsUpdate) return;

  const ctx = cache.ctx!;
  ctx.clearRect(0, 0, cache.canvas!.width, cache.canvas!.height);

  drawCallback(ctx);
  cache.needsUpdate = false;
};

/**
 * Рисует кэшированные элементы на основном canvas
 */
export const drawCachedElements = (
  targetCtx: CanvasRenderingContext2D,
  cache: OffscreenCache,
  x: number,
  y: number
): void => {
  if (!cache.canvas) return;

  targetCtx.drawImage(cache.canvas!, x, y);
};

/**
 * Помечает кэш для перерисовки
 */
export const invalidateCache = (cache: OffscreenCache): void => {
  cache.needsUpdate = true;
};

/**
 * Очищает кэш
 */
export const destroyCache = (cache: OffscreenCache): void => {
  if (cache.canvas) {
    cache.canvas = null;
    cache.ctx = null;
  }
  cache.needsUpdate = true;
};

/**
 * Проверяет, инициализирован ли кэш
 */
export const isCacheReady = (cache: OffscreenCache): boolean => {
  return cache.canvas !== null && cache.ctx !== null;
};
