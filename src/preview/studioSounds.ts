// Прослушивание файлов из public/audio без запуска боя.
// Громкость читается из тех же ползунков, что и в игре.
// Выстрел пушки, пулемёт, пуля врага, удар о броню, пуск ракеты, взрыв ракеты,
// залп артиллерии, разрыв снаряда, атомный взрыв, удар о стену, крик, взрыв пикапа и гибель базы
// сцена вызывает сама, когда в просмотре включены «Стрельба» и «Смерть».

import Phaser from 'phaser';
import { EnemyFactory } from '../entities/EnemyFactory';
import { BattleEffects } from '../sounds/BattleEffects';
import { BattleMusic } from '../sounds/BattleMusic';

export const SOUND_CLIPS = [
  { id: 'wave', label: 'Волна', title: 'TRACK_01.mp3', loop: true },
  { id: 'boss', label: 'Босс', title: 'boss.mp3', loop: true },
  { id: 'shot', label: 'Выстрел', title: 'tank_shot.mp3' },
  { id: 'mg', label: 'Пулемёт', title: 'tank_mg_shot.mp3' },
  { id: 'bullet', label: 'Пуля', title: 'gunner_shot.mp3' },
  { id: 'armor', label: 'Броня', title: 'bullet_hit_tank.mp3' },
  { id: 'rocket', label: 'Ракета', title: 'rocket_shot.mp3' },
  { id: 'burst', label: 'Разрыв', title: 'rocket_hit_tank.mp3' },
  { id: 'salvo', label: 'Залп', title: 'artillery_shot.mp3' },
  { id: 'crater', label: 'Воронка', title: 'artillery_explosion.mp3' },
  { id: 'nuclear', label: 'Атом', title: 'nuclear_explosion.mp3' },
  { id: 'impact', label: 'Удар', title: 'impact0.mp3, impact1.mp3, impact2.mp3' },
  { id: 'cry', label: 'Крик', title: 'infantry_dead0.mp3, infantry_dead1.mp3' },
  { id: 'assault', label: 'Штурм', title: 'assault_explosion.mp3' },
  { id: 'pickup', label: 'Пикап', title: 'pickup_exposion.mp3' },
  { id: 'base', label: 'База', title: 'tank_dead.mp3' },
] as const;

export type StudioSoundId = (typeof SOUND_CLIPS)[number]['id'];

export class StudioSounds {
  private readonly music: BattleMusic;
  private readonly fx: BattleEffects;
  private musicTheme: 'wave' | 'boss' | null = null;

  constructor(scene: Phaser.Scene) {
    this.music = new BattleMusic(EnemyFactory);
    this.music.bind(scene);
    this.music.create();
    this.fx = new BattleEffects(scene);
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.audio('music-wave', 'audio/TRACK_01.mp3');
    scene.load.audio('music-boss', 'audio/boss.mp3');
    scene.load.audio('tank-shot', 'audio/tank_shot.mp3');
    scene.load.audio('tank-mg-shot', 'audio/tank_mg_shot.mp3');
    scene.load.audio('gunner-shot', 'audio/gunner_shot.mp3');
    scene.load.audio('bullet-hit-tank', 'audio/bullet_hit_tank.mp3');
    scene.load.audio('tank-dead', 'audio/tank_dead.mp3');
    scene.load.audio('assault-explosion', 'audio/assault_explosion.mp3');
    scene.load.audio('pickup-explosion', 'audio/pickup_exposion.mp3');
    scene.load.audio('infantry-dead-0', 'audio/infantry_dead0.mp3');
    scene.load.audio('infantry-dead-1', 'audio/infantry_dead1.mp3');
    scene.load.audio('impact-0', 'audio/impact0.mp3');
    scene.load.audio('impact-1', 'audio/impact1.mp3');
    scene.load.audio('impact-2', 'audio/impact2.mp3');
    scene.load.audio('rocket-shot', 'audio/rocket_shot.mp3');
    scene.load.audio('rocket-hit-tank', 'audio/rocket_hit_tank.mp3');
    scene.load.audio('artillery-shot', 'audio/artillery_shot.mp3');
    scene.load.audio('boom', 'audio/artillery_explosion.mp3');
    scene.load.audio('nuclear-explosion', 'audio/nuclear_explosion.mp3');
  }

  // Кнопка на панели. Луп включается и выключается, короткий звук играет с начала.
  press(id: StudioSoundId): 'wave' | 'boss' | null {
    if (id === 'wave' || id === 'boss') {
      return this.toggleMusic(id);
    }
    if (id === 'shot') {
      this.shot();
    } else if (id === 'mg') {
      this.mg();
    } else if (id === 'bullet') {
      this.bullet();
    } else if (id === 'armor') {
      this.armor();
    } else if (id === 'rocket') {
      this.rocket();
    } else if (id === 'burst') {
      this.burst();
    } else if (id === 'salvo') {
      this.salvo();
    } else if (id === 'crater') {
      this.crater();
    } else if (id === 'nuclear') {
      this.nuclear();
    } else if (id === 'impact') {
      this.impact();
    } else if (id === 'cry') {
      this.cry();
    } else if (id === 'assault') {
      this.fx.assaultExplosion.play();
    } else if (id === 'pickup') {
      this.pickup();
    } else {
      this.base();
    }
    return this.musicTheme;
  }

  shot(): void {
    this.fx.tankShot.play();
  }

  mg(): void {
    this.fx.tankMgShot.play();
  }

  bullet(): void {
    this.fx.gunnerShot.play();
  }

  armor(): void {
    this.fx.bulletHit.play();
  }

  rocket(): void {
    this.fx.rocketSounds.playLaunch();
  }

  burst(): void {
    this.fx.rocketSounds.playHit();
  }

  salvo(): void {
    this.fx.boomSounds.playShot();
  }

  crater(): void {
    this.fx.boomSounds.playBoom();
  }

  nuclear(): void {
    this.fx.nuclearExplosion.play();
  }

  impact(): void {
    this.fx.impacts.play();
  }

  cry(): void {
    this.fx.infantryDeath.play();
  }

  pickup(): void {
    this.fx.pickupExplosion.play();
  }

  base(): void {
    this.fx.tankDeath.play();
  }

  // Смена спрайта. Недоигранный взрыв не должен висеть над другим рисунком.
  // Музыка остаётся: её выключают своей кнопкой.
  // stop боя взрыв базы не трогает, здесь его глушим отдельно.
  stopEffects(): void {
    this.fx.stop();
    this.fx.tankDeath.stop();
  }

  destroy(): void {
    this.fx.destroy();
    this.music.destroy();
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
