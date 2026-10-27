// Дебаг-пауза без плашки и затемнения. Пробел замирает поле.
// Esc эта пауза не читает: верхняя в стопке открывает обычный экран и перебивает эту.

import Phaser from 'phaser';
import type { Pause, PauseEnv } from './PauseStack';

export const QUIET_PAUSE = 'quiet-pause';

export class DebugQuietPause implements Pause {
  private env?: PauseEnv;
  private key?: Phaser.Input.Keyboard.Key;
  private active = false;
  private armed = false;

  get blocking(): boolean {
    return this.active;
  }

  get coversShop(): boolean {
    return false;
  }

  attach(env: PauseEnv): void {
    this.env = env;
    this.active = false;
    this.armed = false;
    this.key = undefined;
    if (env.keyboard) {
      this.key = env.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      env.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    this.mark(false);
  }

  tick(_esc: boolean): void {
    if (!this.env) {
      return;
    }
    if (!this.active) {
      if (this.pressed() && this.env.canPause() && !this.env.blockedAbove()) {
        this.enter();
      }
      return;
    }
    if (!this.armed) {
      this.armed = true;
      return;
    }
    if (this.pressed()) {
      this.exit();
    }
  }

  onHidden(): void {}

  yield(): void {
    if (!this.active) {
      return;
    }
    this.exit();
  }

  private enter(): void {
    if (!this.env) {
      return;
    }
    this.env.acquire();
    this.active = true;
    this.armed = false;
    this.mark(true);
    this.env.save();
  }

  private exit(): void {
    if (!this.active || !this.env) {
      return;
    }
    this.active = false;
    this.mark(false);
    this.env.release();
  }

  private mark(on: boolean): void {
    this.env?.scene.events.emit(QUIET_PAUSE, on);
  }

  private pressed(): boolean {
    return this.key !== undefined && Phaser.Input.Keyboard.JustDown(this.key);
  }
}
