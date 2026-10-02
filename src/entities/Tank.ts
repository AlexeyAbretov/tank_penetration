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
  TANK_WRECK_FRAME,
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

  // Размеры ядерного гриба в пикселях корпуса. Просмотр берёт те же числа,
  // чтобы шапка помещалась в кадр вместе с обломками.
  static readonly doom = {
    rise: 168,
    half: 210,
  };

  static readonly wreckKey = 'tank-wreck';

  // Башня и ствол внутри. Крутится целиком, откат двигает только ствол.
  private readonly aim: Phaser.GameObjects.Container;
  private readonly hull: Phaser.GameObjects.Image;
  private readonly gun: Phaser.GameObjects.Image;
  // После гибели корпус уже спрятан, повторный die ничего не делает.
  private dead = false;
  // Редкий выхлоп, пока мотор работает. Гаснет в момент гибели.
  private engine?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Столб над обломками. Живёт, пока контейнер танка на сцене.
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Сколько миллисекунд танк уже тарахтит. Из этого времени считается тряска.
  private engineMs = 0;
  // Миллисекунды до следующего выстрела. 0 — можно стрелять.
  private cooldown = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Контейнер сам стоит в (x, y). Дети внутри задаются уже относительно этой точки.
    super(scene, x, y);

    const layout = Tank.layout;
    // Корпус чуть правее и ниже центра контейнера.
    this.hull = scene.add.image(layout.hullX, layout.hullY, 'tank-hull');
    // Ось на днище башни. Дети заданы относительно неё, поэтому при наклоне низ стоит на месте.
    this.aim = scene.add.container(layout.seatX, layout.seatY);
    const turret = scene.add.image(layout.turretX - layout.seatX, layout.turretY - layout.seatY, 'tank-turret');
    turret.setOrigin(layout.turretOriginX, layout.turretOriginY);
    this.gun = scene.add.image(layout.gunX - layout.seatX, layout.gunY - layout.seatY, 'tank-gun');
    this.gun.setOrigin(layout.gunOriginX, layout.gunOriginY);
    // Ствол последним: маска на нём перекрывает лоб башни.
    this.aim.add([turret, this.gun]);

    this.add([this.hull, this.aim]);
    scene.add.existing(this);
    // Танк рисуется поверх солдат, снарядов и вспышек выстрела врага.
    this.setDepth(25);
    // Размер контейнера. Попадания пуль проверяются своим прямоугольником в containsPoint.
    this.setSize(160, 96);
    const exhaust = Tank.exhaustAnchor();
    this.engine = Tank.engineAt(scene, x + exhaust.x, y + exhaust.y);
    // preupdate идёт каждый кадр, даже когда сцена боя сама стоит на паузе магазина.
    const onIdle = (_time: number, delta: number) => this.idle(delta);
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
    this.once('destroy', () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
      this.stopEngine();
      this.smoke?.destroy();
    });
  }

  // Лёгкая тряска всего живого танка и выхлоп, который едет вместе с кормой.
  private idle(delta: number): void {
    if (this.dead || !this.engine) {
      return;
    }
    this.engineMs += delta;
    const wobble = this.engineMs * 0.028;
    const dx = Math.sin(wobble) * 0.45 + Math.sin(wobble * 2.17) * 0.28;
    const dy = Math.cos(wobble * 1.31) * 0.35 + Math.sin(wobble * 2.63) * 0.18;
    const layout = Tank.layout;
    this.hull.setPosition(layout.hullX + dx, layout.hullY + dy);
    this.aim.setPosition(layout.seatX + dx, layout.seatY + dy);
    const exhaust = Tank.exhaustAnchor();
    this.engine.setPosition(this.x + exhaust.x + dx, this.y + exhaust.y + dy);
  }

  private stopEngine(): void {
    this.engine?.destroy();
    this.engine = undefined;
  }

  // Попала ли точка (пуля) в прямоугольник вокруг танка.
  // Границы подогнаны вручную под рисунок: влево 72, вправо 96, вверх 48, вниз 52.
  // Мёртвый танк пуль уже не ловит: на его месте только обломки.
  containsPoint(x: number, y: number): boolean {
    if (this.dead) {
      return false;
    }
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

  // Гибель базы: живой танк гаснет, на его месте остаётся куча обломков,
  // а над ней на секунду встаёт ядерный гриб.
  die(): void {
    if (this.dead) {
      return;
    }
    this.dead = true;
    this.stopEngine();
    this.scene.tweens.killTweensOf(this.gun);
    for (const child of [...this.list]) {
      const node = child as unknown as Phaser.GameObjects.Components.Visible;
      node.setVisible(false);
    }
    const layout = Tank.layout;
    if (!this.scene.textures.exists(Tank.wreckKey)) {
      Tank.createWreck(this.scene);
    }
    const wreck = this.scene.add.image(layout.hullX, layout.hullY, Tank.wreckKey);
    this.add(wreck);
    // Взрыв чуть выше середины корпуса: оттуда растёт ножка гриба.
    Tank.nukeAt(this.scene, this.x + layout.hullX, this.y + layout.hullY - 12);
    const anchor = Tank.smokeAnchor();
    this.smoke = Tank.smokeAt(this.scene, this.x + anchor.x, this.y + anchor.y);
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
    if (!scene.textures.exists(Tank.wreckKey)) {
      this.createWreck(scene);
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

  // Куча обломков вместо целого танка. Кадр шире корпуса: башня и ствол лежат рядом.
  private static createWreck(scene: Phaser.Scene): void {
    bake(scene, Tank.wreckKey, TANK_WRECK_FRAME.w, TANK_WRECK_FRAME.h, (g) => this.renderWreck(g));
  }

  static renderWreck(g: Phaser.GameObjects.Graphics, paint: TankPaint = TANK_PAINT): void {
    // Центр кадра совпадает с центром живого корпуса. Земля — на 41 пиксель ниже, как тень гусеницы.
    const ground = TANK_WRECK_FRAME.h / 2 + 41;

    g.fillStyle(0x120806, 0.9);
    g.fillEllipse(118, ground + 2, 210, 30);
    g.fillStyle(0x4a160c, 0.65);
    g.fillEllipse(124, ground, 108, 16);

    // Гусеница разорвана на два куска, один каток выпал и лежит плашмя.
    g.fillStyle(paint.track);
    g.fillRoundedRect(36, ground - 18, 72, 20, 4);
    g.fillRoundedRect(138, ground - 12, 48, 14, 3);
    g.fillStyle(paint.wheelOuter);
    g.fillEllipse(28, ground - 2, 26, 14);
    g.fillStyle(paint.wheelDisk);
    g.fillEllipse(28, ground - 2, 14, 7);
    g.fillStyle(paint.wheelOuter);
    g.fillCircle(58, ground - 10, 9);
    g.fillStyle(paint.wheelDisk);
    g.fillCircle(58, ground - 10, 5);
    g.fillStyle(paint.wheelHub);
    g.fillCircle(58, ground - 10, 2);
    g.fillStyle(paint.wheelOuter);
    g.fillCircle(84, ground - 8, 8);
    g.fillStyle(paint.wheelDisk);
    g.fillCircle(84, ground - 8, 4);
    g.fillStyle(paint.wheelOuter);
    g.fillEllipse(168, ground - 4, 22, 16);
    g.fillStyle(paint.wheelDisk);
    g.fillEllipse(168, ground - 4, 10, 7);

    // Корпус просел и выгорел. В борту дыра, из неё ещё торчит пламя.
    g.fillStyle(0x140e0a);
    g.fillRoundedRect(44, ground - 42, 108, 32, 4);
    g.fillStyle(paint.armorDark);
    g.fillRoundedRect(50, ground - 36, 64, 16, 3);
    g.fillStyle(paint.armor);
    g.fillRect(52, ground - 34, 40, 6);
    g.fillStyle(0x0c0806);
    g.fillEllipse(108, ground - 26, 36, 18);
    g.fillStyle(0xff4a10);
    g.fillTriangle(96, ground - 28, 108, ground - 52, 122, ground - 28);
    g.fillStyle(0xffe080);
    g.fillTriangle(102, ground - 28, 108, ground - 42, 116, ground - 28);

    // Сорванный лист крыши и погнутый нос лежат отдельно от корпуса.
    this.fillTurned(g, paint.armorLight, 70, ground - 36, 40, 10, -0.7);
    this.fillTurned(g, paint.nose, 154, ground - 6, 28, 12, 0.9);
    g.fillStyle(paint.rivet);
    g.fillCircle(64, ground - 22, 3);

    // Башня на боку справа, ствол отломлен и валяется перед ней.
    this.fillTurned(g, paint.turret, 198, ground - 10, 52, 22, 0.65);
    this.fillTurned(g, paint.turretLight, 196, ground - 16, 36, 8, 0.65);
    g.fillStyle(paint.hatch);
    g.fillCircle(206, ground - 6, 5);
    this.fillTurned(g, paint.barrel, 132, ground - 4, 62, 8, -0.2);
    this.fillTurned(g, paint.muzzleRing, 104, ground - 8, 12, 12, -0.2);

    // Копоть у пролома. Сам столб дыма — частицы, их в текстуру не запечь.
    g.fillStyle(0x2a221c, 0.75);
    g.fillCircle(108, ground - 48, 8);
  }

  // Решётка моторного отсека на корме крыши, в координатах контейнера танка.
  static exhaustAnchor(): { x: number; y: number } {
    const deckX = 36;
    const deckY = 30;
    return {
      x: Tank.layout.hullX + (deckX - TANK_HULL_FRAME.w / 2),
      y: Tank.layout.hullY + (deckY - TANK_HULL_FRAME.h / 2),
    };
  }

  // Редкий серый выхлоп. Тоньше и ниже столба над обломками.
  static engineAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const engine = scene.add.particles(x, y, Tank.puffKey(scene), {
      lifespan: { min: 900, max: 1600 },
      frequency: 40,
      quantity: 2,
      speed: { min: 12 * scale, max: 30 * scale },
      angle: { min: -165, max: -105 },
      scale: { start: 0.4 * scale, end: 1.55 * scale },
      alpha: { start: 0.72, end: 0 },
      color: [0xe6e2da, 0xb4aea6, 0x7c766e],
      gravityY: -18 * scale,
    });
    engine.setDepth(26);
    return engine;
  }

  // Точка над проломом корпуса в координатах контейнера танка. От неё поднимается дым.
  static smokeAnchor(): { x: number; y: number } {
    const ground = TANK_WRECK_FRAME.h / 2 + 41;
    const tx = 108;
    const ty = ground - 44;
    return {
      x: Tank.layout.hullX + (tx - TANK_WRECK_FRAME.w / 2),
      y: Tank.layout.hullY + (ty - TANK_WRECK_FRAME.h / 2),
    };
  }

  // Мягкое пятно для обоих дымов: выхлопа на ходу и столба над обломками.
  private static puffKey(scene: Phaser.Scene): string {
    const key = 'smoke-puff';
    if (!scene.textures.exists(key)) {
      bake(scene, key, 32, 32, (g) => {
        g.fillStyle(0xffffff, 0.18);
        g.fillCircle(16, 16, 15);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(16, 16, 9);
        g.fillStyle(0xffffff, 0.75);
        g.fillCircle(16, 16, 4);
      });
    }
    return key;
  }

  // Непрерывный столб над обломками. Толще и выше, чем у пикапа.
  static smokeAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const smoke = scene.add.particles(x, y, Tank.puffKey(scene), {
      lifespan: { min: 1100, max: 2100 },
      frequency: 90,
      quantity: 1,
      speed: { min: 14 * scale, max: 36 * scale },
      angle: { min: -108, max: -72 },
      scale: { start: 0.5 * scale, end: 2.2 * scale },
      alpha: { start: 0.78, end: 0 },
      color: [0xc8c0b4, 0x8a8278, 0x524c46],
      gravityY: -22 * scale,
    });
    smoke.setDepth(26);
    return smoke;
  }

  // Прямоугольник, повёрнутый вокруг своего центра. angle в радианах, по часовой: ось Y вниз.
  private static fillTurned(
    g: Phaser.GameObjects.Graphics,
    color: number,
    cx: number,
    cy: number,
    width: number,
    height: number,
    angle: number,
  ): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners: ReadonlyArray<readonly [number, number]> = [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ];
    g.fillStyle(color);
    g.beginPath();
    corners.forEach(([px, py], index) => {
      const x = cx + px * cos - py * sin;
      const y = cy + px * sin + py * cos;
      if (index === 0) {
        g.moveTo(x, y);
      } else {
        g.lineTo(x, y);
      }
    });
    g.closePath();
    g.fillPath();
  }

  // Ядерный взрыв: белая вспышка, ударная волна по земле и гриб, который темнеет и гаснет.
  // scale увеличивает радиус вместе с картинкой в просмотре. Обломки в этот метод не входят:
  // их рисуют заранее, вспышка их только закрывает.
  static nukeAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
  ): Phaser.GameObjects.GameObject[] {
    const made: Phaser.GameObjects.GameObject[] = [];
    const rise = Tank.doom.rise * scale;
    const groundY = y + 28 * scale;

    scene.cameras.main.flash(320, 255, 246, 230);

    const flash = scene.add
      .circle(x, y, 36 * scale, 0xffffff, 1)
      .setDepth(46)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.3);
    scene.tweens.add({
      targets: flash,
      scale: 8,
      alpha: 0,
      duration: 240,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy(),
    });

    const fire = scene.add
      .circle(x, y, 34 * scale, 0xff5a12, 0.95)
      .setDepth(42)
      .setBlendMode(Phaser.BlendModes.ADD);
    const core = scene.add
      .circle(x, y, 14 * scale, 0xfff6d0, 1)
      .setDepth(45)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: fire,
      scale: 4.4,
      alpha: 0,
      y: y - 36 * scale,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: () => fire.destroy(),
    });
    scene.tweens.add({
      targets: core,
      scale: 3.2,
      alpha: 0,
      y: y - 48 * scale,
      duration: 400,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy(),
    });

    // Плоское кольцо по земле: ударная волна, не шар.
    const ring = scene.add
      .ellipse(x, groundY, 32 * scale, 12 * scale, 0xfff4d0, 0)
      .setStrokeStyle(Math.max(2, 5 * scale), 0xfff6d8, 0.95)
      .setDepth(40)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: ring,
      scaleX: 12,
      scaleY: 4.5,
      alpha: 0,
      duration: 680,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    // Ножка растёт от земли вверх. origin снизу, поэтому scaleY тянет её к небу, а не в обе стороны.
    const stem = scene.add
      .ellipse(x, groundY, 46 * scale, 22 * scale, 0x5c4636, 0.95)
      .setOrigin(0.5, 1)
      .setDepth(36);
    scene.tweens.add({
      targets: stem,
      scaleY: 8,
      scaleX: 1.55,
      duration: 880,
      ease: 'Cubic.Out',
    });
    scene.tweens.add({
      targets: stem,
      alpha: 0,
      delay: 620,
      duration: 520,
      onComplete: () => stem.destroy(),
    });

    const capY = y - 8 * scale;
    const cap = scene.add.ellipse(x, capY, 72 * scale, 30 * scale, 0x6a5646, 0.94).setDepth(38);
    const capHot = scene.add
      .ellipse(x, capY + 6 * scale, 60 * scale, 18 * scale, 0xffb040, 0.95)
      .setDepth(39)
      .setBlendMode(Phaser.BlendModes.ADD);
    const capCore = scene.add
      .ellipse(x, capY, 22 * scale, 12 * scale, 0xfff8e4, 1)
      .setDepth(41)
      .setBlendMode(Phaser.BlendModes.ADD);
    const crownY = groundY - rise;
    scene.tweens.add({
      targets: [cap, capHot, capCore],
      y: crownY,
      scaleX: 5.6,
      scaleY: 2.15,
      duration: 920,
      ease: 'Cubic.Out',
    });
    scene.tweens.add({
      targets: capCore,
      alpha: 0,
      delay: 160,
      duration: 280,
      onComplete: () => capCore.destroy(),
    });
    scene.tweens.add({
      targets: capHot,
      alpha: 0,
      delay: 280,
      duration: 460,
      onComplete: () => capHot.destroy(),
    });
    scene.tweens.add({
      targets: cap,
      alpha: 0,
      delay: 700,
      duration: 520,
      onComplete: () => cap.destroy(),
    });

    // Боковые доли шапки разъезжаются в стороны и делают силуэт грибом, а не столбом.
    for (const side of [-1, 1]) {
      const lobe = scene.add
        .ellipse(x + side * 16 * scale, capY, 40 * scale, 24 * scale, 0x5a4638, 0.88)
        .setDepth(37);
      scene.tweens.add({
        targets: lobe,
        x: x + side * 150 * scale,
        y: crownY + 16 * scale,
        scaleX: 2.6,
        scaleY: 1.5,
        duration: 920,
        ease: 'Cubic.Out',
      });
      scene.tweens.add({
        targets: lobe,
        alpha: 0,
        delay: 640,
        duration: 480,
        onComplete: () => lobe.destroy(),
      });
      made.push(lobe);
    }

    if (!scene.textures.exists('spark')) {
      bake(scene, 'spark', 12, 12, (g) => {
        g.fillStyle(0xffffff);
        g.fillCircle(6, 6, 5);
      });
    }
    const sparks = scene.add.particles(x, y, 'spark', {
      lifespan: { min: 380, max: 980 },
      speed: { min: 80 * scale, max: 560 * scale },
      angle: { min: -110, max: -70 },
      scale: { start: 2.1 * scale, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      color: [0xffffff, 0xffe090, 0xff6a10, 0xff2200],
      gravityY: 260 * scale,
      emitting: false,
    });
    sparks.setDepth(44);
    sparks.explode(56);
    const smoke = scene.add.particles(x, groundY - 10 * scale, 'spark', {
      lifespan: { min: 700, max: 1300 },
      speed: { min: 20 * scale, max: 140 * scale },
      angle: { min: -100, max: -80 },
      scale: { start: 2.2 * scale, end: 5 * scale },
      alpha: { start: 0.4, end: 0 },
      color: [0x8a7868, 0x4a4038],
      gravityY: -30 * scale,
      emitting: false,
    });
    smoke.setDepth(35);
    smoke.explode(22);
    scene.time.delayedCall(1400, () => {
      if (sparks.scene) {
        sparks.destroy();
      }
      if (smoke.scene) {
        smoke.destroy();
      }
    });

    const scrap = [0x3d4a28, 0x1a1c16, 0x2a341c, 0x4a5830, 0x6a4a22];
    for (let i = 0; i < 10; i += 1) {
      const wide = i % 3 === 0;
      const bit = scene.add
        .rectangle(
          x,
          y,
          (wide ? 20 : 11) * scale,
          (wide ? 8 : 5) * scale,
          scrap[i % scrap.length],
        )
        .setDepth(43);
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.95, -Math.PI * 0.05);
      const dist = Phaser.Math.Between(90, 240) * scale;
      scene.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 60 * scale,
        angle: Phaser.Math.Between(-240, 240),
        alpha: 0,
        duration: Phaser.Math.Between(560, 920),
        ease: 'Quad.Out',
        onComplete: () => bit.destroy(),
      });
      made.push(bit);
    }

    made.push(flash, fire, core, ring, stem, cap, capHot, capCore, sparks, smoke);
    return made;
  }
}
