// Треск пулемёта из public/audio/tank_mg_shot.mp3.
// В файле срезаны тишина в начале и тихий хвост: хлопок совпадает с вылетом пули.
// На каждый выстрел свой звук. Пауза и гибель базы глушат его вместе с пушкой.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Файл на полной громкости. 0.4 — ниже пушки (0.65): ствол на башне не должен перекрывать главный калибр.
// Ползунок эффектов умножает это число вместе с остальными звуками боя.
const GAIN = 0.4;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class TankMgShot {
  private readonly active: Clip[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    effects.follow(() => this.applyGain());
  }

  play(): void {
    const shot = this.scene.sound.add('tank-mg-shot', { volume: this.loudness() }) as Clip;
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
