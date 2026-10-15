// Контракт фабрики волн для менеджера и музыки.
// Сам класс EnemyFactory сюда не входит: потребители зависят только от этих методов.

import type { SpawnContext } from './SpawnContext';
import type { EnemySaveKind } from './EnemySave';
import type { WaveUnit } from './WaveUnit';

export type EnemyWaves = {
  readonly timing: {
    readonly announceMs: number;
    readonly startDelayMs: number;
  };
  count(wave: number): number;
  spawnGap(wave: number): number;
  isBossWave(wave: number): boolean;
  kindOf(unit: WaveUnit): EnemySaveKind | null;
  create(index: number, ctx: SpawnContext): WaveUnit;
  restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, pace: number): WaveUnit;
};
