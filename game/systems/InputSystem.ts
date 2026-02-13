/**
 * Система для обработки ввода (клавиатура и мышь)
 * Предоставляет удобный интерфейс для отслеживания состояния клавиш
 */

export interface InputState {
  // Клавиши движения
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  // Действия
  jump: boolean;
  crouch: boolean;
  fireLeft: boolean;
  fireRight: boolean;
  // Мышь
  mouseX: number;
  mouseY: number;
  mouseLeft: boolean;
  mouseRight: boolean;
}

/**
 * Карта кодов клавиш на их названия
 */
const KEY_MAP = {
  // Стрелки
  ArrowLeft: 'ArrowLeft',
  ArrowUp: 'ArrowUp',
  ArrowRight: 'ArrowRight',
  ArrowDown: 'ArrowDown',
  // WASD
  KeyW: 'KeyW',
  KeyA: 'KeyA',
  KeyS: 'KeyS',
  KeyD: 'KeyD',
  // Пробел
  Space: 'Space'
} as const;

type KeyMap = typeof KEY_MAP;

/**
 * Создаёт начальное состояние ввода
 */
export const createInputState = (): InputState => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  crouch: false,
  fireLeft: false,
  fireRight: false,
  mouseX: 0,
  mouseY: 0,
  mouseLeft: false,
  mouseRight: false
});

/**
 * Класс для управления вводом
 */
export class InputManager {
  private keys: Map<string, boolean>;
  private previousKeys: Map<string, boolean>;
  private mouse: InputState['mouse'];
  private state: InputState;

  constructor() {
    this.keys = new Map();
    this.previousKeys = new Map();
    this.mouse = { x: 0, y: 0, left: false, right: false };
    this.state = createInputState();
  }

  /**
   * Регистрирует нажатие клавиши
   */
  onKeyDown = (event: KeyboardEvent): void => {
    this.keys.set(event.code, true);
    this.updateState();
  };

  /**
   * Регистрирует отпускание клавиши
   */
  onKeyUp = (event: KeyboardEvent): void => {
    this.keys.set(event.code, false);
    this.updateState();
  };

  /**
   * Регистрирует движение мыши
   */
  onMouseMove = (event: MouseEvent, canvas: HTMLElement): void => {
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
    this.updateState();
  };

  /**
   * Регистрирует нажатие кнопок мыши
   */
  onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) this.mouse.left = true;
    if (event.button === 2) this.mouse.right = true;
    this.updateState();
  };

  /**
   * Регистрирует отпускание кнопок мыши
   */
  onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.mouse.left = false;
    if (event.button === 2) this.mouse.right = false;
    this.updateState();
  };

  /**
   * Обновляет состояние ввода
   */
  private updateState(): void {
    const left = this.keys.get(KEY_MAP.KeyA) || this.keys.get(KEY_MAP.ArrowLeft);
    const right = this.keys.get(KEY_MAP.KeyD) || this.keys.get(KEY_MAP.ArrowRight);
    const up = this.keys.get(KEY_MAP.KeyW) || this.keys.get(KEY_MAP.ArrowUp);
    const down = this.keys.get(KEY_MAP.KeyS) || this.keys.get(KEY_MAP.ArrowDown);
    const jump = this.keys.get(KEY_MAP.Space);

    this.state = {
      ...this.state,
      left: left || false,
      right: right || false,
      up: up || false,
      down: down || false,
      jump: jump || false,
      crouch: down || false,
      fireLeft: this.mouse.left,
      fireRight: this.mouse.right,
      mouseX: this.mouse.x,
      mouseY: this.mouse.y,
      mouseLeft: this.mouse.left,
      mouseRight: this.mouse.right
    };
  }

  /**
   * Получает текущее состояние
   */
  getState(): InputState {
    return this.state;
  }

  /**
   * Проверяет, была ли клавиша только что нажата
   */
  isKeyJustPressed(keyCode: string): boolean {
    const current = this.keys.get(keyCode);
    const previous = this.previousKeys.get(keyCode);
    return current && !previous;
  }

  /**
   * Обновляет предыдущее состояние (должен вызываться в конце кадра)
   */
  updatePreviousState(): void {
    this.previousKeys = new Map(this.keys);
  }

  /**
   * Сбрасывает состояние
   */
  reset(): void {
    this.keys.clear();
    this.previousKeys.clear();
    this.state = createInputState();
  }
}

/**
 * Проверяет коды клавиш для движения
 */
export const isMovementKey = (code: string): boolean => {
  return [
    KEY_MAP.KeyA,
    KEY_MAP.KeyD,
    KEY_MAP.ArrowLeft,
    KEY_MAP.ArrowRight
  ].includes(code);
};
