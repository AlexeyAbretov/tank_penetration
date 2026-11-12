// Гул мотора БТР.
// public/audio/btr-engine.mp3 — луп, пока корпус жив. Рубеж пулемёта и ЭМИ его не глушат.
// Пауза и гибель базы глушат его. После гибели базы кадр БТР его снова не включает.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. БТР берёт плеер отсюда и не держит ссылку на список боя.
const REGISTRY_KEY = 'btrSounds';

// Файл — восьмисекундный луп. В среднем чуть тише мотора танка, пики выше.
// 0.5 — тот же гул, что у танка: рядом с музыкой босса (0.45), пушка остаётся громче (0.65).
const ENGINE_GAIN = 0.5;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Loop = {
  clip: Clip;
  gain: number;
};

export class BtrSounds {
  private engine?: Loop;
  private engineOn = false;
  private gamePaused = false;
  // Гибель базы. Пока сцена жива, БТР на поле очков голос не поднимает.
  private cut = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    scene.registry.set(REGISTRY_KEY, this);
    effects.follow(() => this.applyGain());
  }

  // engine — корпус ещё жив. На рубеже и под ЭМИ мотор не глушится.
  setEngine(engine: boolean): void {
    if (this.cut) {
      return;
    }
    this.engineOn = engine;
    this.apply();
  }

  setPaused(paused: boolean): void {
    this.gamePaused = paused;
    this.apply();
  }

  stop(): void {
    this.cut = true;
    this.engineOn = false;
    this.gamePaused = false;
    this.drop(this.engine);
    this.engine = undefined;
  }

  destroy(): void {
    this.stop();
    if (this.scene.registry.get(REGISTRY_KEY) === this) {
      this.scene.registry.remove(REGISTRY_KEY);
    }
  }

  private apply(): void {
    this.engine = this.keep(this.engine, this.engineOn, 'btr-engine', ENGINE_GAIN);
  }

  private keep(loop: Loop | undefined, wanted: boolean, key: string, gain: number): Loop | undefined {
    if (!wanted) {
      this.drop(loop);
      return undefined;
    }
    const item = loop ?? this.start(key, gain);
    const clip = item.clip;
    if (this.gamePaused) {
      if (clip.isPlaying) {
        clip.pause();
      }
      return item;
    }
    if (clip.isPaused) {
      clip.resume();
    } else if (!clip.isPlaying) {
      clip.play();
    }
    clip.volume = gain * this.effects.volume;
    return item;
  }

  private start(key: string, gain: number): Loop {
    const clip = this.scene.sound.add(key, {
      loop: true,
      volume: gain * this.effects.volume,
    }) as Clip;
    return { clip, gain };
  }

  private drop(loop: Loop | undefined): void {
    if (!loop) {
      return;
    }
    loop.clip.stop();
    loop.clip.destroy();
  }

  private applyGain(): void {
    if (this.engine) {
      this.engine.clip.volume = this.engine.gain * this.effects.volume;
    }
  }
}

// Мотор — пока корпус жив. Без плеера в registry БТР молчит.
export function syncBtrEngine(scene: Phaser.Scene, engine: boolean): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof BtrSounds) {
    fx.setEngine(engine);
  }
}
