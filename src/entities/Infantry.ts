// Пехотинец — общий предок всех врагов.
// Это абстрактный класс: сам по себе на поле не появляется.
// От него наследуют штурмовик, стрелок, ракетчик, пикап, багги, вертолёт, суперсолдат, тяжёлый танк, дрономатка и БТР.
// Стрелок, ракетчик, пикап, багги и БТР идут через RangedEnemy: доходят до рубежа и стреляют.
// Суперсолдат, вертолёт и дрономатка наследуют Infantry напрямую и ходят по своему циклу.

import Phaser from 'phaser';
import { enemyHasteOf, GAME, isDebugRun } from '../gameConfig';
import { bisectImage } from '../gfx/bisect';
import { floatDamage } from '../gfx/damageFloat';
import { scatterGibs, type GibBit } from '../gfx/gibs';
import { hullLightning, stunMark, type HoldMark } from '../gfx/hold';
import type { WorldPoint } from '../types/WorldPoint';

// extends Sprite: враг — это картинка, у которой ещё есть физическое тело (скорость и хитбокс).
export abstract class Infantry extends Phaser.Physics.Arcade.Sprite {
  static readonly shellHitRadius = 46;
  static readonly shellDamage = 1;
  static readonly hpPerWave = 1;
  // Запасная линия удара, если юнит прошёл выше или ниже танка и хитбокс не задел.
  // В корпус, башню и ствол он взрывается раньше: это проверяет бой, не эта координата.
  static readonly baseReachX = 115;

  static growthRank(wave: number, debutWave: number): number {
    return Math.max(1, wave - debutWave + 1);
  }

  static waveHp(rank: number): number {
    return Math.max(1, rank * Infantry.hpPerWave);
  }

  // Как солдат стоит на поле. Пикап задаёт свой набор после вызова super.
  static readonly placed = {
    scale: 1.45,
    originX: 0.5,
    originY: 0.88,
    bodyW: 36,
    bodyH: 52,
    bodyX: 14,
    bodyY: 10,
  };
  // Сколько убитый солдат лежит в луже, прежде чем спрайт удалится.
  private static readonly corpseMs = 5000;
  // Угол столба, если добила ионная пушка. null — обычная смерть.
  private cutAngle: number | null = null;
  // Ширина полоски HP. Суперсолдат ставит свою после вызова super: у него запас больше.
  protected hpBarWidth = 30;
  // Текущее здоровье. Уменьшается, когда попадает снаряд танка.
  hp: number;
  // Здоровье в момент появления. Полоска HP считается как hp / maxHp.
  readonly maxHp: number;
  // true, когда юнит уже «выбыл»: дошёл до базы или его убили.
  // По такому юниту больше не стреляют и он сам больше не действует.
  reachedWall = false;
  // Сколько миллисекунд до следующего удара проволокой. 0 — можно бить сейчас.
  private wireHurtMs = 0;

  // Сколько монет даёт убийство. Каждая разновидность врага задаёт своё число.
  // abstract: наследник обязан написать это поле, иначе TypeScript не соберёт файл.
  abstract readonly coinReward: number;
  // Очки за убийство. Обычный враг даёт 10. Босс подставляет своё число.
  static readonly killScore = 10;
  scoreReward = Infantry.killScore;
  // Место в очереди волны, с нуля. Сохранение возвращает босса на это место.
  slot = 0;
  // Сколько солдат БТР уже выпустил. Снимок волны пишет число, чтобы дверь не открылась снова.
  // У остальных видов остаётся 0.
  routeMark = 0;
  // true — юнит идёт до стены и бьёт базу. false — останавливается и стреляет издалека.
  abstract readonly reachesBase: boolean;
  // Урон базе при контакте с танком или с линией baseReachX. У стрелков 0: они бьют пулями.
  abstract readonly contactDamage: number;
  // Насколько близко снаряд должен подлететь к торсу, чтобы засчитать попадание.
  // У пикапа это поле переопределено и больше, потому что машина крупнее солдата.
  readonly hitRadius: number = Infantry.shellHitRadius;
  // Сколько раз урон уже вырос: каждые 10 волн +1. Волна 9 даёт 0, 10 — 1, 20 — 2.
  private damageSteps = 0;

  // Фабрика зовёт сразу после создания. Босс считает урон сам, по номеру появления.
  setDamageWave(wave: number): void {
    this.damageSteps = Math.max(0, Math.floor(wave / 10));
  }

  protected extraDamage(): number {
    return this.damageSteps;
  }

  // Урон касанием. contactDamage — база наследника, сверху шаг каждых 10 волн.
  touchDamage(): number {
    return this.contactDamage + this.extraDamage();
  }

  // Центр круга попадания. Снаряд и пуля пулемёта меряют расстояние до этой точки.
  hitCenter(): { x: number; y: number } {
    return { x: this.x, y: this.y - this.displayHeight * 0.42 };
  }

  // Радиус круга для снаряда танка.
  shellRadius(): number {
    return this.hitRadius;
  }

  // Круг, который должна задеть подошва ионной пушки. null — хватает радиуса самого пятна.
  // Крупный вид возвращает свой круг: иначе пятно берёт только середину корпуса.
  ionSole(): number | null {
    return null;
  }

  // Пуля берёт тот же круг, что снаряд. Тесная середина торса оставляла винтовку,
  // плечи и каску снаружи: очередь проходила фигуру насквозь и не снимала здоровье.
  mgReach(): number {
    return this.shellRadius();
  }

  // Ранг роста скорости. У штурмовика это номер волны.
  // У стрелка, ракетчика и пикапа на волне дебюта равен 1, дальше растёт по одной за волну.
  protected paceWave = 1;
  // Скорость шага без темпа игрока. march считает её один раз, темп только умножает.
  private baseSpeed = 0;
  // Ключ шага. Стойка его гасит, возврат на рубеж включает снова.
  private readonly walkKey: string;
  // true после первого шага. Пока юнит стоит (стрельба или проволока), темп скорость не возвращает.
  private paceLatched = false;
  // Остаток глушения. 0 — юнит снова ходит и стреляет.
  private holdLeft = 0;
  // Шёл в момент вспышки. После срока шаг возвращается, стоявший стрелок остаётся на рубеже.
  private holdWasMoving = false;
  private holdMark?: HoldMark;

  // Тёмный фон полоски здоровья над головой.
  private readonly barBg: Phaser.GameObjects.Rectangle;
  // Цветная часть полоски. Её ширина уменьшается вместе с hp.
  private readonly barFill: Phaser.GameObjects.Rectangle;
  // Текущее HP цифрами над полоской. В обычной партии объекта нет.
  private readonly hpLabel: Phaser.GameObjects.Text | null;

  // protected constructor: создать Infantry напрямую нельзя, только через наследника.
  protected constructor(
    scene: Phaser.Scene, // сцена, на которую встанет спрайт
    x: number, // стартовая координата, обычно правее экрана
    y: number, // «дорожка», по которой он идёт влево
    hp: number, // здоровье этой волны
    texture: string, // имя картинки, нарисованной в textures.ts
    walkKey: string, // имя анимации ходьбы
    barColor: number, // цвет полоски HP, формат 0xRRGGBB
  ) {
    // Sprite запоминает сцену, позицию и первую картинку.
    super(scene, x, y, texture);
    this.walkKey = walkKey;
    // Пока спрайт не добавлен в сцену, его не видно и update его не касается.
    scene.add.existing(this);
    // Включаем Arcade-физику: появится body со скоростью и размером.
    scene.physics.add.existing(this);

    this.maxHp = hp;
    this.hp = hp;

    const placed = Infantry.placed;
    // Глубина от ноги: нижний на экране ближе и рисуется поверх верхнего.
    // Живые остаются под проволокой (13) и пулями (14).
    this.setDepth(Infantry.layerFor(y, false));
    // Точка «ног»: картинка стоит на координате (x, y) почти нижним краем, чуть выше центра по X.
    this.setOrigin(placed.originX, placed.originY);
    // Спрайт солдата нарисован мелким (64×80), на поле его увеличиваем.
    this.setScale(placed.scale);
    // Запускаем бесконечную анимацию шага. Ключ регистрирует класс конкретного врага.
    this.play(walkKey);

    // body в типах Phaser бывает разным. Здесь это обычное динамическое тело, не статика.
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Хитбокс меньше картинки: 36×52 пикселя текстуры, чтобы попадать по корпусу, а не по воздуху вокруг.
    body.setSize(placed.bodyW, placed.bodyH);
    // Сдвигаем хитбокс внутри текстуры, чтобы он совпал с туловищем, а не с левым верхним углом картинки.
    body.setOffset(placed.bodyX, placed.bodyY);
    // Врага можно толкать физикой. Сейчас снаряды всё равно проверяются вручную по дистанции.
    body.setImmovable(false);
    // У тела своя гравитация. Выключаем её, чтобы юнит не падал, даже если у мира гравитацию включат.
    body.setAllowGravity(false);

    // Полоска рисуется отдельными прямоугольниками, не частью спрайта,
    // поэтому её позицию каждый кадр подгоняем под юнита в syncBar.
    this.barBg = scene.add.rectangle(x, y, 30, 5, 0x2a0a0a).setDepth(11);
    // origin (0, 0.5): полоска растёт вправо от левого края, вертикально по центру.
    this.barFill = scene.add.rectangle(x, y, 30, 5, barColor).setOrigin(0, 0.5).setDepth(12);
    // Цифра только в дебаг-партии. Обводка читается и на небе, и на земле.
    this.hpLabel = isDebugRun()
      ? scene.add
          .text(x, y, String(hp), {
            fontSize: '13px',
            color: '#fff4e8',
            stroke: '#1a0808',
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1)
          .setDepth(13)
      : null;
    // Когда спрайт уничтожат, полоски сами не исчезнут — у них другой родитель. Убираем их вручную.
    this.once('destroy', () => {
      this.barBg.destroy();
      this.barFill.destroy();
      this.hpLabel?.destroy();
      this.holdMark?.destroy();
    });
    // Первый раз ставим полоску над головой сразу, не дожидаясь кадра.
    this.syncBar();
  }

  // Phaser вызывает preUpdate у каждого спрайта перед отрисовкой кадра.
  // time — миллисекунды с запуска игры, delta — миллисекунды с прошлого кадра.
  preUpdate(time: number, delta: number): void {
    // Родитель двигает анимацию и применяет скорость тела к координатам.
    super.preUpdate(time, delta);
    if (this.anims.isPlaying && this.holdLeft <= 0) {
      this.anims.timeScale = enemyHasteOf(this.scene.registry);
    }
    // Пока юнит жив и едет, полоска едет вместе с ним.
    // Глубина и на паузе: босс меняет дорожку, и дальний не должен остаться поверх ближнего.
    this.placeDepth();
    this.syncBar();
    if (this.tickHold(delta)) {
      return;
    }
    // Мёртвый юнит, магазин (combat === false) или стоящие часы — поведение замирает.
    // preUpdate Phaser зовёт до update сцены, поэтому выход из кадра паузы сам стрельбу не гасит.
    // Иначе стрелок достреливает при замерших твинах, и вспышка остаётся на дуле.
    if (this.reachedWall || this.scene.time.paused || this.scene.registry.get('combat') === false) {
      return;
    }
    // Наследник здесь решает: просто идти или ещё и стрелять.
    this.act(delta);
  }

  // Машина рисует молнии, человек — звёзды. Бой вид не угадывает.
  mechanical(): boolean {
    return false;
  }

  held(): boolean {
    return this.holdLeft > 0;
  }

  // Вспышка уже кончилась. Повторная не укорачивает остаток, если он ещё длиннее.
  hold(ms: number): void {
    if (!this.active || this.reachedWall || ms <= 0) {
      return;
    }
    const fresh = this.holdLeft <= 0;
    this.holdLeft = Math.max(this.holdLeft, ms);
    if (!fresh) {
      return;
    }
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    this.holdWasMoving = !!body?.enable && (body.velocity.x < -1 || Math.abs(body.velocity.y) > 1);
    body?.stop();
    if (this.anims.isPlaying) {
      this.anims.pause();
    }
    this.holdMark = this.mechanical() ? hullLightning(this.scene) : stunMark(this.scene);
    this.holdMark.follow(this, 0);
  }

  // Поражение снимает знак сразу. Шаг не возвращает: поле всё равно гаснет.
  dropHold(): void {
    this.holdLeft = 0;
    this.holdWasMoving = false;
    this.holdMark?.destroy();
    this.holdMark = undefined;
  }

  // Магазин срок не ест: солдаты и так стоят, глушение начнётся в бою.
  private tickHold(delta: number): boolean {
    if (this.holdLeft <= 0) {
      return false;
    }
    const live = !this.reachedWall && !this.scene.time.paused && this.scene.registry.get('combat') !== false;
    if (live) {
      this.holdLeft -= delta;
    }
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    body?.stop();
    this.holdMark?.follow(this, delta);
    if (this.holdLeft > 0 && !this.reachedWall) {
      return true;
    }
    this.endHold();
    return this.reachedWall;
  }

  private endHold(): void {
    this.holdLeft = 0;
    this.holdMark?.destroy();
    this.holdMark = undefined;
    const moving = this.holdWasMoving;
    this.holdWasMoving = false;
    if (moving) {
      this.resumeMarch();
      return;
    }
    if (this.anims.isPaused) {
      this.anims.resume();
    }
  }

  // Пустая реализация для штурмовика: ему достаточно скорости, заданной в march.
  // Стрелки этот метод переопределяют.
  // Подчёркивание у _delta: аргумент обязателен по сигнатуре, но здесь не используется.
  protected act(_delta: number): void {}

  // Ранг роста для march. Вызывает фабрика после создания юнита.
  setPaceWave(wave: number): void {
    this.paceWave = wave;
  }

  // Тот же ранг, с которым юнит вышел на поле. Сохранение читает его, чтобы после
  // перезагрузки собрать того же врага с тем же запасом здоровья.
  get paceRank(): number {
    return this.paceWave;
  }

  // Текущее здоровье без вспышки попадания. maxHp остаётся здоровьем при появлении,
  // поэтому полоска показывает ту же долю, что была до закрытия страницы.
  setHealth(hp: number): void {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.syncBar();
  }

  // Даёт скорость влево. Чем выше ранг роста, тем быстрее шаг.
  march(): void {
    // База 38 + 2 за ранг + случайные 0..10, чтобы юниты одной волны не шли строем с одной скоростью.
    // На первом ранге это те же 40..50. Дальше шаг короче, и поздняя волна не переходит на бег.
    const speed = 38 + this.paceWave * 2 + Phaser.Math.Between(0, 10);
    this.marchAt(speed);
  }

  // Запоминает шаг без темпа и сразу применяет текущий множитель.
  protected marchAt(speed: number): void {
    this.baseSpeed = speed;
    this.paceLatched = false;
    this.syncPace();
  }

  // Умножает шаг на темп. Стоящего юнита не сдвигает: иначе проволока и рубеж стрельбы отпустятся.
  syncPace(): void {
    if (this.reachedWall || this.baseSpeed <= 0) {
      return;
    }
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable) {
      return;
    }
    if (this.paceLatched && body.velocity.x > -1) {
      return;
    }
    const haste = enemyHasteOf(this.scene.registry);
    // Отрицательный X — движение влево, к танку. Y не трогаем: дорожка не меняется.
    body.setVelocityX(-this.baseSpeed * haste);
    this.paceLatched = true;
    this.anims.timeScale = haste;
  }

  // Стойка погасила шаг. Снова идём влево с той же скоростью, картинка шага возвращается.
  protected resumeMarch(): void {
    if (this.reachedWall || this.baseSpeed <= 0) {
      return;
    }
    this.paceLatched = false;
    if (!this.anims.isPlaying) {
      this.play(this.walkKey);
    }
    this.syncPace();
  }

  // Холст стал уже. Доля ширины та же: юнит, который шёл по правой части широкого поля,
  // остаётся на экране, а не за новым краем. Высота и шаг не меняются.
  followWidth(previous: number): void {
    if (!this.active || previous <= GAME.width || this.x <= GAME.width) {
      return;
    }
    this.placeX((this.x * GAME.width) / previous);
  }

  // Спрайт и тело на одну и ту же точку. Только тело следующий кадр затрёт картинку,
  // только картинку — тело вернёт её назад в preUpdate.
  private placeX(x: number): void {
    const dx = this.x - x;
    this.x = x;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.x -= dx;
      body.updateCenter();
    }
    this.syncBar();
  }

  // Сдвиг вправо от разрыва снаряда танка. Тело двигаем сами: postUpdate перенесёт спрайт.
  // Дошедшего до базы не трогаем — он уже выбыл.
  // Проволока гасит шаг, и syncPace стоящего не отпускает. Если сдвиг унёс штурмовика
  // с линии, ход возвращаем. Тот же кадр снова поймает его, если он всё ещё на проволоке.
  knockBack(pixels: number): void {
    if (this.reachedWall || pixels <= 0 || !this.active) {
      return;
    }
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable) {
      return;
    }
    body.x += pixels;
    // Глушение само вернёт шаг. Иначе стойка запомнит ход и после вспышки останется на месте.
    if (this.reachesBase && this.holdLeft <= 0) {
      this.resumeMarch();
    }
  }

  // Упирает юнита в правый край проволоки и гасит шаг.
  // true, когда пора снять HP: в первое касание и потом каждые hurtIntervalMs.
  snare(faceX: number, delta: number, hurtIntervalMs: number): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return false;
    }
    body.setVelocityX(0);
    // body.left — передний край хитбокса. Если кадр занёс его в проволоку, выталкиваем тело назад.
    // Спрайт не двигаем: postUpdate сам перенесёт этот сдвиг на картинку.
    // Иначе сдвиг сложится дважды, тело на следующем кадре окажется правее линии,
    // и периодические удары прекратятся.
    if (body.left < faceX) {
      body.x += faceX - body.left;
    }
    if (this.anims.isPlaying) {
      this.anims.stop();
    }
    this.wireHurtMs -= delta;
    if (this.wireHurtMs > 0) {
      return false;
    }
    this.wireHurtMs = hurtIntervalMs;
    return true;
  }

  // Какое оружие снимает здоровье. Обычный враг принимает всё.
  // Вертолёт оставляет снаряд танка, пулемёт, ионную пушку и атомный взрыв.
  // Дрономатка оставляет снаряд танка, пулемёт и атомный взрыв. ЭМИ её только держит.
  takes(_strike: 'shell' | 'mg' | 'ion' | 'nuclear' | 'other'): boolean {
    return true;
  }

  // Наносит урон. Возвращает true, если после удара здоровья не осталось — сцена тогда вызовет kill.
  // wire: удар колючки. У него своя красная вспышка, не бледный оттенок снаряда.
  hit(damage: number = Infantry.shellDamage, wire = false): boolean {
    const before = this.hp;
    // Ниже нуля здоровье не опускаем.
    this.hp = Math.max(0, this.hp - damage);
    // В дебаге над макушкой всплывает нанесённое число. Ядерный залп передаёт миллион:
    // на экран идёт столько, сколько здоровья реально сняли.
    if (isDebugRun() && before > this.hp) {
      const shown = damage < 10_000 ? damage : before - this.hp;
      const head = this.y - this.displayHeight * this.originY;
      floatDamage(this.scene, this.x, head, shown);
    }
    if (wire && this.hp > 0) {
      this.blinkWire();
    } else if (!wire) {
      // Короткий красно-белый оттенок всей картинки: визуальный «попадание».
      this.setTint(0xffccaa);
      // Через 70 мс оттенок снимаем. Если юнит уже уничтожен, clearTint не вызываем.
      this.scene.time.delayedCall(70, () => {
        if (this.active) {
          this.clearTint();
        }
      });
    }
    this.syncBar();
    return this.hp <= 0;
  }

  // Два красных мигания. Удар проволоки раз в 3 с, бледная вспышка снаряда на нём не читается.
  private blinkWire(): void {
    const redden = () => {
      if (!this.active || this.reachedWall) {
        return;
      }
      this.setTint(0xff1a1a);
      this.scene.time.delayedCall(120, () => {
        if (this.active && !this.reachedWall) {
          this.clearTint();
        }
      });
    };
    redden();
    this.scene.time.delayedCall(220, redden);
  }

  // Картинка лежащего тела. null — у этого врага трупа нет, kill сожмёт спрайт как раньше.
  protected corpseTexture(): string | null {
    return null;
  }

  // Ионный столб режет вдоль своего наклона. Оружие отдельной картинкой наследник отдаёт сюда:
  // иначе ствол останется целым рядом с разрезанным телом.
  sever(angle: number): void {
    this.cutAngle = angle;
    this.kill();
  }

  // Кадр, который уйдёт в разрез. Пусто — режется то, что сейчас на спрайте.
  protected prepareSever(): void {}

  protected severGear(): readonly Phaser.GameObjects.Image[] {
    return [];
  }

  // Линия, на которую ложатся половины. null — кусок уже на земле и только разъезжается.
  // Низ кадра в мире: у солдата это подошва, оружие падает на ту же линию.
  protected severGround(): number | null {
    const frame = this.frame;
    const ox = this.originX * frame.width;
    const oy = this.originY * frame.height;
    const lx = (frame.width * 0.5 - ox) * this.scaleX;
    const ly = (frame.height - oy) * this.scaleY;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return this.y + lx * sin + ly * cos;
  }

  // Половины уже лежат на поле. Наследник сажает на них то, что должно ехать вместе с разрезом.
  protected rideSever(
    _angle: number,
    _halves: readonly [Phaser.GameObjects.Image, Phaser.GameObjects.Image],
  ): void {}

  // Куски кадра, если добила мина, артиллерия или залп. null — ложится целиком.
  // Пикап возвращает null: лужа крови ему не нужна, кузов он ломает в своём kill.
  protected blastBits(): GibBit[] | null {
    return null;
  }

  // Момент снятия с поля, до смены картинки. Стрелок здесь прячет отдельную винтовку.
  // _slain: true, если здоровье уже кончилось. Дошедший до стены живым передаёт false.
  protected onDie(_slain: boolean): void {}

  // Уход с поля: остановка и погасшая полоска.
  // Убитый юнит с картинкой останков остаётся на поле. У кого её нет — сжимается и тает.
  // blastAt — центр разрыва. Пехота с кусками разлетается, спрайт тела уходит на следующем кадре.
  // Имя kill совпадает с методом Sprite, поэтому сцена вызывает именно эту версию.
  kill(blastAt?: WorldPoint): void {
    // Повторный вызов (снаряд ещё касается тела) не должен запускать второй таймер.
    if (this.reachedWall) {
      return;
    }
    this.reachedWall = true;
    // Сразу под живых. Следующий кадр уточнит слой по ноге, но уже не перекроет идущего.
    this.placeDepth();
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    // Скорость в ноль и тело выключено: снаряды пролетают труп, не взрываясь о него.
    body?.stop();
    if (body) {
      body.enable = false;
    }
    // Анимация шага останавливается, иначе следующий кадр вернёт стоящую картинку.
    this.anims.stop();
    this.clearTint();
    this.barBg.setVisible(false);
    this.barFill.setVisible(false);
    this.hpLabel?.setVisible(false);

    const slain = this.hp <= 0;
    const angle = slain ? this.cutAngle : null;
    this.cutAngle = null;
    if (angle !== null) {
      this.prepareSever();
    }
    const ground = angle !== null ? this.severGround() : null;
    const halves = angle !== null ? bisectImage(this.scene, this, angle, Infantry.corpseMs, ground) : null;
    if (halves && angle !== null) {
      for (const piece of this.severGear()) {
        if (piece.active && piece.visible) {
          bisectImage(this.scene, piece, angle, Infantry.corpseMs, ground);
        }
      }
      this.onDie(true);
      this.rideSever(angle, halves);
      this.setVisible(false);
      // Группа пехоты в этом же обходе ещё идёт по списку: уничтожать спрайт сразу нельзя.
      this.scene.time.delayedCall(0, () => {
        if (this.active) {
          this.destroy();
        }
      });
      return;
    }
    this.onDie(slain);
    const bits = slain && blastAt ? this.blastBits() : null;
    if (blastAt && bits && bits.length > 0) {
      scatterGibs(this.scene, bits, blastAt, { x: this.x, y: this.y }, Infantry.corpseMs, this.scaleX);
      // Прятать сразу: целый кадр не должен стоять рядом с уже полетевшими кусками.
      // Уничтожать в этом же обходе пехоты нельзя: группа пропустит следующего солдата.
      this.setVisible(false);
      this.scene.time.delayedCall(0, () => {
        if (this.active) {
          this.destroy();
        }
      });
      return;
    }
    const corpse = slain ? this.corpseTexture() : null;
    if (corpse) {
      this.setTexture(corpse);
      this.scene.time.delayedCall(Infantry.corpseMs, () => {
        if (this.active) {
          this.destroy();
        }
      });
      return;
    }

    // У кого картинки останков нет, спрайт сжимается и тает.
    // Штурмовик у стены этот шаг заменяет взрывом.
    this.vanish();
  }

  // Короткое исчезновение, если трупа нет. Наследник может взорваться вместо таяния.
  protected vanish(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }

  // Кладёт полоску над макушкой и обрезает цветную часть по доле здоровья.
  protected syncBar(): void {
    // Полоску уже уничтожили — трогать её нельзя.
    if (!this.barBg.active) {
      return;
    }
    // Верх картинки — originY доли высоты над точкой ног. Зазор, чтобы полоска не лежала на каске.
    const top = this.y - this.displayHeight * this.originY - 10;
    const width = this.hpBarWidth;
    this.barBg.setPosition(this.x, top);
    // setSize, не присвоение width: иначе опора остаётся от ширины создания (30),
    // и у широкой полоски цвет не доходит до правого края даже при полном запасе.
    this.barBg.setSize(width, 5);
    // Цветная полоска растёт вправо от левого края, поэтому левый край — на половине ширины левее центра.
    this.barFill.setPosition(this.x - width / 2, top);
    // При полном HP ширина полоски целиком, при половине — половина, при нуле — 0.
    this.barFill.setSize(width * (this.hp / this.maxHp), 5);
    if (this.hpLabel) {
      // Низ цифры чуть выше полоски, по её центру.
      this.hpLabel.setPosition(this.x, top - 5);
      const digits = String(this.hp);
      if (this.hpLabel.text !== digits) {
        this.hpLabel.setText(digits);
      }
    }
    // Чуть выше своего тела, но ниже юнита на соседней дорожке: зазор дорожек больше этой добавки.
    this.barBg.setDepth(this.depth + 0.02);
    this.barFill.setDepth(this.depth + 0.03);
    this.hpLabel?.setDepth(this.depth + 0.04);
  }

  // Живой: 9…12.8. Труп: 8…8.9, ниже любого живого.
  private static layerFor(y: number, slain: boolean): number {
    const t = Phaser.Math.Clamp(y / GAME.height, 0, 1);
    return slain ? 8 + t * 0.9 : 9 + t * 3.8;
  }

  // Тело и отдельная картинка оружия. Оружие добавляет наследник: у предка его нет.
  private placeDepth(): void {
    this.setDepth(Infantry.layerFor(this.y, this.reachedWall));
    this.pinDepth();
  }

  // Винтовка, труба, пулемёт и ствол пикапа. Та же глубина, что у тела, и список сцены
  // оставляет их поверх своего корпуса: картинку добавляли позже.
  protected pinDepth(): void {}
}
