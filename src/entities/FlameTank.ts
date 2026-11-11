// Огнемёт между танком и РСЗО. Корпус дрожит и дымит, башня крутится.
// Струю, урон и огонь на конце считает бой.

import Phaser, { GameObjects } from 'phaser';
import { exhaustAt, idleShift } from '../gfx/engine';
import { paintQuiet } from '../gfx/looks';

export class FlameTank extends GameObjects.Container {
  static readonly hullKey = 'flame-hull';
  static readonly turretKey = 'flame-turret';
  // Пути в public/. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'flame-hull': 'assets/flame-hull.png',
    'flame-turret': 'assets/flame-turret.png',
  } as const;

  static readonly shop = {
    cost: 1000,
    fireIntervalMs: 10_000,
    // Поворот башни сверху вниз. Струя в это время уже бьёт.
    sweepMs: 900,
    // Огонь на дальнем конце струи. Срок общий: дуга гаснет вся сразу.
    patchMs: 2_000,
    // Сжатие в конце срока. Костры уменьшаются к основанию, а не пропадают разом.
    patchFadeMs: 400,
    // Выжженная полоса гаснет после костров.
    earthFadeMs: 500,
    // Языки на юните. Секунда горения снимает долю базового урона, уровень партии в неё не входит.
    burnMs: 2_000,
    burnTickMs: 1_000,
    burnShare: 0.2,
    // Доля ширины поля, на которую достаёт струя.
    reach: 0.25,
    streamDamage: 8,
    patchDamage: 8,
  };

  // Зазор между крышей танка и низом гусениц.
  static readonly mount = { aboveRoof: 74 };

  // Ось контейнера — центр кадра корпуса. Башня сидит на крыше чуть правее середины.
  // Срез ствола задан от оси башни: в покое смотрит вправо.
  static readonly layout = {
    trackY: 24,
    turretX: 16,
    turretY: -18,
    turretOriginX: 67 / 147,
    turretOriginY: 48 / 63,
    muzzleX: 54,
    muzzleY: -17,
    // Корма слева. Дым выходит из трубы на крыше.
    exhaustX: -77,
    exhaustY: -28,
  };

  // Круче этого башня не задирается: в корпус и в небо над собой она не смотрит.
  static readonly aimLimit = 1.25;

  private readonly hull: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private engine?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Сдвиг фазы, чтобы огнемёт не дрожал в такт танку, лазеру и РСЗО.
  private engineMs = 2500;
  private readonly muzzlePoint = new Phaser.Math.Vector2();
  private readonly exhaustPoint = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const layout = FlameTank.layout;
    this.hull = scene.add.image(0, 0, FlameTank.hullKey);
    this.hull.setOrigin(0.5, 0.5);
    this.turret = scene.add.image(layout.turretX, layout.turretY, FlameTank.turretKey);
    this.turret.setOrigin(layout.turretOriginX, layout.turretOriginY);
    this.add([this.hull, this.turret]);

    const onIdle = (_time: number, delta: number) => this.idle(delta);
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
      this.stopEngine();
    });
  }

  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  static ensureTextures(scene: Phaser.Scene): void {
    for (const key of [FlameTank.hullKey, FlameTank.turretKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  // Корпус или башня. Струя в хитбокс не входит.
  containsPoint(x: number, y: number): boolean {
    return this.hull.getBounds().contains(x, y) || this.turret.getBounds().contains(x, y);
  }

  setQuiet(quiet: boolean): void {
    paintQuiet(this.hull, quiet);
    paintQuiet(this.turret, quiet);
  }

  setAim(angle: number): void {
    this.turret.setRotation(angle);
  }

  // Срез ствола в координатах поля.
  muzzle(): { x: number; y: number } {
    const layout = FlameTank.layout;
    this.turret.getWorldTransformMatrix().transformPoint(layout.muzzleX, layout.muzzleY, this.muzzlePoint);
    return { x: this.muzzlePoint.x, y: this.muzzlePoint.y };
  }

  private idle(delta: number): void {
    if (!this.visible) {
      this.stopEngine();
      return;
    }
    this.engineMs += delta;
    const shift = idleShift(this.engineMs);
    const layout = FlameTank.layout;
    this.hull.setPosition(shift.x, shift.y);
    this.turret.setPosition(layout.turretX + shift.x, layout.turretY + shift.y);

    this.getWorldTransformMatrix().transformPoint(
      layout.exhaustX + shift.x,
      layout.exhaustY + shift.y,
      this.exhaustPoint,
    );
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
}
