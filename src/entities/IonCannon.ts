// Ионная пушка: столб энергии с неба пересекает поле от одного края до другого.
// Покупка открывает вызов по клавише 4 и по иконке. Ход луча и урон считает CombatSystem.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { bake } from '../gfx/textures';
import type { WorldPoint } from '../types/WorldPoint';

type Edge = 'left' | 'right' | 'top' | 'bottom';

export type IonCourse = {
  from: WorldPoint;
  to: WorldPoint;
  // Левее этой линии столб не встаёт. 0 — левый край поля.
  minX: number;
};

export class IonCannon {
  static readonly iconKey = 'ion-icon';
  static readonly iconRadius = 30;

  static readonly shop = {
    cost: 100,
    damage: 50,
    cooldownMs: 60_000,
    // Сколько луч идёт от края до края.
    sweepMs: 5_000,
    // Половина толщины столба. Кто ближе к оси, тот под лучом.
    radius: 24,
    // Выжженная полоса после того, как столб уже погас.
    scorchMs: 3_000,
    // Воронка в точке появления. Тот же срок после погасшего столба.
    craterMs: 3_000,
  };

  // Вместе с магазином очков откат не короче 20 с. У каждого магазина свой запас в 20 с, шаг — 1 с.
  static readonly minCooldownMs = 20_000;
  static readonly cooldownStepMs = 1_000;
  static readonly shopCutMsMax = 20_000;
  static readonly progressCutMsMax = 20_000;
  static progressCooldownLevel = 0;
  // Сколько секунд партия уже докупила в этом заходе. Прогресс читает это, чтобы карточка показывала текущий откат.
  static shopCooldownLevel = 0;

  static setShopCooldownLevel(level: number): void {
    IonCannon.shopCooldownLevel = Math.min(
      IonCannon.maxShopCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  static get maxShopCooldownLevel(): number {
    return IonCannon.shopCutMsMax / IonCannon.cooldownStepMs;
  }

  static get maxProgressCooldownLevel(): number {
    return IonCannon.progressCutMsMax / IonCannon.cooldownStepMs;
  }

  static setProgressCooldownLevel(level: number): void {
    IonCannon.progressCooldownLevel = Math.min(
      IonCannon.maxProgressCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Свой запас прогресса уже выбран — следующий уровень откат не укорачивает.
  static progressCooldownShortens(progressLevel: number): boolean {
    const shop = IonCannon.shopCooldownLevel;
    return IonCannon.cooldownFor(shop, progressLevel + 1) < IonCannon.cooldownFor(shop, progressLevel);
  }

  static cooldownFor(shopLevel: number, progressLevel = IonCannon.progressCooldownLevel): number {
    const progressCut = Math.min(
      IonCannon.progressCutMsMax,
      Math.max(0, Math.round(progressLevel)) * IonCannon.cooldownStepMs,
    );
    const shopCut = Math.min(
      IonCannon.shopCutMsMax,
      Math.max(0, Math.round(shopLevel)) * IonCannon.cooldownStepMs,
    );
    return Math.max(IonCannon.minCooldownMs, IonCannon.shop.cooldownMs - progressCut - shopCut);
  }

  // Дольше минуты — как на иконке: 1:00, следующий шаг 59 с. Пол — 20 с.
  static cooldownLabel(ms: number): string {
    const totalSec = ms / 1000;
    if (totalSec < 60) {
      const text = Number.isInteger(totalSec) ? String(totalSec) : totalSec.toFixed(1);
      return `${text} с`;
    }
    const min = Math.floor(totalSec / 60);
    const sec = totalSec - min * 60;
    const secText = Number.isInteger(sec) ? String(sec).padStart(2, '0') : sec.toFixed(1).padStart(4, '0');
    return `${min}:${secText}`;
  }

  // Отдельного файла в public нет: иконку печёт ensureTextures уже в create.
  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists(IonCannon.iconKey)) {
      return;
    }
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(IonCannon.iconKey)) {
      return;
    }
    bake(scene, IonCannon.iconKey, 64, 64, (g) => IonCannon.renderIcon(g));
  }

  // through — место одного живого врага в момент пуска. Прямая через него упирается в два края.
  // В ход кладутся только эти края: дальше враг может уйти, линия не следует за ним.
  // null — на поле никого нет, оба края случайные и по-прежнему разные.
  // Отрезок короче половины ширины поля не берём: иначе пятно может встать в углу и пройти рядом.
  // Низ поля — линия баннера: ниже уже лента, не бой.
  // limitX — правый край проволоки. Столб держит свой радиус справа от него и за витки не заходит.
  // 0 — проволоки нет, левый край поля открыт.
  // insetX и insetY — отступ старта от края кадра, чтобы воронка была видна целиком.
  // Конец остаётся на краю. У проволоки левый край и так дальше этого отступа.
  static course(limitX: number, through: WorldPoint | null, insetX = 0, insetY = 0): IonCourse {
    const width = Math.max(1, Math.round(GAME.width));
    const floorY = GAME.bannerY;
    const margin = limitX > 0 ? Math.ceil(IonCannon.shop.radius * 1.2) : 0;
    const minX = Phaser.Math.Clamp(Math.ceil(limitX) + margin, 0, width - 1);
    const padX = Math.max(0, insetX);
    const padY = Math.max(0, insetY);
    if (through && width > minX) {
      return IonCannon.courseThrough(minX, width, floorY, through, padX, padY);
    }
    return IonCannon.courseRandom(minX, width, floorY, padX, padY);
  }

  static pointAt(course: IonCourse, t: number): WorldPoint {
    const k = Phaser.Math.Clamp(t, 0, 1);
    return {
      x: course.from.x + (course.to.x - course.from.x) * k,
      y: course.from.y + (course.to.y - course.from.y) * k,
    };
  }

  // Верх столба за кадром, строго над пятном. Луч отвесный относительно поля, без наклона по ходу.
  static skyPoint(at: WorldPoint): WorldPoint {
    return { x: at.x, y: -36 };
  }

  // Столб отвесный, поэтому разрез вертикальный: половины падают влево и вправо.
  static columnAngle(): number {
    return Math.PI / 2;
  }

  // Подошва на отрезке, который пятно прошло за кадр. Столб выше неё мимо врага проходит и не бьёт.
  // reach — насколько близко к центру цели считается попадание. У солдата это радиус пятна,
  // у крупной цели бой передаёт её круг, иначе пятно берёт только середину.
  // Шаг меньше радиуса пятна, чтобы рывок кадра никого не перепрыгнул.
  static covers(point: WorldPoint, from: WorldPoint, to: WorldPoint, reach = IonCannon.shop.radius): boolean {
    const reach2 = reach * reach;
    const span = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const steps = Math.max(1, Math.ceil(span / (IonCannon.shop.radius * 0.75)));
    for (let i = 0; i <= steps; i += 1) {
      const k = i / steps;
      const x = from.x + (to.x - from.x) * k - point.x;
      const y = from.y + (to.y - from.y) * k - point.y;
      if (x * x + y * y <= reach2) {
        return true;
      }
    }
    return false;
  }

  // Столб. Выжженную полосу под ним рисует общий след, не эта картинка.
  static paint(
    beam: Phaser.GameObjects.Graphics,
    at: WorldPoint,
    minX: number,
    now: number,
  ): void {
    const sky = IonCannon.skyPoint(at);
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.04);
    const radius = IonCannon.shop.radius;
    beam.clear();
    beam.lineStyle(radius * 2, 0x2f7bff, 0.28 + pulse * 0.12);
    beam.lineBetween(sky.x, sky.y, at.x, at.y);
    beam.lineStyle(14, 0x8adfff, 0.72);
    beam.lineBetween(sky.x, sky.y, at.x, at.y);
    beam.lineStyle(4, 0xf4fdff, 0.95);
    beam.lineBetween(sky.x, sky.y, at.x, at.y);
    beam.fillStyle(0xb7f4ff, 0.45);
    beam.fillEllipse(at.x, at.y, radius * 2.4, radius * 0.7);
    beam.fillStyle(0xffffff, 0.95);
    beam.fillCircle(at.x, at.y, 4);
    for (let i = 0; i < 3; i += 1) {
      const spin = now * 0.01 + i * 2.1;
      const reach = 8 + i * 6;
      beam.fillStyle(0xd8f6ff, 0.65);
      beam.fillCircle(
        Math.max(minX, at.x + Math.cos(spin) * reach),
        at.y + Math.sin(spin) * reach * 0.35,
        1.6,
      );
    }
  }

  private static courseRandom(
    minX: number,
    width: number,
    floorY: number,
    insetX: number,
    insetY: number,
  ): IonCourse {
    const need = IonCannon.minCourseLength(width);
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const raw = IonCannon.randomEdges(minX, width, floorY);
      const course = IonCannon.withSeatedStart(raw, minX, width, floorY, insetX, insetY);
      if (course && IonCannon.pathLength(course.from, course.to) >= need) {
        return course;
      }
    }
    return IonCannon.spanWidth(
      minX,
      width,
      floorY,
      Phaser.Math.Between(0, floorY),
      Phaser.Math.Between(0, floorY),
      insetX,
      insetY,
    );
  }

  private static randomEdges(minX: number, width: number, floorY: number): IonCourse {
    const edges: Edge[] = ['left', 'right', 'top', 'bottom'];
    const fromEdge = edges[Phaser.Math.Between(0, edges.length - 1)];
    const others = edges.filter((edge) => edge !== fromEdge);
    const toEdge = others[Phaser.Math.Between(0, others.length - 1)];
    return {
      from: IonCannon.edgePoint(fromEdge, width, floorY, minX),
      to: IonCannon.edgePoint(toEdge, width, floorY, minX),
      minX,
    };
  }

  // Случайное направление через точку. Оба конца — первые стенки поля по этой прямой.
  // Точка левее проволоки прижимается к линии перед витками: за них ход не заходит.
  // Если угол даёт короткий отрезок, берём другое направление. Запасной ход — поперёк поля через ту же точку.
  private static courseThrough(
    minX: number,
    width: number,
    floorY: number,
    through: WorldPoint,
    insetX: number,
    insetY: number,
  ): IonCourse {
    const aim = {
      x: Phaser.Math.Clamp(through.x, minX, width),
      y: Phaser.Math.Clamp(through.y, 0, floorY),
    };
    const need = IonCannon.minCourseLength(width);
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const raw = IonCannon.lineThrough(minX, width, floorY, aim);
      const course = raw && IonCannon.withSeatedStart(raw, minX, width, floorY, insetX, insetY);
      if (course && IonCannon.pathLength(course.from, course.to) >= need) {
        return course;
      }
    }
    return IonCannon.spanWidth(minX, width, floorY, aim.y, aim.y, insetX, insetY);
  }

  private static lineThrough(
    minX: number,
    width: number,
    floorY: number,
    aim: WorldPoint,
  ): IonCourse | null {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const from = IonCannon.boundaryExit(aim, -dx, -dy, minX, width, 0, floorY);
    const to = IonCannon.boundaryExit(aim, dx, dy, minX, width, 0, floorY);
    if (IonCannon.pathLength(from, to) < 1) {
      return null;
    }
    return { from, to, minX };
  }

  // Поперёк поля. Длина не меньше открытой ширины, значит и не меньше половины всего поля.
  // Разные y у краёв оставляют прямую через точку, только когда оба равны её высоте.
  private static spanWidth(
    minX: number,
    width: number,
    floorY: number,
    fromY: number,
    toY: number,
    insetX: number,
    insetY: number,
  ): IonCourse {
    const left = { x: minX, y: Phaser.Math.Clamp(fromY, 0, floorY) };
    const right = { x: width, y: Phaser.Math.Clamp(toY, 0, floorY) };
    const flip = Phaser.Math.Between(0, 1) === 1;
    const course = {
      from: flip ? left : right,
      to: flip ? right : left,
      minX,
    };
    const seated = IonCannon.withSeatedStart(course, minX, width, floorY, insetX, insetY);
    if (seated) {
      return seated;
    }
    return {
      ...course,
      from: IonCannon.clampInside(course.from, minX, width, floorY, insetX, insetY),
    };
  }

  // Старт сдвигается вдоль уже выбранной прямой, пока чаша не встанет в кадр.
  // null — прямая идёт по самому краю и внутрь не заходит.
  private static withSeatedStart(
    course: IonCourse,
    minX: number,
    width: number,
    floorY: number,
    insetX: number,
    insetY: number,
  ): IonCourse | null {
    const from = IonCannon.seatOnLine(course.from, course.to, minX, width, floorY, insetX, insetY);
    if (!from) {
      return null;
    }
    return { ...course, from };
  }

  private static seatOnLine(
    from: WorldPoint,
    to: WorldPoint,
    minX: number,
    width: number,
    floorY: number,
    insetX: number,
    insetY: number,
  ): WorldPoint | null {
    const box = IonCannon.insetBox(minX, width, floorY, insetX, insetY);
    if (!box) {
      return from;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let t0 = 0;
    let t1 = 1;
    const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) < 1e-8) {
        return q >= -1e-6;
      }
      const r = q / p;
      if (p < 0) {
        if (r > t1) {
          return false;
        }
        if (r > t0) {
          t0 = r;
        }
      } else if (r < t0) {
        return false;
      } else if (r < t1) {
        t1 = r;
      }
      return true;
    };
    const hits =
      clip(-dx, from.x - box.left) &&
      clip(dx, box.right - from.x) &&
      clip(-dy, from.y - box.top) &&
      clip(dy, box.bottom - from.y);
    if (!hits || t0 > t1) {
      return null;
    }
    return { x: from.x + dx * t0, y: from.y + dy * t0 };
  }

  private static clampInside(
    point: WorldPoint,
    minX: number,
    width: number,
    floorY: number,
    insetX: number,
    insetY: number,
  ): WorldPoint {
    const box = IonCannon.insetBox(minX, width, floorY, insetX, insetY);
    if (!box) {
      return point;
    }
    return {
      x: Phaser.Math.Clamp(point.x, box.left, box.right),
      y: Phaser.Math.Clamp(point.y, box.top, box.bottom),
    };
  }

  // Прямоугольник, в котором центр чаши не вылезает за кадр. null — отступ съел поле.
  private static insetBox(
    minX: number,
    width: number,
    floorY: number,
    insetX: number,
    insetY: number,
  ): { left: number; right: number; top: number; bottom: number } | null {
    const left = Math.max(minX, insetX);
    const right = width - insetX;
    const top = insetY;
    const bottom = floorY - insetY;
    if (right - left < 1 || bottom - top < 1) {
      return null;
    }
    return { left, right, top, bottom };
  }

  private static pathLength(from: WorldPoint, to: WorldPoint): number {
    return Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
  }

  private static minCourseLength(width: number): number {
    return width / 2;
  }

  // Ближайшая стенка по лучу. Ноль, если точка уже на стенке и луч смотрит наружу.
  private static boundaryExit(
    origin: WorldPoint,
    dx: number,
    dy: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): WorldPoint {
    const epsilon = 1e-8;
    let t = Number.POSITIVE_INFINITY;
    if (dx > epsilon) {
      t = Math.min(t, (maxX - origin.x) / dx);
    } else if (dx < -epsilon) {
      t = Math.min(t, (minX - origin.x) / dx);
    }
    if (dy > epsilon) {
      t = Math.min(t, (maxY - origin.y) / dy);
    } else if (dy < -epsilon) {
      t = Math.min(t, (minY - origin.y) / dy);
    }
    if (!Number.isFinite(t) || t < 0) {
      t = 0;
    }
    return {
      x: Phaser.Math.Clamp(origin.x + dx * t, minX, maxX),
      y: Phaser.Math.Clamp(origin.y + dy * t, minY, maxY),
    };
  }

  private static edgePoint(edge: Edge, width: number, floorY: number, minX: number): WorldPoint {
    switch (edge) {
      case 'left':
        return { x: minX, y: Phaser.Math.Between(0, floorY) };
      case 'right':
        return { x: width, y: Phaser.Math.Between(0, floorY) };
      case 'top':
        return { x: Phaser.Math.Between(minX, width), y: 0 };
      case 'bottom':
        return { x: Phaser.Math.Between(minX, width), y: floorY };
    }
  }

  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x061018);
    g.fillCircle(32, 32, IonCannon.iconRadius);
    g.fillStyle(0x0c2436);
    g.fillCircle(32, 32, 26);
    g.lineStyle(3, 0xf0d56a, 1);
    g.strokeCircle(32, 32, 28);
    g.lineStyle(10, 0x1a6cff, 0.9);
    g.lineBetween(32, 8, 32, 46);
    g.lineStyle(4, 0x8adfff, 1);
    g.lineBetween(32, 8, 32, 46);
    g.lineStyle(1.5, 0xffffff, 1);
    g.lineBetween(32, 10, 32, 44);
    g.fillStyle(0xb7f4ff, 0.95);
    g.fillEllipse(32, 48, 22, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(32, 46, 2.5);
  }
}
