// Контракт фабрики волн для менеджера и музыки.
// Сам класс EnemyFactory сюда не входит: потребители зависят только от этих методов.

import type { SpawnContext, TroopKind } from './SpawnContext';
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
  // Подпись под словом «БОСС». null — обычная волна, баннер пишет номер.
  bossTitle(wave: number): string | null;
  kindOf(unit: WaveUnit): EnemySaveKind | null;
  create(index: number, ctx: SpawnContext): WaveUnit;
  // Солдат из двери БТР. Тот же ранг, что у пехоты этой волны.
  deploy(kind: TroopKind, ctx: SpawnContext): WaveUnit;
  restore(
    kind: EnemySaveKind,
    ctx: SpawnContext,
    hp: number,
    pace: number,
    slot?: number,
    dropped?: number,
  ): WaveUnit;
};
