// Крик пехоты при гибели от танка. Два файла: infantry_dead0 и infantry_dead1.
// В начале была тишина, в конце пустой хвост: иначе крик опаздывает к трупу.
// Подряд один и тот же не берём. Пикап этот звук не получает: он техника.
// Дошедший до базы тоже молчит: у штурмовика там свой взрыв.
// Пауза и гибель базы глушат крик вместе с выстрелом.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

const KEYS = ['infantry-dead-0', 'infantry-dead-1'] as const;

// Файлы тише пушки. 0.55 — слышно, кто упал, но залп по толпе не перекрывает выстрел (0.65).
// Ползунок эффектов умножает это число вместе с остальными звуками боя.
const GAIN = 0.55;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class InfantryDeath {
  private readonly active: Clip[] = [];
  private last = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const index = this.pick();
    const cry = this.scene.sound.add(KEYS[index], { volume: this.loudness() }) as Clip;
    this.active.push(cry);
    cry.once('complete', () => this.release(cry));
    cry.play();
  }

  setPaused(paused: boolean): void {
    for (const cry of this.active) {
      if (paused) {
        if (cry.isPlaying) {
          cry.pause();
        }
        continue;
      }
      if (cry.isPaused) {
        cry.resume();
      }
    }
  }

  stop(): void {
    for (const cry of this.active.splice(0)) {
      cry.off('complete');
      cry.stop();
      cry.destroy();
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
    for (const cry of this.active) {
      cry.volume = volume;
    }
  }

  private pick(): number {
    let index = Phaser.Math.Between(0, KEYS.length - 1);
    if (index === this.last) {
      index = (index + 1) % KEYS.length;
    }
    this.last = index;
    return index;
  }

  private release(cry: Clip): void {
    const index = this.active.indexOf(cry);
    if (index < 0) {
      return;
    }
    this.active.splice(index, 1);
    cry.destroy();
  }
}
