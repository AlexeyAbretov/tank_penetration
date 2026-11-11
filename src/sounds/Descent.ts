// Низкий сход сверху из public/audio/ion_appear.ogg.
// Сверху почти нет, тон падает вниз: ровный гул, не лазер и не короткий щелчок.
// Его берут пуск ионного столба и появление вспышки ЭМИ.
// Пауза и гибель базы глушат его вместе с остальными клипами боя.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// 0.5 — громче луча лазера, ниже пушки (0.65). Ползунок эффектов умножает это число.
const GAIN = 1.5;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Playing = {
  clip: Clip;
  gain: number;
};

export class Descent {
  private readonly active: Playing[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const clip = this.scene.sound.add('descent', { volume: GAIN * this.effects.volume }) as Clip;
    const item = { clip, gain: GAIN };
    this.active.push(item);
    clip.once('complete', () => this.release(item));
    clip.play();
  }

  setPaused(paused: boolean): void {
    for (const item of this.active) {
      const clip = item.clip;
      if (paused) {
        if (clip.isPlaying) {
          clip.pause();
        }
        continue;
      }
      if (clip.isPaused) {
        clip.resume();
      }
    }
  }

  stop(): void {
    for (const item of this.active.splice(0)) {
      item.clip.off('complete');
      item.clip.stop();
      item.clip.destroy();
    }
  }

  destroy(): void {
    this.stop();
  }

  private applyGain(): void {
    const level = this.effects.volume;
    for (const item of this.active) {
      item.clip.volume = item.gain * level;
    }
  }

  private release(item: Playing): void {
    const index = this.active.indexOf(item);
    if (index < 0) {
      return;
    }
    this.active.splice(index, 1);
    item.clip.destroy();
  }
}
