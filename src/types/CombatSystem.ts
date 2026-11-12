// Бой с точки зрения сцены: кадр, способности и перезарядка.
// Класс CombatSystem сюда не входит.

import type { WorldPoint } from './WorldPoint';

export type CombatSystem = {
  readonly artilleryCooldown: number;
  readonly minesCooldown: number;
  readonly nuclearCooldown: number;
  readonly ionCooldown: number;
  readonly wallCooldown: number;
  readonly bomberCooldown: number;
  readonly empCooldown: number;
  readonly flameCooldown: number;
  setArtilleryCooldown(ms: number): void;
  setMinesCooldown(ms: number): void;
  setNuclearCooldown(ms: number): void;
  setIonCooldown(ms: number): void;
  setWallCooldown(ms: number): void;
  setBomberCooldown(ms: number): void;
  setEmpCooldown(ms: number): void;
  setFlameCooldown(ms: number): void;
  nuclearCloudLeft(): number;
  bomberBlastLeft(): number;
  requestArtillery(): void;
  requestMines(): void;
  requestNuclear(): void;
  requestIon(): void;
  requestWall(): void;
  requestBomber(): void;
  requestEmp(): void;
  // Правый край завесы, если она стоит. null — выстрел летит до танка.
  shieldFace(): number | null;
  shieldGlint(y: number): void;
  clearProjectiles(): void;
  captureMines(): { x: number; y: number }[];
  // Лежащая мина правее нового края сдвигается влево и не ложится на соседнюю.
  pullMines(): void;
  // Юнит и летящий снаряд правее нового края остаются на той же доле ширины.
  pullField(previousWidth: number): void;
  restoreMines(spots: { x: number; y: number }[]): void;
  captureFlameWall(): { points: { x: number; y: number }[]; left: number } | null;
  restoreFlameWall(saved: { points: { x: number; y: number }[]; left: number } | null): void;
  setupOverlap(): void;
  tickArtillery(delta: number, canFire: boolean): void;
  tickMines(delta: number, canFire: boolean): void;
  tickNuclear(delta: number, canFire: boolean): void;
  tickIon(delta: number, canFire: boolean): void;
  tickWall(delta: number, canFire: boolean): void;
  tickBomber(delta: number, canFire: boolean): void;
  tickEmp(delta: number, canFire: boolean): void;
  tick(delta: number, allowFire?: boolean): void;
  // Сцена приносит флаг прогресса: бой магазин очков не читает.
  setAutoFire(on: boolean): void;
  // Куплено и включено: артиллерия сама через секунду после готовности.
  setAutoArtillery(on: boolean): void;
  // Куплено и включено: мины сами через секунду после готовности.
  setAutoMines(on: boolean): void;
  // Куплено и включено: ионная пушка сама через секунду после готовности.
  setAutoIon(on: boolean): void;
  // Куплено и включено: бомбардировщик сам через секунду после готовности.
  setAutoBomber(on: boolean): void;
  // Куплено и включено: завеса сама через секунду после готовности.
  setAutoWall(on: boolean): void;
  // Точка живой цели автонаведения. Та же, пока она не погибла. null — на поле никого.
  aimPoint(): WorldPoint | null;
};
