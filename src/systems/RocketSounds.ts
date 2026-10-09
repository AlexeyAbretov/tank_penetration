// Пуск и попадание ракеты — два файла, не один.
// public/audio/rocket_shot.mp3 — выстрел из трубы.
// public/audio/rocket_hit_tank.mp3 — взрыв о броню.
// У обоих срезаны тишина в начале и пустой хвост: звук совпадает со вспышкой.
// На каждую ракету свой звук: вторая может вылететь, пока первая ещё в воздухе.
// Пауза и гибель базы глушат оба звука вместе с выстрелом пушки.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. Rocket.launch берёт отсюда плеер, не держа ссылку в каждой ракете.
const REGISTRY_KEY = 'rocketSounds';

// Оба файла записаны почти на полную громкость.
// 0.6 — громче винтовки (0.4), не громче пушки (0.65): ракеты редкие, но пушка остаётся главным выстрелом.
// 0.72 — как взрыв пикапа: попадание в свою броню слышнее щелчка пули (0.5).
const LAUNCH_GAIN = 0.6;
const HIT_GAIN = 0.72;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Playing = {
  clip: Clip;
  gain: number;
};

export class RocketSounds {
  private readonly active: Playing[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    scene.registry.set(REGISTRY_KEY, this);
    effects.follow(() => this.applyGain());
  }

  playLaunch(): void {
    this.play('rocket-shot', LAUNCH_GAIN);
  }

  playHit(): void {
    this.play('rocket-hit-tank', HIT_GAIN);
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
    if (this.scene.registry.get(REGISTRY_KEY) === this) {
      this.scene.registry.remove(REGISTRY_KEY);
    }
  }

  private play(key: string, gain: number): void {
    const clip = this.scene.sound.add(key, { volume: gain * this.effects.volume }) as Clip;
    const item = { clip, gain };
    this.active.push(item);
    clip.once('complete', () => this.release(item));
    clip.play();
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

// Вылет ракеты. Если плеер ещё не создан (студия рисует текстуру без боя), пуск молчит.
export function playRocketLaunch(scene: Phaser.Scene): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof RocketSounds) {
    fx.playLaunch();
  }
}
