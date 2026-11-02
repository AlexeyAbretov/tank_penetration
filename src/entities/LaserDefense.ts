// Лазер под танком. Корпус стоит на месте, башня поворачивается к ракете в момент выстрела.

import Phaser, { GameObjects } from 'phaser';
import { exhaustAt, idleShift } from '../gfx/engine';

export class LaserDefense extends GameObjects.Container {
  static readonly hullKey = 'laser-hull';
  static readonly turretKey = 'laser-turret';
  // Пути в public/. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'laser-hull': 'assets/laser-hull.png',
    'laser-turret': 'assets/laser-turret.png',
  } as const;

  static readonly shop = {
    cost: 1000,
    fireIntervalMs: 3000,
    // Свежий пуск лазер не берёт: ракета успевает отойти от ракетчика.
    minFlightMs: 200,
  };

  // Ось — ноль контейнера, это пятка линзы на крыше. belowBelly опускает пятку ниже днища танка.
  static readonly mount = { belowBelly: 100 };

  // Корпус: крыша картинки на пятке линзы, середина гусениц под осью.
  // Линза: ось на нижней пятке, стекло смотрит вправо, луч выходит из середины стекла.
  static readonly layout = {
    hullX: 1.5,
    hullY: 13,
    turretOriginX: 43 / 96,
    turretOriginY: 53 / 64,
    muzzleX: 19,
    muzzleY: -23,
    // Корма слева: машина смотрит вправо. Дым выходит из крыши у заднего края.
    exhaustX: -40,
    exhaustY: 6,
  };

  private readonly hull: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private engine?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Сдвиг фазы, чтобы лазер не дрожал в тот же такт, что танк.
  private engineMs = 900;
  private readonly pivotPoint = new Phaser.Math.Vector2();
  private readonly muzzlePoint = new Phaser.Math.Vector2();
  private readonly exhaustPoint = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const layout = LaserDefense.layout;
    this.hull = scene.add.image(layout.hullX, layout.hullY, LaserDefense.hullKey);
    this.hull.setOrigin(0.5, 0.5);
    this.turret = scene.add.image(0, 0, LaserDefense.turretKey);
    this.turret.setOrigin(layout.turretOriginX, layout.turretOriginY);
    this.add([this.hull, this.turret]);

    const onIdle = (_time: number, delta: number) => this.idle(delta);
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
      this.stopEngine();
    });
  }

  // Корпус и башня дрожат одним сдвигом. Выхлоп едет вместе с кормой.
  private idle(delta: number): void {
    if (!this.visible) {
      this.stopEngine();
      return;
    }
    this.engineMs += delta;
    const shift = idleShift(this.engineMs);
    const layout = LaserDefense.layout;
    this.hull.setPosition(layout.hullX + shift.x, layout.hullY + shift.y);
    this.turret.setPosition(shift.x, shift.y);

    this.getWorldTransformMatrix().transformPoint(layout.exhaustX + shift.x, layout.exhaustY + shift.y, this.exhaustPoint);
    const at = this.exhaustPoint;
    if (!this.engine) {
      this.engine = exhaustAt(this.scene, at.x, at.y, 0.75);
      return;
    }
    this.engine.setPosition(at.x, at.y);
  }

  private stopEngine(): void {
    this.engine?.destroy();
    this.engine = undefined;
  }

  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  static ensureTextures(scene: Phaser.Scene): void {
    for (const key of [LaserDefense.hullKey, LaserDefense.turretKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  // Башня смотрит на точку, из линзы к ней тянется короткий луч.
  fireAt(x: number, y: number): void {
    const from = this.aimAt(x, y);
    this.drawBeam(from.x, from.y, x, y);
  }

  private aimAt(x: number, y: number): { x: number; y: number } {
    const pivot = this.pivotPoint;
    this.getWorldTransformMatrix().transformPoint(0, 0, pivot);
    const angle = Math.atan2(y - pivot.y, x - pivot.x);
    // Ствол остаётся в передней полусфере: в корпус танка он не разворачивается.
    this.turret.setRotation(Phaser.Math.Clamp(angle, -1.4, 1.4));

    const tip = this.muzzlePoint;
    this.turret.getWorldTransformMatrix().transformPoint(LaserDefense.layout.muzzleX, LaserDefense.layout.muzzleY, tip);
    return { x: tip.x, y: tip.y };
  }

  private drawBeam(x1: number, y1: number, x2: number, y2: number): void {
    const beam = this.scene.add.graphics().setDepth(26);
    beam.lineStyle(3, 0x3ad4ff, 0.45);
    beam.lineBetween(x1, y1, x2, y2);
    beam.lineStyle(1, 0xe8fffd, 1);
    beam.lineBetween(x1, y1, x2, y2);
    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 140,
      onComplete: () => beam.destroy(),
    });
  }
}
