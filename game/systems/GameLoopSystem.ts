import { TimeState, createTimeState, updateTime } from './TimeSystem';
import { createPerformanceMonitor, startFrame, endFrame } from './PerformanceMonitor';

/**
 * Игровой цикл с отслеживанием производительности
 * Управляет requestAnimationFrame и delta time
 */

export interface GameLoopConfig {
  onUpdate: (deltaTime: number, deltaMultiplier: number) => void;
  onRender?: () => void;
  targetFPS?: number;
}

export class GameLoop {
  private animationId: number | null = null;
  private isRunning: boolean = false;
  private timeState: TimeState;
  private performance = createPerformanceMonitor();
  private targetFPS: number;

  constructor(config: GameLoopConfig) {
    this.timeState = createTimeState();
    this.targetFPS = config.targetFPS || 60;
    this.onUpdate = config.onUpdate;
    this.onRender = config.onRender;
  }

  private onUpdate: (deltaTime: number, deltaMultiplier: number) => void;
  private onRender?: () => void;

  /**
   * Запускает игровой цикл
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.performance = createPerformanceMonitor();
    this.loop();
  }

  /**
   * Останавливает игровой цикл
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Главный цикл
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    // Начинаем измерение кадра
    startFrame(this.performance);
    const currentTime = performance.now();

    // Обновляем время
    this.timeState = updateTime(this.timeState, currentTime);

    // Вычисляем множитель для физики (нормализуем к 60 FPS)
    const deltaMultiplier = (this.timeState.deltaTime * this.targetFPS);

    // Обновление игры
    this.onUpdate(this.timeState.deltaTime, deltaMultiplier);

    // Отрисовка
    if (this.onRender) {
      this.onRender();
    }

    // Завершаем измерение кадра
    const metrics = endFrame(this.performance);

    // Логируем проблемы с производительностью
    if (metrics.isLagging) {
      console.warn(`[GameLoop] Frame time: ${metrics.frameTime.toFixed(2)}ms, FPS: ${metrics.fps}`);
    }

    // Планируем следующий кадр
    this.animationId = requestAnimationFrame(() => this.loop());
  };

  /**
   * Получает текущее состояние времени
   */
  getTimeState(): TimeState {
    return this.timeState;
  }

  /**
   * Получает метрики производительности
   */
  getMetrics() {
    return this.performance.metrics;
  }

  /**
   * Сбрасывает состояние времени (например, после паузы)
   */
  resetTime(): void {
    this.timeState = createTimeState();
  }
}

/**
 * Создаёт настроенный игровой цикл
 */
export const createGameLoop = (config: GameLoopConfig): GameLoop => {
  return new GameLoop(config);
};
