/**
 * Система dirty regions для оптимизации отрисовки
 * Отслеживает какие области canvas нужно перерисовать
 */

export interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DirtyRegionManager {
  private dirtyRegions: DirtyRect[] = [];
  private fullRedraw = true;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  /**
   * Помечает весь canvas для перерисовки
   */
  markFullRedraw(): void {
    this.fullRedraw = true;
  }

  /**
   * Помечает прямоугольную область как грязную
   */
  markDirty(x: number, y: number, width: number, height: number): void {
    // Нормализуем координаты
    const rect = {
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.ceil(width),
      height: Math.ceil(height)
    };

    // Проверяем пересечение с существующими грязными регионами
    // Если пересекаются, объединяем
    const merged = this.mergeOrAdd(rect);
    if (merged) {
      this.dirtyRegions = merged;
    }
  }

  /**
   * Объединяет прямоугольники если они пересекаются
   */
  private mergeOrAdd(newRect: DirtyRect): DirtyRect[] | null {
    let merged = [...this.dirtyRegions];
    let didMerge = false;

    // Пытаемся объединить с существующими
    for (let i = merged.length - 1; i >= 0; i--) {
      const existing = merged[i];
      const mergedRect = this.tryMerge(existing, newRect);
      if (mergedRect) {
        merged[i] = mergedRect;
        didMerge = true;
        break;
      }
    }

    if (!didMerge) {
      merged.push(newRect);
    }

    return merged.length > 0 ? merged : null;
  }

  /**
   * Пытается объединить два прямоугольника
   */
  private tryMerge(a: DirtyRect, b: DirtyRect): DirtyRect | null {
    const merged = this.getBoundingRect(a, b);
    const aArea = a.width * a.height;
    const bArea = b.width * b.height;
    const mergedArea = merged.width * merged.height;

    // Если объединённая площадь не намного больше суммы - объединяем
    if (mergedArea <= aArea + bArea * 1.2) {
      return merged;
    }
    return null;
  }

  /**
   * Получает ограничивающий прямоугольник для двух
   */
  private getBoundingRect(a: DirtyRect, b: DirtyRect): DirtyRect {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
      height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y)
    };
  }

  /**
   * Проверяет, нужно ли рисовать весь canvas
   */
  shouldRedrawAll(): boolean {
    return this.fullRedraw;
  }

  /**
   * Получает грязные регионы для отрисовки
   */
  getDirtyRegions(): DirtyRect[] {
    if (this.fullRedraw) {
      this.fullRedraw = false;
      this.dirtyRegions = [];
      return null; // null означает полная перерисовку
    }
    return this.dirtyRegions;
  }

  /**
   * Проверяет, пуст ли список грязных регионов
   */
  isClean(): boolean {
    return this.dirtyRegions.length === 0 && !this.fullRedraw;
  }

  /**
   * Сбрасывает грязные регионы
   */
  clear(): void {
    this.dirtyRegions = [];
    this.fullRedraw = false;
  }

  /**
   * Проверяет, попадает ли точка в грязный регион
   */
  isPointDirty(x: number, y: number): boolean {
    return this.dirtyRegions.some(region =>
      x >= region.x && x <= region.x + region.width &&
      y >= region.y && y <= region.y + region.height
    );
  }
}

/**
 * Создаёт менеджер грязных регионов
 */
export const createDirtyRegionManager = (
  canvasWidth: number,
  canvasHeight: number
): DirtyRegionManager => {
  return new DirtyRegionManager(canvasWidth, canvasHeight);
};
