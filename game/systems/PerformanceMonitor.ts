/**
 * Система для мониторинга производительности игры
 * Отслеживает FPS, время кадра и выявляет проблемы
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  deltaTime: number;
  isLagging: boolean;
}

export interface PerformanceMonitor {
  metrics: PerformanceMetrics;
  frameCount: number;
  lastFpsUpdate: number;
  fpsAccumulator: number;
  lastFrameTime: number;
}

/**
 * Создаёт монитор производительности
 */
export const createPerformanceMonitor = (): PerformanceMonitor => ({
  metrics: {
    fps: 60,
    frameTime: 16.67,
    deltaTime: 16.67,
    isLagging: false
  },
  frameCount: 0,
  lastFpsUpdate: performance.now(),
  fpsAccumulator: 0,
  lastFrameTime: performance.now()
});

/**
 * Обновляет метрики производительности
 * Должен вызываться в начале каждого кадра
 */
export const startFrame = (monitor: PerformanceMonitor): void => {
  monitor.lastFrameTime = performance.now();
};

/**
 * Завершает кадр и обновляет метрики
 * Должен вызываться в конце каждого кадра
 */
export const endFrame = (monitor: PerformanceMonitor): PerformanceMetrics => {
  const now = performance.now();
  const frameTime = now - monitor.lastFrameTime;
  monitor.frameCount++;

  // Обновляем FPS раз в секунду
  if (now - monitor.lastFpsUpdate >= 1000) {
    monitor.metrics.fps = Math.round((monitor.frameCount * 1000) / (now - monitor.lastFpsUpdate));
    monitor.lastFpsUpdate = now;
    monitor.frameCount = 0;

    // Логируем если FPS низкий
    if (monitor.metrics.fps < 30) {
      console.warn(`[Performance] Low FPS: ${monitor.metrics.fps}, frame time: ${frameTime.toFixed(2)}ms`);
    }
  }

  monitor.metrics.frameTime = frameTime;
  monitor.metrics.deltaTime = frameTime;
  monitor.metrics.isLagging = frameTime > 33.33; // < 30 FPS

  return monitor.metrics;
};

/**
 * Получает текущие метрики
 */
export const getMetrics = (monitor: PerformanceMonitor): PerformanceMetrics => {
  return monitor.metrics;
};

/**
 * Сбрасывает монитор
 */
export const resetMonitor = (monitor: PerformanceMonitor): void => {
  monitor.frameCount = 0;
  monitor.lastFpsUpdate = performance.now();
  monitor.fpsAccumulator = 0;
  monitor.lastFrameTime = performance.now();
};
