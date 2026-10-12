// Размер холста Phaser и граница поля боя по вертикали.
// Совпадает с текстурой фона; баланс сущностей лежит в их классах.

export const GAME = {
  width: 1280,
  height: 720,
  // Ниже этой линии Y снаряды исчезают: там декоративный баннер, не поле боя.
  bannerY: 638,
} as const;

// Темп врагов. Игрок переключает 1 → 2 → 3. Танк и магазин этот множитель не читают.
export const ENEMY_HASTE = {
  key: 'enemyHaste',
  max: 3,
} as const;

// Дебаг-партия включается адресом с ?debug только на сервере разработки.
// Команда: npm run debug. В сборке для игроков Vite подставляет false, и адрес уже ничего не включает.
export function isDebugRun(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug');
}

// Текущий темп врагов. Registry — общая полка сцены: туда GameScene кладёт число по ключу.
// Если ключа ещё нет или там не число, темп равен 1. Выше max и ниже 1 значение не уходит.
export function enemyHasteOf(registry: { get(key: string): unknown }): number {
  const raw = registry.get(ENEMY_HASTE.key);
  const value = typeof raw === 'number' ? raw : 1;
  return Math.min(ENEMY_HASTE.max, Math.max(1, value));
}
