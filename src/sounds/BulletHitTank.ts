// Удар вражеской пули о броню из public/audio/bullet_hit_tank.mp3.
// В файле срезаны тишина в начале и тихий хвост: удар совпадает с искрой.
// На каждую пулю свой звук. Ракета этот файл не берёт: у неё взрыв, не щелчок.
// Пауза и гибель базы глушат его вместе с выстрелом.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Файл на полной громкости. 0.5 — как удар снаряда по врагу: попадание в свою броню слышно,
// но очередь не перекрывает пушку (0.65). Ползунок эффектов умножает это число.
const GAIN = 0.5;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class BulletHitTank {
  private readonly active: Clip[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const hit = this.scene.sound.add('bullet-hit-tank', { volume: this.loudness() }) as Clip;
    this.active.push(hit);
    hit.once('complete', () => this.release(hit));
    hit.play();
  }

  setPaused(paused: boolean): void {
    for (const hit of this.active) {
      if (paused) {
        if (hit.isPlaying) {
          hit.pause();
        }
        continue;
      }
      if (hit.isPaused) {
        hit.resume();
      }
    }
  }

  stop(): void {
    for (const hit of this.active.splice(0)) {
      hit.off('complete');
      hit.stop();
      hit.destroy();
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
    for (const hit of this.active) {
      hit.volume = volume;
    }
  }

  private release(hit: Clip): void {
    const index = this.active.indexOf(hit);
    if (index < 0) {
      return;
    }
    this.active.splice(index, 1);
    hit.destroy();
  }
}
