// Суперсолдат: босс каждой 10-й волны. На поле выходит один.
// Цикл такой: бежит в случайную точку, останавливается, даёт очередь из пулемёта, снова бежит.
// До танка не идёт и базу контактом не бьёт. Пули летят в точку прицеливания танка.
// На бегу пулемёт нарисован в кадре и смотрит влево. На очереди тело без рук,
// а рука с пулемётом — отдельная картинка: она крутится вокруг плеча.

import Phaser, { Scene } from 'phaser';
import { enemyHasteOf } from '../gameConfig';
import {
  CORPSE_FRAME,
  GUNNER_FLASH_FRAME,
  SOLDIER_FRAME,
  SUPER_LOOK,
  SUPER_MG_FRAME,
  type SoldierLook,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import { EnemyShot } from './EnemyShot';
import { Infantry } from './Infantry';
import type { WorldPoint } from '../types/WorldPoint';

// Три фазы одного цикла.
// run — бежит к точке. burst — стоит и стреляет. idle — очередь кончилась, ждёт таймер до следующего рывка.
type Dash = 'run' | 'burst' | 'idle';

export class SuperSoldier extends Infantry {
  // База формулы запаса. Полное здоровье считает hpForAppearance.
  static readonly baseHp = 100;
  // Прибавка за каждый выход после первого. 10-я волна — первое появление, 20-я — второе.
  static readonly hpPerAppearance = 500;

  // 10-я волна даёт 1, 20-я — 2. На обычной волне босс не выходит, но номер всё равно не ниже 1.
  static appearanceOn(wave: number): number {
    return Math.max(1, Math.floor(wave / 10));
  }

  // Первый выход всегда baseHp. Со второго: 100 + (номер − 1) × 500. Второй босс — 600, третий — 1100.
  static hpForAppearance(appearance: number): number {
    const extra = Math.max(0, appearance - 1);
    return this.baseHp + extra * this.hpPerAppearance;
  }
  // Фигура на кадре уже около 120 px. 1.2 оставляет босса крупнее стрелка
  // и примерно того роста, что давал старый кадр 80 px при масштабе 2.
  static readonly scale = 1.2;
  static readonly walkFps = 10;
  static readonly corpseKey = 'super-corpse';
  static readonly aimKey = 'super-aim';
  static readonly gunKey = 'super-gun';
  // Шесть кадров бега. Холст 97×120, подошва на строке 118, опора сразу под ней.
  // originX — каска: на всех кадрах она в одном столбце, тело не прыгает по горизонтали.
  static readonly frame = { w: 97, h: 120 };
  static readonly fit = {
    originX: 64 / 97,
    originY: 119 / 120,
    bodyW: 38,
    bodyH: 90,
    bodyX: 52,
    bodyY: 22,
  };
  // Стойка без рук, 51×119. Подошва на строке 117.
  static readonly aimFrame = { w: 51, h: 119 };
  static readonly aimFit = {
    originX: 18.5 / 51,
    originY: 118 / 119,
    bodyW: 34,
    bodyH: 92,
    bodyX: 8,
    bodyY: 20,
  };
  // Лежащее тело вместе с пулемётом. Низ картинки — земля.
  static readonly corpseFrame = { w: 128, h: 94 };
  static readonly corpseFit = {
    originX: 0.5,
    originY: 1,
  };
  // Рука с пулемётом. Правый край наплечника — ось, канал горизонтален.
  static readonly gunFrame = { w: 82, h: 50 };
  // Новый рывок не чаще чем раз в 5 секунд. Таймер тикает и на беге, и на стрельбе.
  static readonly relocateMs = 5000;
  static readonly burstCount = 5;
  // Пауза между патронами очереди. Пять выстрелов укладываются в полсекунды.
  static readonly burstGap = 100;
  static readonly shotDamage = 1;
  static readonly shotSpeed = 640;
  static readonly moveSpeed = 220;
  // Прямоугольник, внутри которого он выбирает точку. Левый край правее танка и проволоки.
  static readonly roam = { left: 340, right: 1160, top: 150, bottom: 560 };
  // Плечо на стойке. Сюда садится правый край наплечника.
  static readonly breech = { x: 30, y: 30 };
  // Картинка руки в том же масштабе, что тело.
  static readonly armsFit = 1;
  // Дуло в пикселях картинки руки: левый край канала. Канал горизонтален, y = 30.
  static readonly muzzleInGun = { x: 0, y: 30 };
  // Ось внутри картинки руки: правый край наплечника.
  // Канал ниже плеча, но сам горизонтален, поэтому пуля идёт вдоль ствола, а не через плечо.
  static readonly armsPivot = { x: 81, y: 11 };
  // Дуло в пикселях стойки. Сдвиг дула картинки от оси, отложенный от казённика.
  static readonly muzzleTip = {
    x: SuperSoldier.breech.x + (SuperSoldier.muzzleInGun.x - SuperSoldier.armsPivot.x) * SuperSoldier.armsFit,
    y: SuperSoldier.breech.y + (SuperSoldier.muzzleInGun.y - SuperSoldier.armsPivot.y) * SuperSoldier.armsFit,
  };
  // Короткая отдача: очередь частая, длинный откат слипся бы в дрожь.
  // 5 px картинки при масштабе 1.2 — те же 6 px на поле, что давали 3 px при масштабе 2.
  static readonly recoilKick = { x: 5, climb: 0.04, ms: 60 };
  // Множитель к масштабу тела. 1 — пиксель вспышки совпадает с пикселем ствола.
  static readonly flashPop = { x: 1, y: 1, ms: 50 };

  static get muzzleOffset(): { x: number; y: number } {
    const point = SuperSoldier.muzzleAt(0, 0, SuperSoldier.scale, 0);
    return { x: point.x, y: point.y };
  }

  readonly coinReward = 10;
  // false: WaveManager и проволока не ждут, что он дойдёт до стены.
  readonly reachesBase = false;
  readonly contactDamage = 0;
  // Снаряд танка попадает в крупный торс с большего расстояния, чем в обычного солдата.
  readonly hitRadius = 64;

  // Пулемёт — отдельная картинка. Так отдача двигает ствол, а тело остаётся на месте.
  private gun!: Phaser.GameObjects.Image;
  // Насколько ствол сейчас отъехал назад и задрался. Твин возвращает оба числа к нулю.
  private readonly recoil = { x: 0, climb: 0 };
  // Угол ствола в радианах. 0 смотрит вправо, к правому краю поля. В танк ствол смотрит около Math.PI.
  private aim = 0;
  private readonly shots: Phaser.Physics.Arcade.Group;
  // Точка на танке. Её отдаёт Tank.aimPoint, босс сам танк не ищет.
  private readonly fireTarget: WorldPoint;
  private phase: Dash = 'idle';
  // Миллисекунды до следующего рывка. enemyHaste ускоряет и этот таймер.
  private clock = 0;
  private destX = 0;
  private destY = 0;
  // Скорость текущего рывка. Каждый beginRun слегка её меняет, чтобы бег не был метрономом.
  private dashSpeed = SuperSoldier.moveSpeed;
  private shotsLeft = 0;
  // Пауза до следующего патрона очереди.
  private shotWait = 0;

  // Шесть кадров бега с пулемётом, стойка без рук, рука со стволом поверх. Труп — последняя картинка.
  // Пути в public/. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'super-0': 'assets/super-0.png',
    'super-1': 'assets/super-1.png',
    'super-2': 'assets/super-2.png',
    'super-3': 'assets/super-3.png',
    'super-4': 'assets/super-4.png',
    'super-5': 'assets/super-5.png',
    [SuperSoldier.aimKey]: 'assets/super-aim.png',
    [SuperSoldier.gunKey]: 'assets/super-gun.png',
    [SuperSoldier.corpseKey]: 'assets/super-corpse.png',
  } as const;

  static readonly frameKeys = (
    ['super-0', 'super-1', 'super-2', 'super-3', 'super-4', 'super-5'] as const
  );

  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  // Картинки из assets/. Фигурный рисунок остаётся, если файл не загрузили.
  static ensureTextures(scene: Scene): void {
    if (!scene.textures.exists('super-0')) {
      bake(scene, 'super-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => this.drawMarch(g, 0, SUPER_LOOK));
      bake(scene, 'super-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => this.drawMarch(g, 1, SUPER_LOOK));
    }
    if (!scene.textures.exists(this.aimKey)) {
      bake(scene, this.aimKey, SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => this.drawMarch(g, 0, SUPER_LOOK));
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) => this.drawCorpse(g, SUPER_LOOK));
    }
    if (!scene.textures.exists(this.gunKey)) {
      bake(scene, this.gunKey, SUPER_MG_FRAME.w, SUPER_MG_FRAME.h, (g) => this.renderGun(g));
    }
    if (!scene.textures.exists('super-flash')) {
      bake(scene, 'super-flash', GUNNER_FLASH_FRAME.w, GUNNER_FLASH_FRAME.h, (g) => this.renderFlash(g));
    }
    const frames = this.frameKeys.filter((key) => scene.textures.exists(key));
    for (const key of [...frames, this.aimKey, this.corpseKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    // Ствол крутится на любой угол. Ближний фильтр на повороте рвёт металл, поэтому здесь сглаживание.
    for (const key of [this.gunKey, 'super-flash']) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    if (scene.anims.exists('super-walk')) {
      scene.anims.remove('super-walk');
    }
    scene.anims.create({
      key: 'super-walk',
      frames: frames.map((key) => ({ key })),
      frameRate: this.walkFps,
      repeat: -1,
    });
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
  ) {
    super(scene, x, y, hp, 'super-0', 'super-walk', 0xff3348);
    this.setScale(SuperSoldier.scale);
    // Полоска HP у предка узкая. После super её можно расширить и сразу перерисовать.
    this.hpBarWidth = 54;
    this.syncBar();
    this.shots = shots;
    this.fireTarget = fireTarget;
    this.gun = scene.add.image(x, y, SuperSoldier.gunKey);
    // Origin — точка картинки, которая стоит на координате спрайта.
    // Ставим её в плечо, чтобы рука со стволом крутилась вокруг плеча.
    this.gun.setOrigin(
      SuperSoldier.armsPivot.x / SuperSoldier.gunFrame.w,
      SuperSoldier.armsPivot.y / SuperSoldier.gunFrame.h,
    );
    const fit = SuperSoldier.fit;
    this.setOrigin(fit.originX, fit.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(fit.bodyW, fit.bodyH, false);
    body.setOffset(fit.bodyX, fit.bodyY);
    this.gun.setDepth(this.depth);
    // destroy приходит и при смерти, и при зачистке сцены. Гасим твин отдачи и убираем ствол,
    // иначе картинка пулемёта останется на поле после трупа.
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.gun.destroy();
    });
    this.syncGun();
  }

  // preUpdate Phaser зовёт каждый кадр до физики. Ствол догоняет тело, даже если act в этот кадр молчит.
  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Стойка и труп другого размера. Опора каждый кадр сажает подошву на землю.
    this.applyFit();
    this.syncGun();
  }

  override kill(): void {
    const wasAlive = !this.reachedWall;
    super.kill();
    if (wasAlive && this.texture.key === SuperSoldier.corpseKey) {
      const fit = SuperSoldier.corpseFit;
      this.setOrigin(fit.originX, fit.originY);
    }
  }

  // Волна только что выпустила босса. Сразу выбирает точку и бежит, стойки на месте нет.
  override march(): void {
    this.beginRun();
  }

  // Игрок переключил темп. На беге скорость пересчитывается сразу. В очереди и на месте тело стоит.
  override syncPace(): void {
    if (this.reachedWall || this.phase !== 'run') {
      return;
    }
    this.walk();
  }

  override hit(damage?: number): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage);
    // Короткий светлый тинт ствола: попадание видно и по пулемёту, не только по полоске HP.
    this.gun.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.gun.active) {
        this.gun.clearTint();
      }
    });
    return dead;
  }

  protected override corpseTexture(): string | null {
    return SuperSoldier.corpseKey;
  }

  protected override onDie(slain: boolean): void {
    // slain — убит выстрелом, труп остаётся. До базы босс не доходит, но ветка всё равно проверяет флаг.
    if (!slain || !this.gun.active) {
      return;
    }
    this.gun.setVisible(false);
  }

  // delta — миллисекунды с прошлого кадра. Темп игрока умножает и шаг, и таймеры босса.
  protected override act(delta: number): void {
    const step = delta * enemyHasteOf(this.scene.registry);
    this.clock -= step;

    if (this.phase === 'burst') {
      const done = this.tickBurst(step);
      // Очередь кончилась и пять секунд уже вышли — сразу новый рывок, без стояния.
      if (done && this.clock <= 0) {
        this.beginRun();
      }
      return;
    }

    if (this.phase === 'run') {
      if (this.closeEnough(delta)) {
        this.openBurst();
        // Первый патрон в тот же кадр, иначе очередь начнётся только со следующего.
        this.tickBurst(step);
        return;
      }
      // Пять секунд вышли раньше, чем он добежал: точка сменяется, очередь пропускается.
      if (this.clock <= 0) {
        this.beginRun();
        return;
      }
      this.walk();
      return;
    }

    // idle: очередь уже кончилась, тело стоит, пока clock не дойдёт до нуля.
    this.plant();
    if (this.clock <= 0) {
      this.beginRun();
    }
  }

  private beginRun(): void {
    this.pickDest();
    // Небольшой разброс, чтобы одинаковые 220 px/с не читались как конвейер.
    this.dashSpeed = SuperSoldier.moveSpeed + Phaser.Math.Between(-30, 40);
    this.phase = 'run';
    this.clock = SuperSoldier.relocateMs;
    this.walk();
  }

  private pickDest(): void {
    const box = SuperSoldier.roam;
    // До восьми попыток найти точку хотя бы в 180 px от текущей. Иначе рывок выглядит как шаг на месте.
    for (let i = 0; i < 8; i += 1) {
      const x = Phaser.Math.Between(box.left, box.right);
      const y = Phaser.Math.Between(box.top, box.bottom);
      if (Phaser.Math.Distance.Between(this.x, this.y, x, y) >= 180) {
        this.destX = x;
        this.destY = y;
        return;
      }
    }
    const midX = (box.left + box.right) / 2;
    const midY = (box.top + box.bottom) / 2;
    // Все восемь точек оказались рядом. Тогда бежим в противоположный угол прямоугольника.
    this.destX = this.x < midX ? box.right : box.left;
    this.destY = this.y < midY ? box.bottom : box.top;
  }

  // Считаем «добежал», когда до точки ближе, чем он пройдёт за этот кадр. Иначе скорость пронесёт его мимо.
  private closeEnough(delta: number): boolean {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.destX, this.destY);
    const step = this.dashSpeed * enemyHasteOf(this.scene.registry) * (delta / 1000);
    return dist <= Math.max(14, step + 2);
  }

  private walk(): void {
    const haste = enemyHasteOf(this.scene.registry);
    // Angle.Between даёт направление на точку. cos/sin раскладывают его на скорость по X и Y.
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.destX, this.destY);
    const speed = this.dashSpeed * haste;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    if (!this.anims.isPlaying) {
      this.play('super-walk');
    }
    // timeScale ускоряет смену кадров шага вместе с бегом. Иначе ноги отстают от спрайта.
    this.anims.timeScale = haste;
  }

  // Стоит на месте: скорость обнулена, анимация снята, тело без пулемёта.
  // Ствол в этом кадре отдельной картинкой, иначе на очереди их два.
  private plant(): void {
    this.body?.stop();
    if (this.anims.isPlaying) {
      this.anims.stop();
    }
    if (this.texture.key !== SuperSoldier.aimKey) {
      this.setTexture(SuperSoldier.aimKey);
    }
  }

  private openBurst(): void {
    this.phase = 'burst';
    this.shotsLeft = SuperSoldier.burstCount;
    // 0 — первый выстрел в ближайшем tickBurst, без стартовой паузы.
    this.shotWait = 0;
    this.plant();
  }

  // true — очередь закончилась. false — ещё есть патроны или идёт пауза между ними.
  private tickBurst(step: number): boolean {
    this.plant();
    if (this.shotsLeft <= 0) {
      this.phase = 'idle';
      return true;
    }
    this.shotWait -= step;
    if (this.shotWait > 0) {
      return false;
    }
    this.fireOne();
    this.shotsLeft -= 1;
    this.shotWait = SuperSoldier.burstGap;
    if (this.shotsLeft <= 0) {
      this.phase = 'idle';
      return true;
    }
    return false;
  }

  private fireOne(): void {
    this.aim = SuperSoldier.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    this.kickGun();
    const shot = SuperSoldier.muzzleAt(this.x, this.y, this.scaleX, this.aim, this.recoil);
    // Пуля — отдельный спрайт в общей группе сцены. Урон зашит в неё, а не в босса.
    const bullet = new EnemyShot(this.scene, shot.x, shot.y, SuperSoldier.shotDamage);
    this.shots.add(bullet);
    bullet.launch(shot.angle, SuperSoldier.shotSpeed);
    this.flashAt(shot.x, shot.y, shot.angle);
  }

  private kickGun(): void {
    this.scene.tweens.killTweensOf(this.recoil);
    const kick = SuperSoldier.recoilKick;
    this.recoil.x = kick.x;
    this.recoil.climb = kick.climb;
    this.scene.tweens.add({
      targets: this.recoil,
      x: 0,
      climb: 0,
      duration: kick.ms,
      ease: 'Quad.Out',
    });
  }

  private flashAt(x: number, y: number, angle: number): void {
    const flash = this.scene.add.image(x, y, 'super-flash').setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    const pop = SuperSoldier.flashPop;
    flash.setScale(this.scaleX * pop.x, this.scaleY * pop.y);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: pop.ms,
      ease: 'Quad.In',
      onComplete: () => flash.destroy(),
    });
  }

  private syncGun(): void {
    if (!this.gun.active) {
      return;
    }
    // На бегу ствол нарисован в кадре. Отдельная картинка нужна только в стойке, иначе стволов два.
    const aiming = !this.reachedWall && this.texture.key === SuperSoldier.aimKey;
    this.gun.setVisible(aiming);
    if (!aiming) {
      return;
    }
    this.aim = SuperSoldier.barrelAngle(this.x, this.y, this.scaleX, this.fireTarget.x, this.fireTarget.y);
    SuperSoldier.poseGun(this.gun, this.x, this.y, this.scaleX, this.aim, this.recoil);
    this.gun.setAlpha(this.alpha);
  }

  static barrelAngle(anchorX: number, anchorY: number, scale: number, targetX: number, targetY: number): number {
    const mount = SuperSoldier.mountPoint(anchorX, anchorY, scale);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, targetX, targetY);
    // Картинка пулемёта нарисована носом влево, канал горизонтален.
    // Угол на цель смотрит носом вправо, поэтому к нему прибавляется половина оборота.
    return Phaser.Math.Angle.Wrap(at + Math.PI);
  }

  static muzzleAt(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number } = { x: 0, climb: 0 },
  ): { x: number; y: number; angle: number } {
    const point = SuperSoldier.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
    return {
      x: point.x,
      y: point.y,
      // Пуля идёт вдоль канала, а не из плеча в дуло: плечо выше ствола.
      angle: Phaser.Math.Angle.Wrap(aim - Math.PI),
    };
  }

  private static muzzlePoint(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): { x: number; y: number } {
    const mount = SuperSoldier.mountPoint(anchorX, anchorY, scale);
    const tip = SuperSoldier.turned(
      aim,
      SuperSoldier.muzzleTip.x - SuperSoldier.breech.x + recoil.x,
      SuperSoldier.muzzleTip.y - SuperSoldier.breech.y,
      scale,
    );
    return { x: mount.x + tip.x, y: mount.y + tip.y };
  }

  // Плечо на стойке. anchor — точка ног, scale — масштаб тела.
  private static mountPoint(anchorX: number, anchorY: number, scale: number): { x: number; y: number } {
    const fit = SuperSoldier.aimFit;
    const frame = SuperSoldier.aimFrame;
    return {
      x: anchorX + (SuperSoldier.breech.x - fit.originX * frame.w) * scale,
      y: anchorY + (SuperSoldier.breech.y - fit.originY * frame.h) * scale,
    };
  }

  private static turned(
    rotation: number,
    localX: number,
    localY: number,
    scale: number,
  ): { x: number; y: number } {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: (localX * cos - localY * sin) * scale,
      y: (localX * sin + localY * cos) * scale,
    };
  }

  static poseGun(
    gun: Phaser.GameObjects.Image,
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): void {
    const rotation = aim + recoil.climb;
    const muzzle = SuperSoldier.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
    const tip = SuperSoldier.turned(
      rotation,
      SuperSoldier.muzzleTip.x - SuperSoldier.breech.x,
      SuperSoldier.muzzleTip.y - SuperSoldier.breech.y,
      scale,
    );
    gun.setPosition(muzzle.x - tip.x, muzzle.y - tip.y);
    gun.setScale(scale * SuperSoldier.armsFit);
    gun.setRotation(rotation);
  }

  // Кадр шага, стойка и труп разного размера. Подошва каждого стоит на точке ног.
  private applyFit(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (this.texture.key === SuperSoldier.aimKey) {
      const fit = SuperSoldier.aimFit;
      this.setOrigin(fit.originX, fit.originY);
      if (body?.enable) {
        body.setSize(fit.bodyW, fit.bodyH, false);
        body.setOffset(fit.bodyX, fit.bodyY);
      }
      return;
    }
    if (this.texture.key === SuperSoldier.corpseKey) {
      const fit = SuperSoldier.corpseFit;
      this.setOrigin(fit.originX, fit.originY);
      return;
    }
    const fit = SuperSoldier.fit;
    this.setOrigin(fit.originX, fit.originY);
    if (body?.enable) {
      body.setSize(fit.bodyW, fit.bodyH, false);
      body.setOffset(fit.bodyX, fit.bodyY);
    }
  }

  // Кадр марша для текстуры. Пулемёт — отдельная картинка, чтобы отдача двигала ствол.
  static drawMarch(g: Phaser.GameObjects.Graphics, legPhase: 0 | 1, look: SoldierLook): void {
    Infantry.drawSoldier(g, legPhase, look, false);
    g.fillStyle(look.vest);
    g.fillRoundedRect(12, 26, 14, 8, 2);
    g.fillRoundedRect(40, 26, 14, 8, 2);
  }

  static drawCorpse(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    Infantry.drawCorpse(g, look, (pen, colors) => this.drawDroppedGun(pen, colors));
  }

  static renderGun(g: Phaser.GameObjects.Graphics, look: SoldierLook = SUPER_LOOK): void {
    this.drawGun(g, look, 0, 0);
  }

  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = GUNNER_FLASH_FRAME.h / 2;
    g.fillStyle(0xff4a10, 1);
    g.fillTriangle(0, y, 16, 1, 8, y);
    g.fillTriangle(0, y, 16, GUNNER_FLASH_FRAME.h - 1, 8, y);
    g.fillStyle(0xffcc44, 1);
    g.fillTriangle(0, y, 24, 4, 24, GUNNER_FLASH_FRAME.h - 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, y, 3);
  }

  private static drawGun(g: Phaser.GameObjects.Graphics, look: SoldierLook, ox: number, oy: number): void {
    g.fillStyle(look.rifle);
    g.fillRoundedRect(ox, oy + 5, 50, 8, 2);
    g.fillStyle(look.rifleMetal);
    g.fillRect(ox, oy + 6, 8, 6);
    g.fillStyle(look.rifleWood);
    g.fillRect(ox + 12, oy + 7, 18, 4);
    g.fillStyle(look.outline);
    g.fillRoundedRect(ox + 34, oy + 2, 16, 14, 2);
    g.fillStyle(look.rifleWoodLight);
    g.fillRect(ox + 36, oy + 4, 12, 3);
    g.fillStyle(look.vest);
    g.fillRect(ox + 30, oy + 13, 8, 5);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(ox + 48, oy + 4, 10, 10, 2);
  }

  private static drawDroppedGun(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    g.fillStyle(look.rifle);
    g.fillRoundedRect(6, 64, 36, 6, 2);
    g.fillStyle(look.rifleMetal);
    g.fillRect(4, 63, 8, 8);
    g.fillStyle(look.vest);
    g.fillRect(22, 69, 7, 5);
  }
}
