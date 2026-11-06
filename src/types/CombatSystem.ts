// Бой с точки зрения сцены: кадр, способности и перезарядка.
// Класс CombatSystem сюда не входит.

import type { WorldPoint } from './WorldPoint';

export type CombatSystem = {
  readonly artilleryCooldown: number;
  readonly minesCooldown: number;
  readonly nuclearCooldown: number;
  readonly flameCooldown: number;
  setArtilleryCooldown(ms: number): void;
  setMinesCooldown(ms: number): void;
  setNuclearCooldown(ms: number): void;
  setFlameCooldown(ms: number): void;
  nuclearCloudLeft(): number;
  requestArtillery(): void;
  requestMines(): void;
  requestNuclear(): void;
  clearProjectiles(): void;
  captureMines(): { x: number; y: number }[];
  restoreMines(spots: { x: number; y: number }[]): void;
  captureFlameWall(): { points: { x: number; y: number }[]; left: number } | null;
  restoreFlameWall(saved: { points: { x: number; y: number }[]; left: number } | null): void;
  setupOverlap(): void;
  tickArtillery(delta: number, canFire: boolean): void;
  tickMines(delta: number, canFire: boolean): void;
  tickNuclear(delta: number, canFire: boolean): void;
  tick(delta: number, allowFire?: boolean): void;
  // Сцена приносит флаг прогресса: бой магазин очков не читает.
  setAutoFire(on: boolean): void;
  // Куплено и включено: артиллерия сама через секунду после готовности.
  setAutoArtillery(on: boolean): void;
  // Куплено и включено: мины сами через секунду после готовности.
  setAutoMines(on: boolean): void;
  // Точка живой цели автонаведения. Та же, пока она не погибла. null — на поле никого.
  aimPoint(): WorldPoint | null;
};
