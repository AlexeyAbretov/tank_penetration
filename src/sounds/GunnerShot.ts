// Хлопок вражеской пули из public/audio/gunner_shot.mp3.
// В файле срезаны тишина в начале и тихий хвост: хлопок совпадает с вылетом пули.
// Стрелок, пикап и суперсолдат. Ракета этот файл не берёт: она не пуля.
// На каждую пулю свой звук. Пауза и гибель базы глушат его вместе с пушкой.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. EnemyShot.launch берёт отсюда плеер, не держа ссылку в каждом юните.
const REGISTRY_KEY = 'gunnerShot';

// Файл на полной громкости. 0.4 — как пулемёт башни: очередь слышна, но не перекрывает пушку (0.65).
// Ползунок эффектов умножает это число вместе с остальными звуками боя.
const GAIN = 0.4;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class GunnerShot {
  private readonly active: Clip[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    scene.registry.set(REGISTRY_KEY, this);
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const shot = this.scene.sound.add('gunner-shot', { volume: this.loudness() }) as Clip;
    this.active.push(shot);
    shot.once('complete', () => this.release(shot));
    shot.play();
  }

  setPaused(paused: boolean): void {
    for (const shot of this.active) {
      if (paused) {
        if (shot.isPlaying) {
          shot.pause();
        }
        continue;
      }
      if (shot.isPaused) {
        shot.resume();
      }
    }
  }

  stop(): void {
    for (const shot of this.active.splice(0)) {
      shot.off('complete');
      shot.stop();
      shot.destroy();
    }
  }

  destroy(): void {
    this.stop();
    if (this.scene.registry.get(REGISTRY_KEY) === this) {
      this.scene.registry.remove(REGISTRY_KEY);
    }
  }

  private loudness(): number {
    return GAIN * this.effects.volume;
  }

  private applyGain(): void {
    const volume = this.loudness();
    for (const shot of this.active) {
      shot.volume = volume;
    }
  }

  private release(shot: Clip): void {
    const index = this.active.indexOf(shot);
    if (index < 0) {
      return;
    }
    this.active.splice(index, 1);
    shot.destroy();
  }
}

// Вылет пули. Если плеер ещё не создан (студия рисует текстуру без боя), выстрел молчит.
export function playGunnerShot(scene: Phaser.Scene): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof GunnerShot) {
    fx.play();
  }
}
