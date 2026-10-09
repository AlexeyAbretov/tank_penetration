// Взрыв пикапа из public/audio/pickup_exposion.mp3.
// В файле срезаны тишина в начале и пустой хвост: удар совпадает со вспышкой.
// Несколько машин могут погибнуть почти вместе, поэтому у каждой свой звук.
// Пауза и гибель базы глушат его вместе с выстрелом.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Файл почти на полной громкости. 0.72 — громче взрыва штурмовика (0.6), тише гибели базы (0.85).
// Ползунок эффектов умножает это число вместе с остальными звуками боя.
const GAIN = 0.72;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class PickupExplosion {
  private readonly active: Clip[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const boom = this.scene.sound.add('pickup-explosion', { volume: this.loudness() }) as Clip;
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
