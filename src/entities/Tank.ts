// Танк игрока. Это не один спрайт, а контейнер: корпус и башня — две картинки,
// которые двигаются вместе, а башня ещё и крутится отдельно.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { bake } from '../gfx/textures';

export class Tank extends Phaser.GameObjects.Container {
  // Башня хранится отдельно: на неё вешают поворот, откат и точку выстрела.
  private readonly turret: Phaser.GameObjects.Image;
  // Миллисекунды до следующего выстрела. 0 — можно стрелять.
  private cooldown = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Контейнер сам стоит в (x, y). Дети внутри задаются уже относительно этой точки.
    super(scene, x, y);

    // Корпус чуть правее и ниже центра контейнера.
    const hull = scene.add.image(8, 16, 'tank-hull');
    // Башня выше корпуса. Её локальные координаты потом прибавляются к позиции танка.
    this.turret = scene.add.image(18, -10, 'tank-turret');
    // Ось вращения у казённой части, не в центре картинки: ствол описывает дугу, башня остаётся на месте.
    // 0.22 по X — примерно 22% ширины текстуры от левого края.
    this.turret.setOrigin(0.22, 0.5);

    // Кладём обе картинки внутрь контейнера. Их мировые координаты = координаты танка + локальные.
    this.add([hull, this.turret]);
    scene.add.existing(this);
    // Танк рисуется поверх солдат, снарядов и вспышек выстрела врага.
    this.setDepth(25);
    // Размер контейнера. Попадания пуль проверяются своим прямоугольником в containsPoint.
    this.  setSize(160, 96);
  }

  // Попала ли точка (пуля) в прямоугольник вокруг танка.
  // Границы подогнаны вручную под рисунок: влево 72, вправо 96, вверх 48, вниз 52.
  containsPoint(x: number, y: number): boolean {
    return x > this.x - 72 && x < this.x + 96 && y > this.y - 48 && y < this.y + 52;
  }

  // Поворачивает башню к точке, обычно к курсору.
  aimAt(x: number, y: number): void {
    // Угол от оси башни к цели, в радианах. 0 — вправо, положительный — вниз (ось Y экрана растёт вниз).
    const angle = Phaser.Math.Angle.Between(
      this.x + this.turret.x,
      this.y + this.turret.y,
      x,
      y,
    );
    // Ствол не смотрит назад и не в пол: угол зажат примерно от -49° до +49°.
    this.turret.setRotation(Phaser.Math.Clamp(angle, -0.85, 0.85));
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
    // Короткий откат: башня на 40 мс уезжает влево и возвращается (yoyo).
    this.scene.tweens.add({
      targets: this.turret,
      x: 10,
      duration: 40,
      yoyo: true,
    });
    return this.getMuzzle();
  }

  // Мировые координаты конца ствола.
  private getMuzzle(): { x: number; y: number; angle: number } {
    const angle = this.turret.rotation;
    // Длина от оси башни до вспышки. Картинка ствола короче, число подобрано на глаз.
    const length = 118;
    return {
      x: this.x + this.turret.x + Math.cos(angle) * length,
      y: this.y + this.turret.y + Math.sin(angle) * length,
      angle,
    };
  }

  // Корпус, башня, снаряд и вспышка. Сцена берёт их по именам 'tank-hull', 'tank-turret', 'shell', 'muzzle'.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('tank-hull')) {
      this.createHull(scene);
    }
    if (!scene.textures.exists('tank-turret')) {
      this.createTurret(scene);
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
    bake(scene, 'tank-hull', 176, 110, (g) => {
      // Тень под гусеницей.
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(90, 96, 150, 22);

      // Тёмная гусеница: скруглённый прямоугольник.
      // fillRoundedRect(x, y, ширина, высота, радиус углов).
      g.fillStyle(0x1a1c16);
      g.fillRoundedRect(18, 58, 148, 38, 8);

      // Шесть катков внутри гусеницы. Шаг 22 пикселя.
      for (let i = 0; i < 6; i += 1) {
        const x = 36 + i * 22;
        g.fillStyle(0x2a2c24); // внешнее кольцо катка
        g.fillCircle(x, 78, 11);
        g.fillStyle(0x4a4c42); // диск светлее
        g.fillCircle(x, 78, 7);
        g.fillStyle(0x1a1c16); // ось в центре
        g.fillCircle(x, 78, 3);
      }

      // Бронекорпус над гусеницей, три горизонтальные полосы: верх светлый, низ тёмный.
      g.fillStyle(0x3d4a28);
      g.fillRoundedRect(22, 28, 140, 44, 8);
      g.fillStyle(0x556338);
      g.fillRoundedRect(28, 32, 128, 18, 6);
      g.fillStyle(0x2a341c);
      g.fillRoundedRect(30, 50, 124, 16, 4);

      // Скошенный нос справа. Треугольник по трём точкам: (x1,y1), (x2,y2), (x3,y3).
      g.fillStyle(0x2f3a22);
      g.fillTriangle(150, 32, 168, 50, 150, 68);
      // Светлая вставка на носу.
      g.fillStyle(0x4a5830);
      g.fillRect(148, 40, 16, 14);

      // Люк или ящик на левой части крыши и тёмная щель под ним.
      g.fillStyle(0x1e2416);
      g.fillRect(28, 36, 22, 10);
      g.fillRect(28, 48, 22, 4);
      // Четыре тонкие горизонтальные риски — решётка.
      g.lineStyle(1, 0x0e120a, 1);
      for (let i = 0; i < 4; i += 1) {
        // lineBetween(x1, y1, x2, y2) рисует один отрезок.
        g.lineBetween(30, 38 + i * 2, 48, 38 + i * 2);
      }

      // Две заклёпки на борту.
      g.fillStyle(0x6a4a22);
      g.fillCircle(78, 46, 4);
      g.fillCircle(108, 46, 4);

      // Небольшие выступы по краям гусеницы: левый грязевой щиток и правый.
      g.fillStyle(0x2a2e22);
      g.fillRect(20, 62, 8, 18);
      g.fillRect(156, 64, 10, 14);
    });
  }

  // Башня и ствол. Ось вращения в игре стоит у левой части этой картинки, ствол торчит вправо.
  private static createTurret(scene: Phaser.Scene): void {
    bake(scene, 'tank-turret', 168, 48, (g) => {
      // Основание башни.
      g.fillStyle(0x2c341c);
      g.fillRoundedRect(8, 8, 70, 32, 12);
      // Светлая верхняя грань.
      g.fillStyle(0x556338);
      g.fillRoundedRect(12, 12, 62, 16, 8);
      // Круглая крыша башни.
      g.fillStyle(0x3d4a28);
      g.fillCircle(42, 24, 14);
      // Тёмный люк.
      g.fillStyle(0x1e2416);
      g.fillCircle(42, 24, 6);
      // Блик на люке, чуть выше центра, чтобы казалось, что свет сверху.
      g.fillStyle(0x6a7a48);
      g.fillCircle(42, 22, 3);

      // Переход от башни к стволу, «маска».
      g.fillStyle(0x2a2e22);
      g.fillRoundedRect(70, 16, 22, 16, 4);

      // Сам ствол: тёмный контур и более светлая верхняя грань.
      g.fillStyle(0x1a1c16);
      g.fillRoundedRect(88, 18, 68, 12, 3);
      g.fillStyle(0x3a3e32);
      g.fillRoundedRect(90, 20, 64, 8, 2);
      // Утолщение у дула.
      g.fillStyle(0x2a2e22);
      g.fillRect(152, 16, 10, 16);
      g.fillStyle(0x1a1c16);
      g.fillRect(156, 18, 6, 12);
      // Светлый срез канала ствола.
      g.fillStyle(0x8a8e80);
      g.fillRect(160, 21, 4, 6);
    });
  }

  // Снаряд танка — вытянутое свечение, не металлическая болванка. 54×22.
  private static createShell(scene: Phaser.Scene): void {
    bake(scene, 'shell', 54, 22, (g) => {
      g.fillStyle(0xff2200, 0.35); // внешнее красное гало
      g.fillEllipse(27, 11, 54, 22);
      g.fillStyle(0xff6600, 0.8); // оранжевая середина, чуть смещена вправо — туда летит снаряд
      g.fillEllipse(30, 11, 40, 14);
      g.fillStyle(0xffee66); // жёлтое ядро
      g.fillEllipse(34, 11, 26, 8);
      g.fillStyle(0xffffff); // белый кончик
      g.fillEllipse(40, 11, 12, 4);
    });
  }

  // Круглая вспышка выстрела и взрыва. В игре её ещё красят режимом ADD, поэтому она светится.
  private static createMuzzle(scene: Phaser.Scene): void {
    bake(scene, 'muzzle', 48, 48, (g) => {
      g.fillStyle(0xffaa44, 0.5); // широкое оранжевое пятно
      g.fillCircle(24, 24, 22);
      g.fillStyle(0xffee88, 0.9); // жёлтый центр
      g.fillCircle(24, 24, 12);
      g.fillStyle(0xffffff); // белая точка
      g.fillCircle(24, 24, 5);
    });
  }
}
