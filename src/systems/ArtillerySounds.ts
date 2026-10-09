// Залп и разрыв — два файла, не один.
// public/audio/artillery_shot.mp3 — первая часть artillery.mp3, до тишины перед вторым ударом.
// public/audio/artillery_explosion.mp3 — разрыв в точке, куда сел снаряд. Пустой хвост срезан.
// Хлопок один, на нажатие клавиши. Разрыв — свой на каждый снаряд, когда тот уже сел.
// Пауза и гибель базы глушат оба вместе с выстрелом пушки.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. ArtilleryStrike берёт отсюда плеер, не держа ссылку в каждом снаряде.
const REGISTRY_KEY = 'artillerySounds';

// Оба файла записаны почти на полную громкость, и три штуки звучат почти вместе.
// 0.55 — тише пушки (0.65): залп слышен, три длинных хвоста не забивают бой.
// 0.7 — как взрыв пикапа (0.72). Три разрыва садятся друг на друга, поэтому не громче гибели базы.
const SHOT_GAIN = 0.55;
const BOOM_GAIN = 0.7;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Playing = {
  clip: Clip;
  gain: number;
  onEnded?: () => void;
};

export class ArtillerySounds {
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
    this.play('artillery-explosion', BOOM_GAIN);
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
// Студия рисует картинки без этого плеера — тогда залп молчит и функция возвращает false.
export function playArtilleryShot(scene: Phaser.Scene, onEnded?: () => void): boolean {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof ArtillerySounds) {
    return fx.playShot(onEnded);
  }
  return false;
}

// Разрыв в точке попадания. Свой звук на каждый снаряд.
export function playArtilleryBoom(scene: Phaser.Scene): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof ArtillerySounds) {
    fx.playBoom();
  }
}
