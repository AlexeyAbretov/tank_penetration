// Снимок врага и фазы волны. И сохранение, и менеджер волн читают эти типы,
// не таща друг друга целиком.

// Короткое имя вида для сохранения партии. Имя класса после сборки Vite может измениться,
// поэтому в localStorage пишется эта строка, а не AssaultInfantry.
export const ENEMY_KINDS = ['assault', 'gunner', 'truck', 'rocket', 'super'] as const;
export type EnemySaveKind = (typeof ENEMY_KINDS)[number];

export type EnemySave = {
  kind: EnemySaveKind;
  x: number;
  y: number;
  hp: number;
  pace: number;
};

export type WavePhase = 'combat' | 'shop';
