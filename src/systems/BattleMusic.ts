// Два лупа из public/audio: обычные волны и босс.
// Одинаковые волны трек не перезапускают. Смена темы — короткий кроссфейд.
// Пауза и гибель базы глушат звук сами: менеджер волн про музыку не знает.

import Phaser from 'phaser';
import { EnemyFactory } from '../entities/EnemyFactory';

// Громкость по умолчанию, если игрок ещё не двигал ползунок.
const DEFAULT_VOLUME = 0.45;
const VOLUME_KEY = 'tank-defense-music:v1';
// Миллисекунды стыка. Короче — щелчок, длиннее — две темы звучат вместе.
const FADE_MS = 600;

type Track = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;
type Theme = 'wave' | 'boss';

export class BattleMusic {
  private wave!: Track;
  private boss!: Track;
  private theme: Theme | null = null;
  // 0 — тишина, 1 — как записан файл. Ползунок пишет это число в localStorage.
  private level = readVolume();

  constructor(private readonly scene: Phaser.Scene) {}

  // Ключи кладёт preload сцены. Здесь звук только создаётся, не скачивается.
  create(): void {
    // Иначе возврат на вкладку включит контекст, пока игра ещё стоит на паузе.
    this.scene.sound.pauseOnBlur = false;
    this.wave = this.add('music-wave');
    this.boss = this.add('music-boss');
  }

  get volume(): number {
    return this.level;
  }

  // Ползунок. Текущий луп сразу берёт новую громкость, второй трек гаснет.
  setVolume(level: number): void {
    this.level = clamp01(level);
    writeVolume(this.level);
    this.applyVolume();
  }

  // Окно настроек открылось посреди кроссфейда: слышно должно быть ровно то, что на ползунке.
  applyVolume(): void {
    this.scene.tweens.killTweensOf([this.wave, this.boss]);
    const current = this.current();
    if (current) {
      current.volume = this.level;
    }
    const other = current === this.boss ? this.wave : this.boss;
    if (other !== current && (other.isPlaying || other.isPaused)) {
      other.stop();
    }
  }

  // Босс — каждая 10-я волна. Остальные номера берут спокойный луп.
  playForWave(wave: number): void {
    this.fadeTo(EnemyFactory.isBossWave(wave) ? 'boss' : 'wave');
  }

  setPaused(paused: boolean): void {
    const track = this.current();
    if (!track) {
      return;
    }
    if (paused) {
      if (track.isPlaying) {
        track.pause();
      }
      return;
    }
    if (track.isPaused) {
      track.resume();
    }
  }

  // Гибель базы. Твины громкости тоже снимаем, иначе они доиграют уже на тишине.
  stop(): void {
    this.scene.tweens.killTweensOf([this.wave, this.boss]);
    this.wave.stop();
    this.boss.stop();
    this.theme = null;
  }

  // Рестарт сцены оставляет звуки в общем менеджере. Без destroy они наложатся на новую партию.
  destroy(): void {
    this.stop();
    this.wave.destroy();
    this.boss.destroy();
  }

  private add(key: string): Track {
    return this.scene.sound.add(key, { loop: true, volume: 0 }) as Track;
  }

  private fadeTo(theme: Theme): void {
    if (this.theme === theme) {
      return;
    }
    const next = theme === 'boss' ? this.boss : this.wave;
    const previous = this.current();
    this.theme = theme;
    this.scene.tweens.killTweensOf(next);
    if (previous) {
      this.scene.tweens.killTweensOf(previous);
    }
    if (next.isPaused) {
      next.resume();
    }
    if (!next.isPlaying) {
      next.play({ loop: true, volume: 0 });
    }
    this.scene.tweens.add({
      targets: next,
      volume: this.level,
      duration: FADE_MS,
    });
    if (!previous || previous === next) {
      return;
    }
    this.scene.tweens.add({
      targets: previous,
      volume: 0,
      duration: FADE_MS,
      onComplete: () => {
        // Пока твин шёл, тема могла смениться ещё раз. Тогда этот трек уже снова нужен.
        if (this.current() === previous) {
          return;
        }
        previous.stop();
      },
    });
  }

  private current(): Track | null {
    if (this.theme === 'boss') {
      return this.boss;
    }
    if (this.theme === 'wave') {
      return this.wave;
    }
    return null;
  }
}

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) {
      return DEFAULT_VOLUME;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return DEFAULT_VOLUME;
    }
    return clamp01(value);
  } catch {
    return DEFAULT_VOLUME;
  }
}

function writeVolume(level: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(level));
  } catch {
    // Приватный режим: ползунок работает, пока открыта вкладка.
  }
}

function clamp01(level: number): number {
  return Math.min(1, Math.max(0, level));
}
