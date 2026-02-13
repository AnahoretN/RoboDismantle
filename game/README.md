# Game Architecture

Эта папка содержит переиспользуемые игровые системы, отделённые от React компонентов.

## Структура

```
game/
├── systems/          # Игровая логика
│   ├── TimeSystem.ts           # Delta time для FPS-независимой физики
│   ├── CollisionSystem.ts      # Коллизии и хитбоксы
│   ├── VFXSystem.ts            # Визуальные эффекты
│   ├── NetworkSyncSystem.ts     # Оптимизация сетевых сообщений
│   ├── PlayerPhysicsSystem.ts  # Физика игрока
│   ├── EnemySystem.ts          # Логика врагов
│   ├── ProjectileSystem.ts     # Снаряды
│   ├── LimbSystem.ts          # Отрыв и подбор конечностей
│   ├── InputSystem.ts          # Обработка клавиатуры и мыши
│   ├── PerformanceMonitor.ts  # Мониторинг FPS
│   ├── GameLoopSystem.ts      # Игровой цикл с delta time
│   └── index.ts
├── renderers/        # Отрисовка (Canvas API)
│   ├── GameRenderer.ts         # Все draw функции
│   └── index.ts
├── utils/            # Утилиты
│   ├── playerFactory.ts        # Создание игрока
│   ├── levelGenerator.ts       # Генерация уровней
│   └── typeSafety.ts          # TypeScript helpers
├── hooks/            # React hooks
│   └── useGameState.ts        # Управление состоянием игры
└── index.ts          # Главный экспорт
```

## Использование

### Systems

Каждая система - это набор чистых функций без побочных эффектов:

```typescript
import { createEnemy, canEnemyFire } from '@/game/systems';

// Создание врага
const enemy = createEnemy(x, y);

// Проверка возможности стрельбы
if (canEnemyFire(enemy, Date.now())) {
  // стреляем
}
```

### Renderers

Функции отрисовки принимают CanvasRenderingContext2D:

```typescript
import { drawRobot, drawEnemy, clearCanvas } from '@/game/renderers';

// В игровом цикле
clearCanvas(ctx, width, height);
drawRobot(ctx, player, color, true);
enemies.forEach(e => drawEnemy(ctx, e));
```

### Game Loop

Используйте GameLoop для FPS-независимой физики:

```typescript
import { createGameLoop } from '@/game/systems';

const loop = createGameLoop({
  targetFPS: 60,
  onUpdate: (deltaTime, deltaMultiplier) => {
    // deltaTime - время с последнего кадра в секундах
    // deltaMultiplier - нормализованный множитель (1.0 при 60fps)
    updatePhysics(deltaMultiplier);
  }
});

loop.start();
```

## Принципы

1. **Pure Functions** - все системы состоят из чистых функций
2. **No Dependencies** - минимальные зависимости между системами
3. **Type Safety** - строгая типизация, без `any`
4. **Testable** - всё можно протестировать независимо
5. **Reusable** - системы можно использовать в разных режимах

## Delta Time

Физика должна использовать delta multiplier для консистентности на разных частотах кадров:

```typescript
// ПЛОХО - жёстко привязано к 60fps
player.x += 5;

// ХОРОШО - независимо от FPS
player.x += 5 * deltaMultiplier;
```
