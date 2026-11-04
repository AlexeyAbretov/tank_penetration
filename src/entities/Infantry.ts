// Пехотинец — общий предок всех врагов.
// Это абстрактный класс: сам по себе на поле не появляется.
// От него наследуют штурмовик, стрелок, ракетчик, пикап и суперсолдат.
// Стрелок, ракетчик и пикап идут через RangedEnemy: доходят до рубежа и стреляют.
// Суперсолдат наследует Infantry напрямую и бегает по своему циклу.

import Phaser from 'phaser';
import { enemyHasteOf, GAME, isDebugRun } from '../gameConfig';
import { floatDamage } from '../gfx/damageFloat';
import { scatterGibs, type GibBit } from '../gfx/gibs';
import type { SoldierLook } from '../gfx/looks';
import type { WorldPoint } from '../types/WorldPoint';

// Цвета лежат в gfx/looks.ts: один набор рисует и штурмовика, и стрелка.
export type { SoldierLook };

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

  // Пуля пулемёта мельче снаряда и берёт только ближнюю к торсу часть круга.
  mgReach(): number {
    return this.shellRadius() * 0.55;
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
    });
    // Первый раз ставим полоску над головой сразу, не дожидаясь кадра.
    this.syncBar();
  }

  // Phaser вызывает preUpdate у каждого спрайта перед отрисовкой кадра.
  // time — миллисекунды с запуска игры, delta — миллисекунды с прошлого кадра.
  preUpdate(time: number, delta: number): void {
    // Родитель двигает анимацию и применяет скорость тела к координатам.
    super.preUpdate(time, delta);
    if (this.anims.isPlaying) {
      this.anims.timeScale = enemyHasteOf(this.scene.registry);
    }
    // Пока юнит жив и едет, полоска едет вместе с ним.
    // Глубина и на паузе: босс меняет дорожку, и дальний не должен остаться поверх ближнего.
    this.placeDepth();
    this.syncBar();
    // Мёртвый юнит, магазин (combat === false) или стоящие часы — поведение замирает.
    // preUpdate Phaser зовёт до update сцены, поэтому выход из кадра паузы сам стрельбу не гасит.
    // Иначе стрелок достреливает при замерших твинах, и вспышка остаётся на дуле.
    if (this.reachedWall || this.scene.time.paused || this.scene.registry.get('combat') === false) {
      return;
    }
    // Наследник здесь решает: просто идти или ещё и стрелять.
    this.act(delta);
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
    if (this.reachesBase) {
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

  // Куски кадра, если добила мина, артиллерия или залп. null — ложится целиком.
  // Пикап возвращает null: у него свои обломки, не части солдата.
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
    this.barBg.width = width;
    // Цветная полоска растёт вправо от левого края, поэтому левый край — на половине ширины левее центра.
    this.barFill.setPosition(this.x - width / 2, top);
    // При полном HP ширина полоски целиком, при половине — половина, при нуле — 0.
    this.barFill.width = width * (this.hp / this.maxHp);
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

  // Один кадр солдата. legPhase 0 и 1 меняют местами ноги, из двух кадров получается шаг.
  // Тип 0 | 1 запрещает передать любое другое число.
  static drawSoldier(
    g: Phaser.GameObjects.Graphics,
    legPhase: 0 | 1,
    look: SoldierLook,
    withRifle = true,
  ): void {
    // Тень под ногами. Солдат нарисован в квадрате примерно 64×80, низ картинки — это y около 76.
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(32, 76, 36, 10);

    // В кадре 0 задняя нога левее, в кадре 1 — правее. Передняя нога наоборот.
    const backLegX = legPhase === 0 ? 22 : 36;
    const frontLegX = legPhase === 0 ? 36 : 22;

    // Задняя нога рисуется первой, чтобы передняя перекрыла её и казалась ближе.
    g.fillStyle(look.outline); // тёмный контур
    g.fillRoundedRect(backLegX - 2, 48, 14, 26, 4);
    g.fillStyle(look.pants);
    g.fillRoundedRect(backLegX, 50, 10, 22, 3);
    g.fillStyle(look.boots); // ботинок
    g.fillRoundedRect(backLegX - 2, 68, 14, 8, 2);

    // Передняя нога теми же размерами, другой цвет штанины — так ноги читаются раздельно.
    g.fillStyle(look.outline);
    g.fillRoundedRect(frontLegX - 2, 48, 14, 26, 4);
    g.fillStyle(look.tunic);
    g.fillRoundedRect(frontLegX, 50, 10, 22, 3);
    g.fillStyle(look.boots);
    g.fillRoundedRect(frontLegX - 2, 68, 14, 8, 2);

    // Туловище: контур, гимнастёрка, пояс, ремень.
    g.fillStyle(look.outline);
    g.fillRoundedRect(16, 26, 34, 30, 8);
    g.fillStyle(look.tunic);
    g.fillRoundedRect(20, 28, 26, 26, 6);
    g.fillStyle(look.vest);
    g.fillRect(22, 40, 22, 7);
    g.fillStyle(look.belt);
    g.fillRect(24, 34, 18, 5);

    // Руки по бокам корпуса.
    g.fillStyle(look.tunic);
    g.fillRoundedRect(14, 30, 10, 18, 3);
    g.fillRoundedRect(40, 32, 10, 16, 3);

    // У стрелка в бою винтовка — отдельная картинка, поэтому тело можно запечь без неё.
    if (withRifle) {
      this.drawRifle(g, look);
    }

    // Голова: контур, лицо, каска.
    g.fillStyle(look.outline);
    g.fillCircle(32, 22, 10);
    g.fillStyle(look.skin); // цвет кожи
    g.fillCircle(32, 22, 8);
    g.fillStyle(look.outline);
    g.fillRoundedRect(20, 8, 24, 16, 5);
    g.fillStyle(look.helmet);
    g.fillRoundedRect(22, 10, 20, 14, 4);
    g.fillStyle(look.helmetLight);
    g.fillRect(24, 12, 10, 3);
    // Тёмная полоса козырька или ремешка.
    g.fillStyle(look.visor);
    g.fillRect(22, 20, 20, 3);
    // Маленький знак на боку каски.
    g.fillStyle(look.emblem);
    g.fillRect(38, 14, 6, 6);
  }

  // Убитый солдат лёжа, головой к танку. Низ кадра — та же линия, что тень живого (y ≈ 76).
  // drop — что лежит рядом с телом. По умолчанию винтовка. Свой предмет передаёт наследник.
  static drawCorpse(
    g: Phaser.GameObjects.Graphics,
    look: SoldierLook,
    drop: (g: Phaser.GameObjects.Graphics, look: SoldierLook) => void = Infantry.drawDroppedRifle,
  ): void {
    // Сначала широкая лужа, тело рисуется поверх неё.
    g.fillStyle(0x2a0608, 0.55);
    g.fillEllipse(48, 74, 92, 22);
    g.fillStyle(0x5a1014, 0.95);
    g.fillEllipse(46, 72, 74, 14);
    g.fillStyle(0x8e181c, 0.9);
    g.fillEllipse(38, 71, 36, 8);
    g.fillStyle(0xc42428, 0.75);
    g.fillEllipse(32, 70, 14, 5);
    g.fillStyle(0x7a1418, 0.95);
    g.fillCircle(12, 68, 3);
    g.fillCircle(18, 77, 2);
    g.fillCircle(82, 65, 2.5);
    g.fillCircle(90, 75, 3);
    g.fillCircle(70, 78, 2);

    // Задняя нога чуть выше, передняя ближе к нижнему краю — так ноги не сливаются.
    g.fillStyle(look.outline);
    g.fillRoundedRect(58, 50, 28, 12, 4);
    g.fillStyle(look.pants);
    g.fillRoundedRect(60, 52, 22, 8, 3);
    g.fillStyle(look.boots);
    g.fillRoundedRect(80, 49, 12, 11, 2);

    g.fillStyle(look.outline);
    g.fillRoundedRect(54, 61, 30, 12, 4);
    g.fillStyle(look.pants);
    g.fillRoundedRect(56, 63, 24, 8, 3);
    g.fillStyle(look.boots);
    g.fillRoundedRect(78, 62, 14, 11, 2);

    // Рука вытянута вперёд, к голове, отдельно от туловища.
    g.fillStyle(look.outline);
    g.fillRoundedRect(14, 58, 22, 10, 4);
    g.fillStyle(look.tunic);
    g.fillRoundedRect(16, 60, 18, 6, 3);

    g.fillStyle(look.outline);
    g.fillRoundedRect(30, 48, 38, 22, 7);
    g.fillStyle(look.tunic);
    g.fillRoundedRect(32, 50, 34, 18, 6);
    g.fillStyle(look.belt);
    g.fillRect(50, 52, 6, 14);
    g.fillStyle(look.vest);
    g.fillRect(36, 60, 16, 6);
    // Пятно на гимнастёрке, чтобы тело читалось лежащим в крови, а не рядом с ней.
    g.fillStyle(0x7a1216, 0.9);
    g.fillEllipse(44, 58, 12, 7);

    drop(g, look);

    // Голова на земле, каска съехала набок.
    g.fillStyle(look.outline);
    g.fillCircle(28, 56, 10);
    g.fillStyle(look.skin);
    g.fillCircle(27, 58, 7);
    g.fillStyle(look.helmet);
    g.fillEllipse(31, 50, 22, 12);
    g.fillStyle(look.helmetLight);
    g.fillRect(24, 47, 9, 3);
    g.fillStyle(look.visor);
    g.fillRect(22, 54, 16, 3);
    g.fillStyle(look.emblem);
    g.fillRect(38, 48, 5, 5);

    // Второй слой крови поверх ног и шеи, чтобы фигура сидела в луже.
    g.fillStyle(0x6a1014, 0.4);
    g.fillEllipse(46, 68, 58, 10);
    g.fillStyle(0x8e181c, 0.85);
    g.fillEllipse(24, 64, 16, 7);
  }

  // Винтовка выпала и лежит в луже. Длинная у стрелка, короткая у штурмовика.
  private static drawDroppedRifle(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    const rifleX = look.longRifle ? 4 : 10;
    const rifleLen = look.longRifle ? 40 : 32;
    g.fillStyle(look.rifle);
    g.fillRoundedRect(rifleX, 66, rifleLen, 5, 2);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(rifleX + 4, 67, rifleLen - 10, 3, 1);
    g.fillStyle(look.rifleMetal);
    g.fillRect(rifleX - 2, 65, 7, 6);
  }

  // Винтовка поперёк тела. ox/oy сдвигают рисунок: для отдельной текстуры это вырез из кадра солдата.
  // Длинная начинается с x = 0 и длиной 48, короткая — с x = 4 и длиной 40.
  // Дульный срез слева: оружие смотрит к танку.
  static drawRifle(
    g: Phaser.GameObjects.Graphics,
    look: SoldierLook,
    ox = 0,
    oy = 0,
  ): void {
    const x = (look.longRifle ? 0 : 4) + ox;
    const length = look.longRifle ? 48 : 40;
    const woodX = (look.longRifle ? 2 : 6) + ox;
    const woodLen = look.longRifle ? 44 : 36;
    const metalX = (look.longRifle ? 0 : 2) + ox;
    const y = 34 + oy;
    g.fillStyle(look.rifle);
    g.fillRoundedRect(x, y, length, 8, 3);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(woodX, y + 2, woodLen, 5, 2);
    g.fillStyle(look.rifleWoodLight);
    g.fillRect(woodX, y + 3, 12, 3);
    g.fillStyle(look.rifleMetal);
    g.fillRect(metalX, y, 8, 8);
  }
}
