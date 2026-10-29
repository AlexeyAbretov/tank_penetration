// Размер холста Phaser и граница поля боя по вертикали.
// Совпадает с текстурой фона; баланс сущностей лежит в их классах.

// Поле, под которое нарисованы фон и интерфейс. width растёт, если окно шире 16:9.
export const GAME = {
  width: 1280,
  height: 720,
  // Ниже этой линии Y снаряды исчезают: там декоративный баннер, не поле боя.
  bannerY: 638,
};

const FIELD_W = 1280;
const FIELD_H = 720;

// Широкое окно получает такой же широкий холст: FIT тогда закрывает его без чёрных полос по бокам.
// Окно выше 16:9 не растягиваем: полоска сверху и снизу не съедает кнопки.
export function fitGameTo(parentWidth: number, parentHeight: number): void {
  if (parentWidth < 1 || parentHeight < 1) {
    return;
  }
  const wider = parentWidth * FIELD_H > parentHeight * FIELD_W;
  GAME.width = wider ? Math.floor((FIELD_H * parentWidth) / parentHeight) : FIELD_W;
  GAME.height = FIELD_H;
}

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
