// Голос ионной пушки.
// public/audio/ion_appear.ogg — низкий сход столба. Не лазер: сверху почти нет, тон падает вниз.
// public/audio/lowFrequency_explosion_000.ogg — подошва бьёт в землю (Kenney Sci-fi Sounds, CC0).
// public/audio/thrusterFire_000.ogg — шипение хода (тот же набор). Играет, пока столб идёт, и обрывается вместе с ним.
// Пауза и гибель базы глушат все три.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Сход — ровный низкий гул, не короткий щелчок. 0.5 — громче луча лазера, ниже пушки (0.65).
// Низкий взрыв длится две секунды и идёт один. 0.7 — рядом с пушкой: удар редкий, не очередь.
// Шипение держится весь ход, 3–5 с. 0.38 — его слышно сквозь стрельбу, пушка остаётся громче.
const APPEAR_GAIN = 0.5;
const IMPACT_GAIN = 0.7;
const SWEEP_GAIN = 0.38;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Playing = {
  clip: Clip;
  gain: number;
};

export class IonCannonSounds {
  private readonly active: Playing[] = [];
  private sweep?: Playing;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  playAppear(): void {
    this.play('ion-appear', APPEAR_GAIN);
  }

  playImpact(): void {
    this.play('ion-impact', IMPACT_GAIN);
  }

  startSweep(): void {
    this.stopSweep();
    const clip = this.scene.sound.add('ion-sweep', { volume: SWEEP_GAIN * this.effects.volume }) as Clip;
    const item = { clip, gain: SWEEP_GAIN };
    this.sweep = item;
    clip.once('complete', () => this.releaseSweep(item));
    clip.play();
  }

  stopSweep(): void {
    const item = this.sweep;
    if (!item) {
      return;
    }
    this.sweep = undefined;
    item.clip.off('complete');
    item.clip.stop();
    item.clip.destroy();
  }

  setPaused(paused: boolean): void {
    this.setClipPaused(this.sweep?.clip, paused);
    for (const item of this.active) {
      this.setClipPaused(item.clip, paused);
    }
  }

  stop(): void {
    this.stopSweep();
    for (const item of this.active.splice(0)) {
      item.clip.off('complete');
      item.clip.stop();
      item.clip.destroy();
    }
  }

  destroy(): void {
    this.stop();
  }

  private play(key: string, gain: number): void {
    const clip = this.scene.sound.add(key, { volume: gain * this.effects.volume }) as Clip;
    const item = { clip, gain };
    this.active.push(item);
    clip.once('complete', () => this.release(item));
    clip.play();
  }

  private setClipPaused(clip: Clip | undefined, paused: boolean): void {
    if (!clip) {
      return;
    }
    if (paused) {
      if (clip.isPlaying) {
        clip.pause();
      }
      return;
    }
    if (clip.isPaused) {
      clip.resume();
    }
  }

  private applyGain(): void {
    const level = this.effects.volume;
    if (this.sweep) {
      this.sweep.clip.volume = this.sweep.gain * level;
    }
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

  private releaseSweep(item: Playing): void {
    if (this.sweep !== item) {
      return;
    }
    this.sweep = undefined;
    item.clip.destroy();
  }
}
