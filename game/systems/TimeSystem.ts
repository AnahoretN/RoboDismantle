/**
 * Система для отслеживания времени и delta time
 * Позволяет игровой физике быть независимой от частоты кадров
 */

export interface TimeState {
  deltaTime: number;      // Время с последнего кадра в секундах
  elapsedMs: number;       // Время с последнего кадра в миллисекундах
  totalTime: number;      // Общее время работы игры
  lastFrameTime: number;  // Время предыдущего кадра
  frameCount: number;     // Счётчик кадров
}

/**
 * Создаёт начальное состояние времени
 */
export const createTimeState = (): TimeState => ({
  deltaTime: 0,
  elapsedMs: 0,
  totalTime: 0,
  lastFrameTime: performance.now(),
  frameCount: 0
});

/**
 * Обновляет состояние времени
 * @param state Текущее состояние времени
 * @param currentTime Текущее время (performance.now())
 * @param maxDeltaTime Максимальный delta time для предотвращ "спираль смерти" (0.1с = 100мс)
 */
export const updateTime = (
  state: TimeState,
  currentTime: number = performance.now(),
  maxDeltaTime: number = 0.1
): TimeState => {
  const elapsedMs = currentTime - state.lastFrameTime;
  const deltaTime = Math.min(elapsedMs / 1000, maxDeltaTime); // Конвертируем в секунды

  return {
    deltaTime,
    elapsedMs,
    totalTime: state.totalTime + deltaTime,
    lastFrameTime: currentTime,
    frameCount: state.frameCount + 1
  };
};

/**
 * Вычисляет множитель для физики на основе delta time
 * Используется для получения frame-rate независимой физики
 * @param deltaTime Delta time в секундах
 * @param targetFPS Целевая частота кадров (по умолчанию 60)
 */
export const getDeltaFactor = (deltaTime: number, targetFPS: number = 60): number => {
  return deltaTime * targetFPS;
};
