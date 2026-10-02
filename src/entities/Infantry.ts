// Пехотинец — общий предок всех врагов.
// Это абстрактный класс: сам по себе на поле не появляется,
// от него наследуют штурмовик, стрелок и пикап.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import type { SoldierLook } from '../gfx/looks';

// Цвета лежат в gfx/looks.ts: один набор рисует и штурмовика, и стрелка.
export type { SoldierLook };

// extends Sprite: враг — это картинка, у которой ещё есть физическое тело (скорость и хитбокс).
export abstract class Infantry extends Phaser.Physics.Arcade.Sprite {
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
  // Текущее здоровье. Уменьшается, когда попадает снаряд танка.
  hp: number;
  // Здоровье в момент появления. Полоска HP считается как hp / maxHp.
  readonly maxHp: number;
  // true, когда юнит уже «выбыл»: дошёл до базы или его убили.
  // По такому юниту больше не стреляют и он сам больше не действует.
  reachedWall = false;

  // Сколько монет даёт убийство. Каждая разновидность врага задаёт своё число.
  // abstract: наследник обязан написать это поле, иначе TypeScript не соберёт файл.
  abstract readonly coinReward: number;
  // true — юнит идёт до стены и бьёт базу. false — останавливается и стреляет издалека.
  abstract readonly reachesBase: boolean;
  // Урон базе, если юнит дошёл до линии reachX. У стрелков 0: они бьют пулями.
  abstract readonly contactDamage: number;
  // Насколько близко снаряд должен подлететь к торсу, чтобы засчитать попадание.
  // У пикапа это поле переопределено и больше, потому что машина крупнее солдата.
  readonly hitRadius: number = GAME.shellHitRadius;

  // Тёмный фон полоски здоровья над головой.
  private readonly barBg: Phaser.GameObjects.Rectangle;
  // Цветная часть полоски. Её ширина уменьшается вместе с hp.
  private readonly barFill: Phaser.GameObjects.Rectangle;

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
    // Пока спрайт не добавлен в сцену, его не видно и update его не касается.
    scene.add.existing(this);
    // Включаем Arcade-физику: появится body со скоростью и размером.
    scene.physics.add.existing(this);

    this.maxHp = hp;
    this.hp = hp;

    const placed = Infantry.placed;
    // depth 10: враги рисуются поверх земли (0) и искр (2), но под снарядами (15) и танком (25).
    this.setDepth(10);
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
    // Когда спрайт уничтожат, полоски сами не исчезнут — у них другой родитель. Убираем их вручную.
    this.once('destroy', () => {
      this.barBg.destroy();
      this.barFill.destroy();
    });
    // Первый раз ставим полоску над головой сразу, не дожидаясь кадра.
    this.syncBar();
  }

  // Phaser вызывает preUpdate у каждого спрайта перед отрисовкой кадра.
  // time — миллисекунды с запуска игры, delta — миллисекунды с прошлого кадра.
  preUpdate(time: number, delta: number): void {
    // Родитель двигает анимацию и применяет скорость тела к координатам.
    super.preUpdate(time, delta);
    // Пока юнит жив и едет, полоска едет вместе с ним.
    this.syncBar();
    // Мёртвый юнит или открытый магазин (combat === false) — поведение замирает.
    if (this.reachedWall || this.scene.registry.get('combat') === false) {
      return;
    }
    // Наследник здесь решает: просто идти или ещё и стрелять.
    this.act(delta);
  }

  // Пустая реализация для штурмовика: ему достаточно скорости, заданной в march.
  // Стрелки этот метод переопределяют.
  // Подчёркивание у _delta: аргумент обязателен по сигнатуре, но здесь не используется.
  protected act(_delta: number): void {}

  // Даёт скорость влево. Чем выше номер волны, тем быстрее шаг.
  march(wave = 1): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    // База 36 + 4 за волну + случайные 0..10, чтобы юниты одной волны не шли строем с одной скоростью.
    const speed = 36 + wave * 4 + Phaser.Math.Between(0, 10);
    // Отрицательный X — движение влево, к танку. Y не трогаем: дорожка не меняется.
    body.setVelocityX(-speed);
  }

  // Наносит урон. Возвращает true, если после удара здоровья не осталось — сцена тогда вызовет kill.
  hit(damage: number = GAME.shellDamage): boolean {
    // Ниже нуля здоровье не опускаем.
    this.hp = Math.max(0, this.hp - damage);
    // Короткий красно-белый оттенок всей картинки: визуальный «попадание».
    this.setTint(0xffccaa);
    // Через 70 мс оттенок снимаем. Если юнит уже уничтожен, clearTint не вызываем.
    this.scene.time.delayedCall(70, () => {
      if (this.active) {
        this.clearTint();
      }
    });
    this.syncBar();
    return this.hp <= 0;
  }

  // Картинка лежащего тела. null — у этого врага трупа нет, kill сожмёт спрайт как раньше.
  protected corpseTexture(): string | null {
    return null;
  }

  // Момент снятия с поля, до смены картинки. Стрелок здесь прячет отдельную винтовку.
  // _slain: true, если здоровье уже кончилось. Дошедший до стены живым передаёт false.
  protected onDie(_slain: boolean): void {}

  // Уход с поля: остановка и погасшая полоска.
  // Убитый юнит с картинкой останков остаётся на поле. У кого её нет — сжимается и тает.
  // Имя kill совпадает с методом Sprite, поэтому сцена вызывает именно эту версию.
  kill(): void {
    // Повторный вызов (снаряд ещё касается тела) не должен запускать второй таймер.
    if (this.reachedWall) {
      return;
    }
    this.reachedWall = true;
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

    const slain = this.hp <= 0;
    this.onDie(slain);
    const corpse = slain ? this.corpseTexture() : null;
    if (corpse) {
      this.setTexture(corpse);
      // Ниже живых солдат (глубина 10), чтобы идущие наступали на тела, а не прятались под ними.
      this.setDepth(8);
      this.scene.time.delayedCall(Infantry.corpseMs, () => {
        if (this.active) {
          this.destroy();
        }
      });
      return;
    }

    // Tween — плавное изменение свойств за duration миллисекунд.
    this.scene.tweens.add({
      targets: this,
      alpha: 0, // полностью прозрачный
      scale: 0.6, // чуть меньше
      duration: 180,
      // В конце удаляем спрайт. Событие destroy уберёт полоски, если они ещё живы.
      onComplete: () => this.destroy(),
    });
  }

  // Кладёт полоску над макушкой и обрезает цветную часть по доле здоровья.
  private syncBar(): void {
    // Полоску уже уничтожили — трогать её нельзя.
    if (!this.barBg.active) {
      return;
    }
    // displayHeight учитывает scale. 0.95 высоты вверх от точки ног — примерно над шлемом.
    const top = this.y - this.displayHeight * 0.95;
    this.barBg.setPosition(this.x, top);
    // Цветная полоска шириной 30, origin слева, поэтому левый край на 15 пикселей левее центра.
    this.barFill.setPosition(this.x - 15, top);
    // При полном HP ширина 30, при половине — 15, при нуле — 0.
    this.barFill.width = 30 * (this.hp / this.maxHp);
  }

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
  static drawCorpse(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
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

    // Винтовка выпала и лежит в луже. Длинная у стрелка, короткая у штурмовика.
    const rifleX = look.longRifle ? 4 : 10;
    const rifleLen = look.longRifle ? 40 : 32;
    g.fillStyle(look.rifle);
    g.fillRoundedRect(rifleX, 66, rifleLen, 5, 2);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(rifleX + 4, 67, rifleLen - 10, 3, 1);
    g.fillStyle(look.rifleMetal);
    g.fillRect(rifleX - 2, 65, 7, 6);

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
