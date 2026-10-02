// Танк игрока. Это не один спрайт, а контейнер: корпус едет сам.
// Башня и ствол крутятся вместе вокруг точки, где башня стоит на крыше.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import {
  MUZZLE_FRAME,
  MUZZLE_PAINT,
  SHELL_FRAME,
  SHELL_PAINT,
  TANK_GUN_FRAME,
  TANK_HULL_FRAME,
  TANK_PAINT,
  TANK_TURRET_FRAME,
  type MuzzlePaint,
  type ShellPaint,
  type TankPaint,
} from '../gfx/looks';
import { bake } from '../gfx/textures';

export class Tank extends Phaser.GameObjects.Container {
  // Сборка корпуса и башни. Просмотр спрайтов берёт те же числа, что и конструктор.
  static readonly layout = {
    hullX: 8,
    hullY: 16,
    turretX: 18,
    turretY: -20,
    // 37 пикселей от левого края кадра: башня сидит там же, где сидела до отделения ствола.
    turretOriginX: 37 / 88,
    turretOriginY: 0.5,
    // Цапфа — центр маски, она утоплена в лоб башни.
    gunX: 58,
    gunY: -20,
    gunOriginX: 9 / 100,
    gunOriginY: 0.5,
    // Середина днища башни. Вокруг неё крутится вся башня, поэтому низ не сходит с крыши.
    seatX: 20,
    seatY: -4,
    muzzleLength: 76,
    hitLeft: 72,
    hitRight: 96,
    hitUp: 48,
    hitDown: 52,
  };

  // Откат ствола назад по его картинке, в пикселях. Башня при выстреле не сдвигается.
  static readonly recoilSlide = { kick: 8, ms: 40 };

  // Точка в системе танка: localX/localY заданы от сиденья башни, angle её поворот.
  static mounted(angle: number, localX: number, localY: number): { x: number; y: number } {
    const seat = Tank.layout;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: seat.seatX + localX * cos - localY * sin,
      y: seat.seatY + localX * sin + localY * cos,
    };
  }

  // Конец ствола в системе танка, без учёта отката.
  static muzzleAt(angle: number): { x: number; y: number } {
    const layout = Tank.layout;
    return Tank.mounted(
      angle,
      layout.gunX - layout.seatX + layout.muzzleLength,
      layout.gunY - layout.seatY,
    );
  }
  // Круглая вспышка у дула раздувается и гаснет. Её же показывает просмотр спрайтов.
  static readonly muzzleFlash = { scale: 1.6, ms: 90 };

  // Башня и ствол внутри. Крутится целиком, откат двигает только ствол.
  private readonly aim: Phaser.GameObjects.Container;
  private readonly gun: Phaser.GameObjects.Image;
  // Миллисекунды до следующего выстрела. 0 — можно стрелять.
  private cooldown = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Контейнер сам стоит в (x, y). Дети внутри задаются уже относительно этой точки.
    super(scene, x, y);

    const layout = Tank.layout;
    // Корпус чуть правее и ниже центра контейнера.
    const hull = scene.add.image(layout.hullX, layout.hullY, 'tank-hull');
    // Ось на днище башни. Дети заданы относительно неё, поэтому при наклоне низ стоит на месте.
    this.aim = scene.add.container(layout.seatX, layout.seatY);
    const turret = scene.add.image(layout.turretX - layout.seatX, layout.turretY - layout.seatY, 'tank-turret');
    turret.setOrigin(layout.turretOriginX, layout.turretOriginY);
    this.gun = scene.add.image(layout.gunX - layout.seatX, layout.gunY - layout.seatY, 'tank-gun');
    this.gun.setOrigin(layout.gunOriginX, layout.gunOriginY);
    // Ствол последним: маска на нём перекрывает лоб башни.
    this.aim.add([turret, this.gun]);

    this.add([hull, this.aim]);
    scene.add.existing(this);
    // Танк рисуется поверх солдат, снарядов и вспышек выстрела врага.
    this.setDepth(25);
    // Размер контейнера. Попадания пуль проверяются своим прямоугольником в containsPoint.
    this.  setSize(160, 96);
  }

  // Попала ли точка (пуля) в прямоугольник вокруг танка.
  // Границы подогнаны вручную под рисунок: влево 72, вправо 96, вверх 48, вниз 52.
  containsPoint(x: number, y: number): boolean {
    const hit = Tank.layout;
    return (
      x > this.x - hit.hitLeft &&
      x < this.x + hit.hitRight &&
      y > this.y - hit.hitUp &&
      y < this.y + hit.hitDown
    );
  }

  // Наводит башню и ствол на точку, обычно на курсор.
  aimAt(x: number, y: number): void {
    const layout = Tank.layout;
    // Ствол не проходит через сиденье: он выше днища на gunY - seatY.
    // Угол считается так, чтобы линия ствола, а не ось, смотрела в цель.
    const along = layout.gunX - layout.seatX;
    const above = layout.gunY - layout.seatY;
    const vx = x - (this.x + layout.seatX);
    const vy = y - (this.y + layout.seatY);
    const rise = -above;
    const reach = Math.hypot(vx, vy);
    let angle = Math.atan2(vy, vx);
    if (reach > rise) {
      const phi = Math.atan2(-vy, vx);
      const base = Math.asin(rise / reach);
      const forward = (turn: number) => {
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        const rx = along * c - above * s;
        const ry = along * s + above * c;
        return (vx - rx) * c + (vy - ry) * s;
      };
      const straight = base - phi;
      const other = Math.PI - base - phi;
      angle = forward(straight) >= forward(other) ? straight : other;
    }
    // Не смотрит назад и не в пол: угол зажат примерно от -49° до +49°.
    this.aim.setRotation(Phaser.Math.Clamp(angle, -0.85, 0.85));
  }

  // Сцена зовёт это каждый кадр, чтобы кулдаун уменьшался даже без выстрела.
  tick(delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
  }

  // Пытается выстрелить. null — ещё рано. Иначе координаты дула и угол ствола для снаряда.
  tryFire(): { x: number; y: number; angle: number } | null {
    if (this.cooldown > 0) {
      return null;
    }
    // Сразу занимаем кулдаун, чтобы зажатая кнопка мыши не выпускала снаряд каждый кадр.
    this.cooldown = GAME.fireDelay;
    const shot = this.getMuzzle();
    // Откат в координатах башни: минус X — назад вдоль ствола, угол башни уже учтён.
    const layout = Tank.layout;
    const restX = layout.gunX - layout.seatX;
    const restY = layout.gunY - layout.seatY;
    this.scene.tweens.killTweensOf(this.gun);
    this.gun.setPosition(restX, restY);
    this.scene.tweens.add({
      targets: this.gun,
      x: restX - Tank.recoilSlide.kick,
      duration: Tank.recoilSlide.ms,
      yoyo: true,
    });
    return shot;
  }

  // Мировые координаты конца ствола.
  private getMuzzle(): { x: number; y: number; angle: number } {
    const angle = this.aim.rotation;
    const point = Tank.mounted(angle, this.gun.x + Tank.layout.muzzleLength, this.gun.y);
    return {
      x: this.x + point.x,
      y: this.y + point.y,
      angle,
    };
  }

  // Корпус, башня, ствол, снаряд и вспышка. Сцена берёт их по именам
  // 'tank-hull', 'tank-turret', 'tank-gun', 'shell', 'muzzle'.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('tank-hull')) {
      this.createHull(scene);
    }
    if (!scene.textures.exists('tank-turret')) {
      this.createTurret(scene);
    }
    if (!scene.textures.exists('tank-gun')) {
      this.createGun(scene);
    }
    if (!scene.textures.exists('shell')) {
      this.createShell(scene);
    }
    if (!scene.textures.exists('muzzle')) {
      this.createMuzzle(scene);
    }
  }

  // Корпус танка, вид сбоку, нос смотрит вправо. Холст 176×110.
  private static createHull(scene: Phaser.Scene): void {
    bake(scene, 'tank-hull', TANK_HULL_FRAME.w, TANK_HULL_FRAME.h, (g) => this.renderHull(g));
  }

  static renderHull(g: Phaser.GameObjects.Graphics, paint: TankPaint = TANK_PAINT): void {
    // Тень под гусеницей.
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(90, 96, 150, 22);

    // Тёмная гусеница: скруглённый прямоугольник.
    // fillRoundedRect(x, y, ширина, высота, радиус углов).
    g.fillStyle(paint.track);
    g.fillRoundedRect(18, 58, 148, 38, 8);

    // Шесть катков внутри гусеницы. Шаг 22 пикселя.
    for (let i = 0; i < 6; i += 1) {
      const x = 36 + i * 22;
      g.fillStyle(paint.wheelOuter); // внешнее кольцо катка
      g.fillCircle(x, 78, 11);
      g.fillStyle(paint.wheelDisk); // диск светлее
      g.fillCircle(x, 78, 7);
      g.fillStyle(paint.wheelHub); // ось в центре
      g.fillCircle(x, 78, 3);
    }

    // Бронекорпус над гусеницей, три горизонтальные полосы: верх светлый, низ тёмный.
    g.fillStyle(paint.armor);
    g.fillRoundedRect(22, 28, 140, 44, 8);
    g.fillStyle(paint.armorLight);
    g.fillRoundedRect(28, 32, 128, 18, 6);
    g.fillStyle(paint.armorDark);
    g.fillRoundedRect(30, 50, 124, 16, 4);

    // Скошенный нос справа. Треугольник по трём точкам: (x1,y1), (x2,y2), (x3,y3).
    g.fillStyle(paint.nose);
    g.fillTriangle(150, 32, 168, 50, 150, 68);
    // Светлая вставка на носу.
    g.fillStyle(paint.noseLight);
    g.fillRect(148, 40, 16, 14);

    // Люк или ящик на левой части крыши и тёмная щель под ним.
    g.fillStyle(paint.hatch);
    g.fillRect(28, 36, 22, 10);
    g.fillRect(28, 48, 22, 4);
    // Четыре тонкие горизонтальные риски — решётка.
    g.lineStyle(1, paint.grill, 1);
    for (let i = 0; i < 4; i += 1) {
      // lineBetween(x1, y1, x2, y2) рисует один отрезок.
      g.lineBetween(30, 38 + i * 2, 48, 38 + i * 2);
    }

    // Две заклёпки на борту.
    g.fillStyle(paint.rivet);
    g.fillCircle(78, 46, 4);
    g.fillCircle(108, 46, 4);

    // Небольшие выступы по краям гусеницы: левый грязевой щиток и правый.
    g.fillStyle(paint.fender);
    g.fillRect(20, 62, 8, 18);
    g.fillRect(156, 64, 10, 14);
  }

  // Башня без ствола, вид сбоку с полоской крыши. В бою крутится вместе со стволом.
  private static createTurret(scene: Phaser.Scene): void {
    bake(scene, 'tank-turret', TANK_TURRET_FRAME.w, TANK_TURRET_FRAME.h, (g) => this.renderTurret(g));
  }

  static renderTurret(g: Phaser.GameObjects.Graphics, paint: TankPaint = TANK_PAINT): void {
    // Тот же ракурс, что у корпуса: борт сбоку и светлая полоса крыши сверху.
    // Круг с люком в центре читался как план сверху, корпус при этом был боком.
    g.fillStyle(paint.turretRoof);
    g.fillRoundedRect(8, 14, 62, 26, 7);
    // Светлая крыша — верхняя грань, как светлая полоса брони корпуса.
    g.fillStyle(paint.turretLight);
    g.fillRoundedRect(12, 16, 50, 10, 5);
    // Нижняя грань борта темнее.
    g.fillStyle(paint.turret);
    g.fillRoundedRect(12, 28, 50, 10, 4);

    // Скошенный лоб справа. Кончик прячется под маску, маска нарисована уже на стволе.
    g.fillStyle(paint.nose);
    g.fillTriangle(62, 16, 78, 27, 62, 40);
    g.fillStyle(paint.noseLight);
    g.fillRect(66, 22, 10, 8);

    // Люк на крыше: низкая коробка сбоку, не круг в центре башни.
    g.fillStyle(paint.hatch);
    g.fillRoundedRect(20, 4, 22, 12, 3);
    g.fillStyle(paint.hatchShine);
    g.fillRect(22, 6, 18, 3);

    // Смотровая щель и заклёпки на борту.
    g.fillStyle(paint.hatch);
    g.fillRect(42, 30, 14, 3);
    g.fillStyle(paint.rivet);
    g.fillCircle(28, 33, 3);
    g.fillCircle(52, 33, 3);
  }

  // Ствол и маска одной картинкой. Крутится не сама, а вместе с башней.
  private static createGun(scene: Phaser.Scene): void {
    bake(scene, 'tank-gun', TANK_GUN_FRAME.w, TANK_GUN_FRAME.h, (g) => this.renderGun(g));
  }

  static renderGun(g: Phaser.GameObjects.Graphics, paint: TankPaint = TANK_PAINT): void {
    // Маска выше ствола. Центр (9, 11) — цапфа, её же ставит origin картинки.
    g.fillStyle(paint.mask);
    g.fillRoundedRect(0, 2, 18, 18, 4);
    // Ствол выходит из середины маски, а не из её края.
    g.fillStyle(paint.barrel);
    g.fillRoundedRect(12, 5, 74, 12, 3);
    g.fillStyle(paint.barrelLight);
    g.fillRoundedRect(14, 7, 70, 4, 2);
    // Утолщение у дула.
    g.fillStyle(paint.muzzleRing);
    g.fillRect(82, 3, 10, 16);
    g.fillStyle(paint.barrel);
    g.fillRect(86, 5, 6, 12);
    // Светлый срез канала ствола.
    g.fillStyle(paint.bore);
    g.fillRect(90, 8, 4, 6);
  }

  // Снаряд танка — вытянутое свечение, не металлическая болванка. 54×22.
  private static createShell(scene: Phaser.Scene): void {
    bake(scene, 'shell', SHELL_FRAME.w, SHELL_FRAME.h, (g) => this.renderShell(g));
  }

  static renderShell(g: Phaser.GameObjects.Graphics, paint: ShellPaint = SHELL_PAINT): void {
    g.fillStyle(paint.outer, 0.35); // внешнее красное гало
    g.fillEllipse(27, 11, 54, 22);
    g.fillStyle(paint.mid, 0.8); // оранжевая середина, чуть смещена вправо — туда летит снаряд
    g.fillEllipse(30, 11, 40, 14);
    g.fillStyle(paint.core); // жёлтое ядро
    g.fillEllipse(34, 11, 26, 8);
    g.fillStyle(paint.tip); // белый кончик
    g.fillEllipse(40, 11, 12, 4);
  }

  // Круглая вспышка выстрела и взрыва. В игре её ещё красят режимом ADD, поэтому она светится.
  private static createMuzzle(scene: Phaser.Scene): void {
    bake(scene, 'muzzle', MUZZLE_FRAME.w, MUZZLE_FRAME.h, (g) => this.renderMuzzle(g));
  }

  static renderMuzzle(g: Phaser.GameObjects.Graphics, paint: MuzzlePaint = MUZZLE_PAINT): void {
    g.fillStyle(paint.outer, 0.5); // широкое оранжевое пятно
    g.fillCircle(24, 24, 22);
    g.fillStyle(paint.mid, 0.9); // жёлтый центр
    g.fillCircle(24, 24, 12);
    g.fillStyle(paint.core); // белая точка
    g.fillCircle(24, 24, 5);
  }
}
