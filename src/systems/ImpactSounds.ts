// Удар снаряда по врагу. Три файла из public/audio: impact0, impact1, impact2.
// Хлопок стоит в начале файла: иначе он доигрывает уже после того, как спрайт стал трупом.
// Подряд один и тот же не берём, иначе частая стрельба звучит как заезженная пластинка.
// Пауза и гибель базы глушат звук вместе с выстрелом.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

const KEYS = ['impact-0', 'impact-1', 'impact-2'] as const;

// Файлы почти на полной громкости. Тише выстрела (0.65), чтобы удар подтверждал попадание, а не перекрывал пушку.
// Ползунок эффектов умножает это число вместе с выстрелом.
const GAIN = 0.5;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class ImpactSounds {
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
    const hit = this.scene.sound.add(KEYS[index], { volume: this.loudness() }) as Clip;
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

  private pick(): number {
    let index = Phaser.Math.Between(0, KEYS.length - 1);
    if (index === this.last) {
      index = (index + 1) % KEYS.length;
    }
    this.last = index;
    return index;
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
