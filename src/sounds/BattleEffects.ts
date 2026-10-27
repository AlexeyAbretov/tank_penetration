// Звуки боя, кроме музыки. Пауза и рестарт сцены глушат их одним вызовом.
// stop при гибели базы взрыв базы не трогает: он доигрывает.
// Новый клип добавляется здесь: поле и строка в clips. Сцена список не знает.
// gunnerShot, boomSounds, nuclearExplosion и пуск ракеты сами кладут себя в registry.
// Их всё равно создаём здесь, иначе пауза и destroy их не найдут.

import Phaser from 'phaser';
import { BoomSounds } from './BoomSounds';
import { AssaultExplosion } from './AssaultExplosion';
import { BulletHitTank } from './BulletHitTank';
import { EffectsVolume } from './EffectsVolume';
import { GunnerShot } from './GunnerShot';
import { ImpactSounds } from './ImpactSounds';
import { InfantryDeath } from './InfantryDeath';
import { NuclearExplosion } from './NuclearExplosion';
import { PickupExplosion } from './PickupExplosion';
import { RocketSounds } from './RocketSounds';
import { TankDeath } from './TankDeath';
import { TankMgShot } from './TankMgShot';
import { TankShot } from './TankShot';

// play у каждого клипа свой, поэтому в общий контракт он не входит.
type EffectClip = {
  setPaused(paused: boolean): void;
  stop(): void;
  destroy(): void;
};

export class BattleEffects {
  readonly tankShot: TankShot;
  readonly tankMgShot: TankMgShot;
  readonly gunnerShot: GunnerShot;
  readonly bulletHit: BulletHitTank;
  readonly rocketSounds: RocketSounds;
  readonly boomSounds: BoomSounds;
  readonly nuclearExplosion: NuclearExplosion;
  readonly impacts: ImpactSounds;
  readonly assaultExplosion: AssaultExplosion;
  readonly pickupExplosion: PickupExplosion;
  readonly infantryDeath: InfantryDeath;
  readonly tankDeath: TankDeath;
  private readonly gain: EffectsVolume;
  private readonly clips: EffectClip[];

  constructor(scene: Phaser.Scene) {
    this.gain = new EffectsVolume();
    this.tankShot = new TankShot(scene, this.gain);
    this.tankMgShot = new TankMgShot(scene, this.gain);
    this.gunnerShot = new GunnerShot(scene, this.gain);
    this.bulletHit = new BulletHitTank(scene, this.gain);
    this.rocketSounds = new RocketSounds(scene, this.gain);
    this.boomSounds = new BoomSounds(scene, this.gain);
    this.nuclearExplosion = new NuclearExplosion(scene, this.gain);
    this.impacts = new ImpactSounds(scene, this.gain);
    this.assaultExplosion = new AssaultExplosion(scene, this.gain);
    this.pickupExplosion = new PickupExplosion(scene, this.gain);
    this.infantryDeath = new InfantryDeath(scene, this.gain);
    this.tankDeath = new TankDeath(scene, this.gain);
    // Взрыв базы сюда не входит: пауза до него не доходит, stop при гибели его не обрывает.
    this.clips = [
      this.tankShot,
      this.tankMgShot,
      this.gunnerShot,
      this.bulletHit,
      this.rocketSounds,
      this.boomSounds,
      this.nuclearExplosion,
      this.impacts,
      this.assaultExplosion,
      this.pickupExplosion,
      this.infantryDeath,
    ];
  }

  get volume(): number {
    return this.gain.volume;
  }

  setVolume(level: number): void {
    this.gain.setVolume(level);
  }

  setPaused(paused: boolean): void {
    for (const clip of this.clips) {
      clip.setPaused(paused);
    }
  }

  // Гибель базы. Взрыв базы не обрываем: он как раз в этот момент доигрывает.
  stop(): void {
    for (const clip of this.clips) {
      clip.stop();
    }
  }

  destroy(): void {
    this.stop();
    for (const clip of this.clips) {
      clip.destroy();
    }
    this.tankDeath.destroy();
  }
}
