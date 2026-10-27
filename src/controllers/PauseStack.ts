// Стопка пауз. Сцена раз за кадр зовёт tick и не знает, какие виды внутри.
// Новый вид — класс и строка в фабрике. GameScene для этого не меняется.
// Список сверху вниз: верхний перебивает нижних, нижний не трогает верхний.

import type Phaser from 'phaser';
import type { GameHud } from '../ui/huds/GameHud';

export type PauseEnv = {
  // Поражение и настройки. Чужую паузу сюда не кладём: её видно через blockedAbove.
  canPause(): boolean;
  blockedAbove(): boolean;
  // Первый acquire останавливает часы, последний release отпускает.
  // Пока счётчик больше нуля, повторный acquire частицы не замораживает второй раз.
  acquire(): void;
  release(): void;
  save(): void;
  showPlate(on: boolean): void;
  coverShop(on: boolean): void;
  // Нижние виды отпускают себя. Верхний уже взял часы, поэтому мир не оттаивает.
  preemptLower(): void;
  hud: GameHud;
  keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  scene: Phaser.Scene;
};

export interface Pause {
  readonly blocking: boolean;
  readonly coversShop: boolean;
  attach(env: PauseEnv): void;
  tick(esc: boolean): void;
  yield(): void;
  onHidden(): void;
}

export class PauseStack {
  constructor(private readonly pauses: readonly Pause[]) {}

  get blocking(): boolean {
    return this.pauses.some((pause) => pause.blocking);
  }

  get coversShop(): boolean {
    return this.pauses.some((pause) => pause.coversShop);
  }

  attach(
    scene: Phaser.Scene,
    hud: GameHud,
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null,
    clock: {
      canPause(): boolean;
      acquire(): void;
      release(): void;
      save(): void;
      showPlate(on: boolean): void;
      coverShop(on: boolean): void;
    },
  ): void {
    this.pauses.forEach((pause, index) => {
      const above = this.pauses.slice(0, index);
      const below = this.pauses.slice(index + 1);
      pause.attach({
        canPause: () => clock.canPause(),
        blockedAbove: () => above.some((other) => other.blocking),
        acquire: () => clock.acquire(),
        release: () => clock.release(),
        save: () => clock.save(),
        showPlate: (on) => clock.showPlate(on),
        coverShop: (on) => clock.coverShop(on),
        preemptLower: () => {
          for (const lower of below) {
            lower.yield();
          }
        },
        hud,
        keyboard,
        scene,
      });
    });
  }

  tick(esc: boolean): void {
    for (const pause of this.pauses) {
      pause.tick(esc);
    }
  }

  onHidden(): void {
    for (const pause of this.pauses) {
      pause.onHidden();
    }
  }
}
