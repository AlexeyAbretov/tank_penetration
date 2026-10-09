// Взрыв базы из public/audio/tank_dead.mp3.
// В файле срезаны тишина в начале и тихий хвост: удар совпадает со вспышкой
// и доигрывает вскоре после того, как открывается магазин очков.
// Громче пушки: это гибель танка, а не очередной выстрел.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Файл записан почти на полную громкость. 0.85 — выше выстрела (0.65), ниже крика в уши.
// Ползунок эффектов умножает это число вместе с остальными звуками боя.
const GAIN = 0.85;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class TankDeath {
  private clip?: Clip;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    this.stop();
    const boom = this.scene.sound.add('tank-dead', { volume: this.loudness() }) as Clip;
    this.clip = boom;
    boom.once('complete', () => this.release(boom));
    boom.play();
  }

  stop(): void {
    const boom = this.clip;
    if (!boom) {
      return;
    }
    this.clip = undefined;
    boom.off('complete');
    boom.stop();
    boom.destroy();
  }

  destroy(): void {
    this.stop();
  }

  private loudness(): number {
    return GAIN * this.effects.volume;
  }

  private applyGain(): void {
    if (this.clip) {
      this.clip.volume = this.loudness();
    }
  }

  private release(boom: Clip): void {
    if (this.clip !== boom) {
      return;
    }
    this.clip = undefined;
    boom.destroy();
  }
}
