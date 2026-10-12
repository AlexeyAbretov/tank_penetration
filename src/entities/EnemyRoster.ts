// Контракт фабрики волн. Менеджер волн знает только его, не конкретный класс.
// Обычная фабрика и дебаг-фабрика обе подходят под этот набор.

import type { Infantry } from './Infantry';
import type { EnemySaveKind } from './EnemyFactory';
import type { SpawnContext } from './SpawnContext';

export type EnemyRoster = {
  readonly timing: {
    // Сколько висит «ВОЛНА» или «БОСС», прежде чем первый враг шагнёт на поле.
    announceMs: number;
    // Пауза после загрузки новой партии.
    startDelayMs: number;
  };
  spawnGap(wave: number): number;
  isBossWave(wave: number): boolean;
  count(wave: number): number;
  create(index: number, ctx: SpawnContext): Infantry;
  restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, pace: number): Infantry;
  // Живой спрайт → строка для сохранения. null — это не наш враг.
  kindOf(unit: Infantry): EnemySaveKind | null;
};
