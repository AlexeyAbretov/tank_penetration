// Обычная пауза: кнопка, Esc и плашка «ПАУЗА». Продолжает бой только Esc.

import type { Pause, PauseEnv } from './PauseStack';

export class ScreenPause implements Pause {
  private env?: PauseEnv;
  private active = false;
  private armed = false;

  get blocking(): boolean {
    return this.active;
  }

  get coversShop(): boolean {
    return this.active;
  }

  attach(env: PauseEnv): void {
    this.env = env;
    this.active = false;
    this.armed = false;
    env.hud.onPause(() => {
      if (!env.canPause() || this.active) {
        return;
      }
      this.enter();
    });
  }

  tick(esc: boolean): void {
    if (!this.env) {
      return;
    }
    if (this.active) {
      // Первый кадр проглатывает Esc, которым паузу включили.
      if (!this.armed) {
        this.armed = true;
        return;
      }
      if (esc) {
        this.exit();
      }
      return;
    }
    if (esc && this.env.canPause() && !this.env.blockedAbove()) {
      this.enter();
    }
  }

  onHidden(): void {
    if (this.active || !this.env?.canPause()) {
      return;
    }
    this.enter();
  }

  yield(): void {
    if (!this.active || !this.env) {
      return;
    }
    this.active = false;
    this.env.showPlate(false);
    this.env.coverShop(false);
    this.env.release();
  }

  private enter(): void {
    if (!this.env) {
      return;
    }
    this.env.acquire();
    this.env.preemptLower();
    this.active = true;
    this.armed = false;
    this.env.showPlate(true);
    this.env.coverShop(true);
    this.env.save();
  }

  private exit(): void {
    if (!this.env) {
      return;
    }
    this.active = false;
    this.env.showPlate(false);
    this.env.coverShop(false);
    this.env.release();
  }
}
