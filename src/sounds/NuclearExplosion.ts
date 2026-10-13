// Взрыв атомной бомбы из public/audio/nuclear_explosion.mp3.
// В файле срезаны тишина в начале и пустой хвост: удар совпадает со вспышкой,
// а тихий шум после затухания не висит над боем.
// Пауза и гибель базы глушат его вместе с остальными звуками.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. NuclearStrike берёт отсюда плеер, не держа ссылку на систему боя.
const REGISTRY_KEY = 'nuclearExplosion';

// Файл уже почти на полной громкости и длится дольше остальных взрывов.
// 0.9 — громче гибели базы (0.85): это удар по всему полю, не очередной разрыв.
// Ползунок эффектов умножает это число вместе с остальными звуками боя.
const GAIN = 0.9;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class NuclearExplosion {
  private clip?: Clip;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    scene.registry.set(REGISTRY_KEY, this);
    effects.follow(() => this.applyGain());
  }

  play(): void {
    this.stop();
    const boom = this.scene.sound.add('nuclear-explosion', { volume: this.loudness() }) as Clip;
    this.clip = boom;
    boom.once('complete', () => this.release(boom));
    boom.play();
  }

  setPaused(paused: boolean): void {
    const boom = this.clip;
    if (!boom) {
      return;
    }
    if (paused) {
      if (boom.isPlaying) {
        boom.pause();
      }
      return;
    }
    if (boom.isPaused) {
      boom.resume();
    }
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
    if (this.scene.registry.get(REGISTRY_KEY) === this) {
      this.scene.registry.remove(REGISTRY_KEY);
    }
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

// Разрыв в момент, когда бомба села. Студия без этого плеера взрыв не слышит.
export function playNuclearBoom(scene: Phaser.Scene): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof NuclearExplosion) {
    fx.play();
  }
}
