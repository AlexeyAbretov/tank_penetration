// Хлопок выстрела из public/audio/tank_shot.mp3.
// На каждый снаряд свой звук: перезарядка бывает короче, чем сам выстрел.
// Пауза и гибель базы глушат его вместе с музыкой.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Файл записан почти на полную громкость. 0.65 — чуть громче лупа волны (0.45), без крика в уши.
// Ползунок эффектов умножает это число: 1 оставляет сводку, 0 глушит выстрел.
const GAIN = 0.65;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class TankShot {
  private readonly active: Clip[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const shot = this.scene.sound.add('tank-shot', { volume: this.loudness() }) as Clip;
    this.active.push(shot);
    shot.once('complete', () => this.release(shot));
    shot.play();
  }

  setPaused(paused: boolean): void {
    for (const shot of this.active) {
      if (paused) {
        if (shot.isPlaying) {
          shot.pause();
        }
        continue;
      }
      if (shot.isPaused) {
        shot.resume();
      }
    }
  }

  // Гибель базы. Недоигранный хлопок не должен висеть над экраном очков.
  stop(): void {
    for (const shot of this.active.splice(0)) {
      shot.off('complete');
      shot.stop();
      shot.destroy();
    }
  }

  destroy(): void {
    this.stop();
  }

  private loudness(): number {
    return GAIN * this.effects.volume;
  }

  private applyGain(): void {
    const volume = this.loudness();
    for (const shot of this.active) {
      shot.volume = volume;
    }
  }

  private release(shot: Clip): void {
    const index = this.active.indexOf(shot);
    if (index < 0) {
      return;
    }
    this.active.splice(index, 1);
    shot.destroy();
  }
}
