// Голос ионной пушки, кроме схода: тот лежит в Descent и общий со вспышкой ЭМИ.
// public/audio/lowFrequency_explosion_000.ogg — подошва бьёт в землю (Kenney Sci-fi Sounds, CC0).
// public/audio/thrusterFire_000.ogg — шипение хода (тот же набор). Играет, пока столб идёт, и обрывается вместе с ним.
// Пауза и гибель базы глушат оба.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Низкий взрыв длится две секунды и идёт один. 0.7 — рядом с пушкой: удар редкий, не очередь.
// Шипение держится весь ход, 3–5 с. 0.38 — его слышно сквозь стрельбу, пушка остаётся громче.
const IMPACT_GAIN = 1.7;
const SWEEP_GAIN = 1.0;

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
