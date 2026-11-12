// Шум винтов дрономатки.
// public/audio/drone-carrier-boss.wav — плотный луп, пока корпус жив и винты крутятся.
// Тишины по краям нет: иначе на каждом круге винты замолкают. mp3 такую паузу вставляет сам.
// Под ЭМИ винты стоят, шум молчит. Гибель корпуса снимает его голос.
// Две матки делят один клип: второй корпус не делает шум громче.
// Пауза и гибель базы глушат его. После гибели базы кадр матки его снова не включает.
// Рестарт сцены звуки общего менеджера не удаляет, поэтому нужен destroy.

import Phaser from 'phaser';
import type { EffectsVolume } from './EffectsVolume';

// Ключ на полке сцены. Матка берёт плеер отсюда и не держит ссылку на список боя.
const REGISTRY_KEY = 'droneCarrierSounds';

// Файл короче двух секунд и в среднем тише мотора танка.
// 0.7 — рядом с гулом танка (0.5): винты слышны, пушка остаётся громче (0.65).
const ROTOR_GAIN = 0.7;

type Clip = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

type Loop = {
  clip: Clip;
  gain: number;
};

export class DroneCarrierSounds {
  private rotor?: Loop;
  private readonly spinning = new Set<number>();
  private gamePaused = false;
  // Гибель базы. Пока сцена жива, матка на поле очков голос не поднимает.
  private cut = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectsVolume,
  ) {
    scene.registry.set(REGISTRY_KEY, this);
    effects.follow(() => this.applyGain());
  }

  // token — одно тело. spinning — его винты в этом кадре крутятся.
  setRotor(token: number, spinning: boolean): void {
    if (this.cut) {
      return;
    }
    if (spinning) {
      this.spinning.add(token);
    } else {
      this.spinning.delete(token);
    }
    this.apply();
  }

  setPaused(paused: boolean): void {
    this.gamePaused = paused;
    this.apply();
  }

  stop(): void {
    this.cut = true;
    this.spinning.clear();
    this.gamePaused = false;
    this.drop(this.rotor);
    this.rotor = undefined;
  }

  destroy(): void {
    this.stop();
    if (this.scene.registry.get(REGISTRY_KEY) === this) {
      this.scene.registry.remove(REGISTRY_KEY);
    }
  }

  private apply(): void {
    this.rotor = this.keep(this.rotor, this.spinning.size > 0, 'drone-carrier-rotor', ROTOR_GAIN);
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
    if (this.rotor) {
      this.rotor.clip.volume = this.rotor.gain * this.effects.volume;
    }
  }
}

// Шум, пока винты этого корпуса крутятся. Без плеера в registry матка молчит.
export function syncDroneRotors(scene: Phaser.Scene, token: number, spinning: boolean): void {
  const fx = scene.registry.get(REGISTRY_KEY);
  if (fx instanceof DroneCarrierSounds) {
    fx.setRotor(token, spinning);
  }
}
