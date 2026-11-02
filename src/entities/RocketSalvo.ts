// РСЗО над танком. Корпус дрожит и дымит сам. Куда сесть ракетам, решает бой.

import Phaser, { GameObjects } from 'phaser';
import { GAME } from '../gameConfig';
import { exhaustAt, idleShift, trailAt } from '../gfx/engine';
import { bake } from '../gfx/textures';
import { playRocketLaunch } from '../sounds/RocketSounds';

export type SalvoFlight = {
  cancel(): void;
};

type Point = { x: number; y: number };

export class RocketSalvo extends GameObjects.Container {
  static readonly hullKey = 'rocket-salvo';
  static readonly rocketKey = 'salvo-rocket';
  static readonly flameKey = 'salvo-flame';
  // Путь в public/. Строка буквальная: singlefile-сборка подменяет её на data:.
  static readonly imagePath = 'assets/rocket-salvo.png';

  static readonly frame = { w: 168, h: 112 };

  static readonly shop = {
    cost: 1000,
    fireIntervalMs: 5000,
    rockets: 3,
    damage: 20,
    blastRadius: 74,
    flightMs: 1100,
    gapMs: 90,
  };

  // Скорость прямого участка, пикселей в миллисекунду. Длина — до края экрана.
  static readonly aimSpeed = 180 / 320;

  // Дальняя половина поля: от середины экрана до правого края с отступом под воронку.
  static readonly field = {
    rightInset: 120,
    minY: 160,
    maxY: 540,
  };

  // Зазор между крышей танка и нижней кромкой колёс.
  static readonly mount = { aboveRoof: 200 };

  // Картинка: нос справа. Шахты — тёмная плита слева, носики труб — верхний правый край пакета.
  // Координаты от центра кадра. Низ колёс на wheelY, выхлоп у левой кормы.
  static readonly layout = {
    wheelY: 34,
    exhaustX: -78,
    exhaustY: 8,
    holes: [
      { x: -70, y: -23 },
      { x: -60, y: -19 },
      { x: -50, y: -15 },
    ],
    noses: [
      { x: -14, y: -38 },
      { x: -10, y: -42 },
      { x: -6, y: -44 },
    ],
  };

  private readonly hull: Phaser.GameObjects.Image;
  private engine?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Сдвиг фазы, чтобы установка не дрожала в тот же такт, что танк и лазер.
  private engineMs = 1700;
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly flights: SalvoFlight[] = [];
  private readonly worldPoint = new Phaser.Math.Vector2();
  private readonly exhaustPoint = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.hull = scene.add.image(0, 0, RocketSalvo.hullKey);
    this.hull.setOrigin(0.5, 0.5);
    this.add(this.hull);

    const onIdle = (_time: number, delta: number) => this.idle(delta);
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
      this.stopEngine();
      this.cancel();
    });
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(RocketSalvo.hullKey, RocketSalvo.imagePath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(RocketSalvo.hullKey)) {
      scene.textures.get(RocketSalvo.hullKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (!scene.textures.exists(RocketSalvo.rocketKey)) {
      bake(scene, RocketSalvo.rocketKey, 22, 8, (g) => RocketSalvo.renderRocket(g));
    }
    if (!scene.textures.exists(RocketSalvo.flameKey)) {
      bake(scene, RocketSalvo.flameKey, 28, 16, (g) => RocketSalvo.renderFlame(g));
    }
  }

  // Три точки с зазором, чтобы воронки не легли друг на друга.
  static impacts(): Point[] {
    const minGap = RocketSalvo.shop.blastRadius * 2;
    const points: Point[] = [];
    for (let i = 0; i < RocketSalvo.shop.rockets; i += 1) {
      let point = RocketSalvo.randomPoint();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const clear = points.every(
          (other) => Phaser.Math.Distance.Between(other.x, other.y, point.x, point.y) >= minGap,
        );
        if (clear) {
          break;
        }
        point = RocketSalvo.randomPoint();
      }
      points.push(point);
    }
    return points;
  }

  // Три ракеты с короткой задержкой. Огонь вспыхивает в шахте, ракета выходит из носика.
  // onImpact зовёт бой в точке падения: установка сама урон не считает.
  fire(targets: Point[], onImpact: (x: number, y: number) => void): void {
    const count = Math.min(targets.length, RocketSalvo.layout.noses.length);
    for (let i = 0; i < count; i += 1) {
      const target = targets[i];
      const timer = this.scene.time.delayedCall(i * RocketSalvo.shop.gapMs, () => {
        const at = this.timers.indexOf(timer);
        if (at >= 0) {
          this.timers.splice(at, 1);
        }
        this.flash(RocketSalvo.layout.holes[i], RocketSalvo.layout.noses[i]);
        const from = this.worldOf(RocketSalvo.layout.noses[i]);
        const back = this.worldOf(RocketSalvo.layout.holes[i]);
        const flight = this.fly(from, target, RocketSalvo.aimOf(back, from), onImpact);
        this.flights.push(flight);
      });
      this.timers.push(timer);
    }
  }

  private idle(delta: number): void {
    if (!this.visible) {
      this.stopEngine();
      return;
    }
    this.engineMs += delta;
    const shift = idleShift(this.engineMs);
    this.hull.setPosition(shift.x, shift.y);

    const layout = RocketSalvo.layout;
    this.getWorldTransformMatrix().transformPoint(layout.exhaustX + shift.x, layout.exhaustY + shift.y, this.exhaustPoint);
    const at = this.exhaustPoint;
    if (!this.engine) {
      this.engine = exhaustAt(this.scene, at.x, at.y, 0.75, true);
      return;
    }
    this.engine.setPosition(at.x, at.y);
  }

  private stopEngine(): void {
    this.engine?.destroy();
    this.engine = undefined;
  }

  private cancel(): void {
    for (const timer of this.timers) {
      timer.remove(false);
    }
    this.timers.length = 0;
    for (const flight of this.flights) {
      flight.cancel();
    }
    this.flights.length = 0;
  }

  // Правый край картинки сидит в шахте. Язык нарисован влево, поворот кладёт его вдоль трубы назад.
  private flash(hole: Point, nose: Point): void {
    const aim = RocketSalvo.aimOf(hole, nose);
    const flame = this.scene.add.image(this.hull.x + hole.x, this.hull.y + hole.y, RocketSalvo.flameKey);
    flame.setOrigin(1, 0.5);
    flame.setRotation(Math.atan2(aim.y, aim.x));
    flame.setBlendMode(Phaser.BlendModes.ADD);
    this.add(flame);
    this.scene.tweens.add({
      targets: flame,
      alpha: 0,
      scale: 1.6,
      duration: 160,
      onComplete: () => flame.destroy(),
    });
  }

  private worldOf(local: Point): Point {
    this.getWorldTransformMatrix().transformPoint(this.hull.x + local.x, this.hull.y + local.y, this.worldPoint);
    return { x: this.worldPoint.x, y: this.worldPoint.y };
  }

  // Сначала прямо по оси труб, потом дуга к точке. Дуга может уйти выше верхнего края.
  private fly(from: Point, to: Point, aim: Point, onImpact: (x: number, y: number) => void): SalvoFlight {
    const scene = this.scene;
    playRocketLaunch(scene);
    const rocket = scene.add.image(from.x, from.y, RocketSalvo.rocketKey).setDepth(26);
    rocket.setOrigin(1, 0.5);
    rocket.setRotation(Math.atan2(aim.y, aim.x));
    const smoke = trailAt(scene);
    const run = RocketSalvo.runToEdge(from, aim);
    const bend = { x: from.x + aim.x * run, y: from.y + aim.y * run };
    const lift = Phaser.Math.Between(180, 340);
    const apex = Math.min(bend.y, to.y) - lift;
    const straightMs = run / RocketSalvo.aimSpeed;
    const duration = straightMs + RocketSalvo.shop.flightMs;
    const split = straightMs / duration;
    const state = { t: 0 };
    let prev = { x: from.x, y: from.y };
    let puffMs = 0;
    let settled = false;
    let tween: Phaser.Tweens.Tween;
    const handle: SalvoFlight = {
      cancel() {
        release(false);
      },
    };

    const release = (impact: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      tween.stop();
      rocket.destroy();
      smoke.stop();
      scene.time.delayedCall(700, () => {
        if (smoke.scene) {
          smoke.destroy();
        }
      });
      const index = this.flights.indexOf(handle);
      if (index >= 0) {
        this.flights.splice(index, 1);
      }
      if (impact) {
        onImpact(to.x, to.y);
      }
    };

    tween = scene.tweens.add({
      targets: state,
      t: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        const t = state.t;
        const at =
          t < split
            ? {
                x: from.x + aim.x * run * (t / split),
                y: from.y + aim.y * run * (t / split),
              }
            : RocketSalvo.arc((t - split) / (1 - split), bend, to, apex);
        const dx = at.x - prev.x;
        const dy = at.y - prev.y;
        if (dx !== 0 || dy !== 0) {
          rocket.setRotation(Math.atan2(dy, dx));
        }
        rocket.setPosition(at.x, at.y);
        puffMs -= scene.game.loop.delta;
        if (puffMs <= 0) {
          puffMs = 22;
          const speed = Math.hypot(dx, dy) || 1;
          smoke.emitParticleAt(at.x - (dx / speed) * 10, at.y - (dy / speed) * 10, 1);
        }
        prev = at;
      },
      onComplete: () => release(true),
    });

    return handle;
  }

  // Сколько пикселей по оси трубы до рамки холста: верх, низ или бок.
  private static runToEdge(from: Point, aim: Point): number {
    let dist = Number.POSITIVE_INFINITY;
    const hit = (edge: number, origin: number, dir: number) => {
      if (Math.abs(dir) < 1e-4) {
        return;
      }
      const along = (edge - origin) / dir;
      if (along > 0) {
        dist = Math.min(dist, along);
      }
    };
    hit(0, from.x, aim.x);
    hit(GAME.width, from.x, aim.x);
    hit(0, from.y, aim.y);
    hit(GAME.height, from.y, aim.y);
    return Number.isFinite(dist) ? dist : 0;
  }

  // Куда смотрит труба: от шахты к носику.
  private static aimOf(back: Point, nose: Point): Point {
    const dx = nose.x - back.x;
    const dy = nose.y - back.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  // t от 0 до 1. Вертикаль — хорда минус горб, вершина горба в середине пути.
  private static arc(t: number, from: Point, to: Point, apex: number): Point {
    const baseY = from.y + (to.y - from.y) * t;
    const mid = (from.y + to.y) / 2;
    const hump = 4 * t * (1 - t);
    return {
      x: from.x + (to.x - from.x) * t,
      y: baseY - (mid - apex) * hump,
    };
  }

  private static randomPoint(): Point {
    const field = RocketSalvo.field;
    const minX = Math.ceil(GAME.width / 2);
    const maxX = Math.max(minX, GAME.width - field.rightInset);
    return {
      x: Phaser.Math.Between(minX, maxX),
      y: Phaser.Math.Between(field.minY, field.maxY),
    };
  }

  // Носик справа: картинку крутят углом скорости.
  private static renderRocket(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff6a18, 1);
    g.fillCircle(3, 4, 2);
    g.fillStyle(0xffe080, 1);
    g.fillCircle(4, 4, 1);
    g.fillStyle(0x3a4030, 1);
    g.fillRoundedRect(4, 2, 12, 4, 1);
    g.fillStyle(0xe8dcc0, 1);
    g.fillTriangle(14, 1, 21, 4, 14, 7);
  }

  // Правый край — шахта, языки растут влево.
  private static renderFlame(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff6a18, 1);
    g.fillTriangle(2, 8, 26, 2, 26, 14);
    g.fillStyle(0xffee66, 1);
    g.fillTriangle(10, 8, 26, 5, 26, 11);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(22, 8, 2);
  }
}
