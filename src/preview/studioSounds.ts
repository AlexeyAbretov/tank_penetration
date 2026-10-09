// Прослушивание файлов из public/audio без запуска боя.
// Громкость читается из тех же ползунков, что и в игре.
// Выстрел, удар о стену, крик и гибель базы сцена вызывает сама,
// когда в просмотре включены «Стрельба» и «Смерть».

import Phaser from 'phaser';
import { AssaultExplosion } from '../systems/AssaultExplosion';
import { BattleMusic } from '../systems/BattleMusic';
import { EffectsVolume } from '../systems/EffectsVolume';
import { ImpactSounds } from '../systems/ImpactSounds';
import { InfantryDeath } from '../systems/InfantryDeath';
import { TankDeath } from '../systems/TankDeath';
import { TankShot } from '../systems/TankShot';

export const SOUND_CLIPS = [
  { id: 'wave', label: 'Волна', title: 'TRACK_01.mp3', loop: true },
  { id: 'boss', label: 'Босс', title: 'boss.mp3', loop: true },
  { id: 'shot', label: 'Выстрел', title: 'tank_shot.mp3' },
  { id: 'impact', label: 'Удар', title: 'impact0.mp3, impact1.mp3, impact2.mp3' },
  { id: 'cry', label: 'Крик', title: 'infantry_dead0.mp3, infantry_dead1.mp3' },
  { id: 'assault', label: 'Штурм', title: 'assault_explosion.mp3' },
  { id: 'base', label: 'База', title: 'tank_dead.mp3' },
] as const;

export type StudioSoundId = (typeof SOUND_CLIPS)[number]['id'];

export class StudioSounds {
  private readonly music: BattleMusic;
  private readonly shotFx: TankShot;
  private readonly impacts: ImpactSounds;
  private readonly cryFx: InfantryDeath;
  private readonly assaultFx: AssaultExplosion;
  private readonly baseFx: TankDeath;
  private musicTheme: 'wave' | 'boss' | null = null;

  constructor(scene: Phaser.Scene) {
    const effects = new EffectsVolume();
    this.music = new BattleMusic(scene);
    this.music.create();
    this.shotFx = new TankShot(scene, effects);
    this.impacts = new ImpactSounds(scene, effects);
    this.cryFx = new InfantryDeath(scene, effects);
    this.assaultFx = new AssaultExplosion(scene, effects);
    this.baseFx = new TankDeath(scene, effects);
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.audio('music-wave', 'audio/TRACK_01.mp3');
    scene.load.audio('music-boss', 'audio/boss.mp3');
    scene.load.audio('tank-shot', 'audio/tank_shot.mp3');
    scene.load.audio('tank-dead', 'audio/tank_dead.mp3');
    scene.load.audio('assault-explosion', 'audio/assault_explosion.mp3');
    scene.load.audio('infantry-dead-0', 'audio/infantry_dead0.mp3');
    scene.load.audio('infantry-dead-1', 'audio/infantry_dead1.mp3');
    scene.load.audio('impact-0', 'audio/impact0.mp3');
    scene.load.audio('impact-1', 'audio/impact1.mp3');
    scene.load.audio('impact-2', 'audio/impact2.mp3');
  }

  // Кнопка на панели. Луп включается и выключается, короткий звук играет с начала.
  press(id: StudioSoundId): 'wave' | 'boss' | null {
    if (id === 'wave' || id === 'boss') {
      return this.toggleMusic(id);
    }
    if (id === 'shot') {
      this.shot();
    } else if (id === 'impact') {
      this.impact();
    } else if (id === 'cry') {
      this.cry();
    } else if (id === 'assault') {
      this.assaultFx.play();
    } else {
      this.base();
    }
    return this.musicTheme;
  }

  shot(): void {
    this.shotFx.play();
  }

  impact(): void {
    this.impacts.play();
  }

  cry(): void {
    this.cryFx.play();
  }

  base(): void {
    this.baseFx.play();
  }

  // Смена спрайта. Недоигранный взрыв не должен висеть над другим рисунком.
  // Музыка остаётся: её выключают своей кнопкой.
  stopEffects(): void {
    this.shotFx.stop();
    this.impacts.stop();
    this.cryFx.stop();
    this.assaultFx.stop();
    this.baseFx.stop();
  }

  destroy(): void {
    this.stopEffects();
    this.music.destroy();
    this.shotFx.destroy();
    this.impacts.destroy();
    this.cryFx.destroy();
    this.assaultFx.destroy();
    this.baseFx.destroy();
  }

  private toggleMusic(theme: 'wave' | 'boss'): 'wave' | 'boss' | null {
    if (this.musicTheme === theme) {
      this.music.stop();
      this.musicTheme = null;
      return null;
    }
    // 10-я волна в бою берёт босса, любая другая — спокойный луп.
    this.music.playForWave(theme === 'boss' ? 10 : 1);
    this.musicTheme = theme;
    return theme;
  }
}
