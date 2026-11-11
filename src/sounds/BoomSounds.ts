// Хлопок батареи и разрыв у земли — два файла, не один.
// public/audio/artillery_shot.mp3 — хлопок в момент залпа. Его играет только артиллерия.
// public/audio/artillery_explosion.mp3 — разрыв в точке.
// Его берут снаряд артиллерии, мина, бомба и попадание снаряда тяжёлого танка.
// Пауза и гибель базы глушат оба вместе с выстрелом пушки.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. Залп и разрыв берут плеер отсюда, не держа ссылку в каждом вызове.
const REGISTRY_KEY = 'boomSounds';

// Оба файла записаны почти на полную громкость.
// 0.55 — тише пушки (0.65): залп слышен, три длинных хвоста не забивают бой.
// 0.2 — три разрыва артиллерии садятся друг на друга и иначе забивают бой.
// 0.65 — попадание снаряда тяжёлого танка одно, на уровне пушки игрока и поверх мотора.
const SHOT_GAIN = 0.55;
const BOOM_GAIN = 0.2;
const TANK_HIT_GAIN = 0.65;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Playing = {
  clip: Clip;
  gain: number;
  onEnded?: () => void;
};

export class BoomSounds {
  private readonly active: Playing[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    scene.registry.set(REGISTRY_KEY, this);
    effects.follow(() => this.applyGain());
  }

  // true — клип пошёл. onEnded зовётся, когда он доиграл, не когда его оборвали.
  playShot(onEnded?: () => void): boolean {
    return this.play('artillery-shot', SHOT_GAIN, onEnded);
  }

  playBoom(): void {
    this.play('boom', BOOM_GAIN);
  }

  // Тот же файл, что у артиллерии, но один разрыв о броню — громче общего.
  playTankHit(): void {
    this.play('boom', TANK_HIT_GAIN);
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
      item.onEnded = undefined;
      item.clip.off('complete');
      item.clip.stop();
      item.clip.destroy();
    }
  }

  destroy(): void {
    this.stop();
    if (this.scene.registry.get(REGISTRY_KEY) === this) {
      this.scene.registry.remove(REGISTRY_KEY);
    }
  }

  private play(key: string, gain: number, onEnded?: () => void): boolean {
    const clip = this.scene.sound.add(key, { volume: gain * this.effects.volume }) as Clip;
    const item: Playing = { clip, gain, onEnded };
    this.active.push(item);
    clip.once('complete', () => {
      const done = item.onEnded;
      item.onEnded = undefined;
      this.release(item);
      done?.();
    });
    if (clip.play()) {
      return true;
    }
    item.onEnded = undefined;
    clip.off('complete');
    this.release(item);
    return false;
  }

  private applyGain(): void {
    for (const item of this.active) {
      item.clip.volume = item.gain * this.effects.volume;
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

// Хлопок батареи в момент нажатия. onEnded — когда файл доиграл, не когда звук оборвали.
// Без плеера в registry залп молчит и функция возвращает false.
export function playArtilleryShot(scene: Phaser.Scene, onEnded?: () => void): boolean {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof BoomSounds) {
    return fx.playShot(onEnded);
  }
  return false;
}

// Разрыв в точке. Свой звук на каждый снаряд, мину, бомбу и попадание снаряда тяжёлого танка.
export function playBoom(scene: Phaser.Scene): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof BoomSounds) {
    fx.playBoom();
  }
}
