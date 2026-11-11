// Голос тяжёлого танка: мотор и гусеницы.
// public/audio/heavy-tank-boss-engine.mp3 — гул, пока корпус жив. Рубеж и ЭМИ его не глушат.
// public/audio/heavy-tank-boss-tracks.mp3 — лязг, только пока гусеница крутится.
// На рубеже и под ЭМИ корпус стоит, гусеницы молчат.
// Пауза и гибель базы глушат оба. После гибели базы кадр танка их снова не включает.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. Танк берёт плеер отсюда и не держит ссылку на список боя.
const REGISTRY_KEY = 'heavyTankSounds';

// Оба файла — восьмисекундные лупы. Мотор в среднем тише полной шкалы.
// 0.5 — рядом с музыкой босса (0.45): гул слышен, пушка остаётся громче (0.65).
// У гусениц пики почти в потолок. 0.4 — лязг под мотором, без щелчка в уши.
const ENGINE_GAIN = 0.5;
const TRACKS_GAIN = 0.4;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Loop = {
  clip: Clip;
  gain: number;
};

export class HeavyTankSounds {
  private engine?: Loop;
  private tracks?: Loop;
  private engineOn = false;
  private tracksOn = false;
  private gamePaused = false;
  // Гибель базы. Пока сцена жива, танк на поле очков голос не поднимает.
  private cut = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    scene.registry.set(REGISTRY_KEY, this);
    effects.follow(() => this.applyGain());
  }

  // engine — корпус ещё жив. tracks — гусеница в этом кадре крутится.
  setDrive(engine: boolean, tracks: boolean): void {
    if (this.cut) {
      return;
    }
    this.engineOn = engine;
    this.tracksOn = engine && tracks;
    this.apply();
  }

  setPaused(paused: boolean): void {
    this.gamePaused = paused;
    this.apply();
  }

  stop(): void {
    this.cut = true;
    this.engineOn = false;
    this.tracksOn = false;
    this.gamePaused = false;
    this.drop(this.engine);
    this.drop(this.tracks);
    this.engine = undefined;
    this.tracks = undefined;
  }

  destroy(): void {
    this.stop();
    if (this.scene.registry.get(REGISTRY_KEY) === this) {
      this.scene.registry.remove(REGISTRY_KEY);
    }
  }

  private apply(): void {
    this.engine = this.keep(this.engine, this.engineOn, 'heavy-tank-engine', ENGINE_GAIN);
    this.tracks = this.keep(this.tracks, this.tracksOn, 'heavy-tank-tracks', TRACKS_GAIN);
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
    const level = this.effects.volume;
    if (this.engine) {
      this.engine.clip.volume = this.engine.gain * level;
    }
    if (this.tracks) {
      this.tracks.clip.volume = this.tracks.gain * level;
    }
  }
}

// Мотор — пока корпус жив. Гусеницы — только на ходу. Без плеера в registry танк молчит.
export function syncHeavyTankDrive(scene: Phaser.Scene, engine: boolean, tracks: boolean): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof HeavyTankSounds) {
    fx.setDrive(engine, tracks);
  }
}
