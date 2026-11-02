// Разрыв сбитой ракеты в воздухе из public/audio/rocket_burst.mp3.
// В исходнике хлопок сидел в середине: тишина до него и пустой хвост срезаны.
// На каждое сбитие свой звук. Пауза и гибель базы глушат его вместе с лучом лазера.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Файл сведён почти на полную громкость. 0.6 — как взрыв штурмовика, громче попадания ракеты в броню (0.4).
// Луч лазера звучит в тот же миг и остаётся тише. Ползунок эффектов умножает это число.
const GAIN = 0.6;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class RocketBurst {
  private readonly active: Clip[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const boom = this.scene.sound.add('rocket-burst', { volume: this.loudness() }) as Clip;
    this.active.push(boom);
    boom.once('complete', () => this.release(boom));
    boom.play();
  }

  setPaused(paused: boolean): void {
    for (const boom of this.active) {
      if (paused) {
        if (boom.isPlaying) {
          boom.pause();
        }
        continue;
      }
      if (boom.isPaused) {
        boom.resume();
      }
    }
  }

  stop(): void {
    for (const boom of this.active.splice(0)) {
      boom.off('complete');
      boom.stop();
      boom.destroy();
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
    for (const boom of this.active) {
      boom.volume = volume;
    }
  }

  private release(boom: Clip): void {
    const index = this.active.indexOf(boom);
    if (index < 0) {
      return;
    }
    this.active.splice(index, 1);
    boom.destroy();
  }
}
