// Главная сцена. Phaser один раз вызывает create(), потом каждый кадр — update().
// Здесь собраны правила боя: выстрел, попадания, волны, магазин, конец игры.

import Phaser from 'phaser';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { BarbedWire } from '../entities/BarbedWire';
import { EnemyFactory } from '../entities/EnemyFactory';
import { EnemyShot } from '../entities/EnemyShot';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { Infantry } from '../entities/Infantry';
import { PickupTruck } from '../entities/PickupTruck';
import { Rocket } from '../entities/Rocket';
import { RocketInfantry } from '../entities/RocketInfantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { createArmorSparks, emitArmorSparks } from '../gfx/sparks';
import { createTextures } from '../gfx/textures';
import { ShopPanel } from '../ui/ShopPanel';

// Имя класса сцены — GameScene. В main.ts она передана в config.scene.
export class GameScene extends Phaser.Scene {
  // Восклицательный знак: поле появится не в конструкторе, а в create().
  // TypeScript верит, что к моменту использования оно уже задано.
  private tank!: Tank;
  // Группа снарядов танка. Группа — список объектов, по которому удобно бегать и ловить пересечения.
  private shells!: Phaser.Physics.Arcade.Group;
  // Пули стрелков и пикапов и ракеты ракетчика.
  private enemyShots!: Phaser.Physics.Arcade.Group;
  // Все живые и ещё не удалённые враги.
  private infantry!: Phaser.Physics.Arcade.Group;
  // Красная полоска здоровья базы. Её ширина показывает оставшиеся HP.
  private hpFill!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  // Крупная надпись «ВОЛНА N» по центру, которая гаснет.
  private waveBanner!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  // Затемнение и текст «БАЗА РАЗБИТА». Спрятаны, пока игрок жив.
  private overlay!: Phaser.GameObjects.Container;
  private shop!: ShopPanel;
  // Вспышка искр в точке взрыва снаряда. Излучатель выключен, пока не попросят вспышку.
  private blast!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Искры, которые пуля высекает из брони. Сам по себе поток не идёт.
  private armorSparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Медленные угольки по всему полю, для атмосферы. Горят всегда.
  private embers!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Текущее здоровье базы.
  private hp: number = Tank.baseHp;
  private score = 0;
  private coins = 0;
  // Номер текущей волны. До первой равен 0, beginNextWave сразу делает 1.
  private wave = 0;
  // Сколько врагов волны ещё не вышли на поле.
  private remainingToSpawn = 0;
  // true между волнами: волна ещё не выпущена или уже зачищена и ждёт магазин.
  private awaitingClear = true;
  private shopOpen = false;
  // Сколько раз купили радиус взрыва. 0 — снаряд бьёт только прямую цель.
  private blastLevel = 0;
  // Сколько раз купили урон. Прибавляется к Infantry.shellDamage.
  private damageLevel = 0;
  // Проволока одна на всю партию. После поражения create сбрасывает и флаг, и ссылку.
  private wireOwned = false;
  private wire?: BarbedWire;
  private gameOver = false;

  constructor() {
    // Ключ сцены 'game'. По нему сцену можно перезапустить: this.scene.restart().
    super('game');
  }

  // create вызывается при старте и при каждом restart. Объекты сцены к этому моменту уже сброшены.
  create(): void {
    // Текстуры живут в общем менеджере игры, не в сцене.
    // После restart фон уже есть, заново его рисовать не нужно.
    if (!this.textures.exists('battlefield')) {
      createTextures(this);
    }
    // Классы сами проверяют, есть ли их картинки, и дорисовывают только пропавшие.
    Tank.ensureTextures(this);
    AssaultInfantry.ensureTextures(this);
    GunnerInfantry.ensureTextures(this);
    RocketInfantry.ensureTextures(this);
    Rocket.ensureTextures(this);
    PickupTruck.ensureTextures(this);
    EnemyShot.ensureTextures(this);

    // Повторный заход в create (после поражения) обязан начать с чистого счёта.
    this.hp = Tank.baseHp;
    this.score = 0;
    this.coins = 0;
    this.wave = 0;
    this.remainingToSpawn = 0;
    this.awaitingClear = true;
    this.shopOpen = false;
    this.blastLevel = 0;
    this.damageLevel = 0;
    this.wireOwned = false;
    this.wire = undefined;
    this.gameOver = false;
    // registry — общее хранилище игры. Враги читают 'combat', чтобы замереть в магазине.
    this.registry.set('combat', true);

    // Картинку фона кладём в центр экрана. depth 0 — самый дальний слой.
    this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);

    // Угольки: эмиттер стоит в (700, 360), но каждая частица выбирает свою точку из диапазонов x/y.
    this.embers = this.add.particles(700, 360, 'ember', {
      x: { min: 40, max: 1260 }, // почти вся ширина поля
      y: { min: 80, max: 620 }, // выше баннера
      lifespan: { min: 900, max: 2200 }, // сколько миллисекунд живёт одна искорка
      speedY: { min: -40, max: -12 }, // отрицательный Y — вверх
      speedX: { min: -12, max: 18 }, // небольшой снос в стороны
      scale: { start: 0.8, end: 0 }, // к концу жизни сжимается в точку
      alpha: { start: 0.7, end: 0 }, // и растворяется
      blendMode: Phaser.BlendModes.ADD, // цвет складывается с фоном, искорка светится, а не перекрывает
      frequency: 80, // новая частица каждые 80 мс
      quantity: 1,
    });
    this.embers.setDepth(2);

    // Взрыв снаряда. emitting: false — сам по себе поток не идёт, только по команде emitParticleAt.
    this.blast = this.add.particles(0, 0, 'spark', {
      lifespan: 380,
      speed: { min: 60, max: 280 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
      quantity: 18, // сколько искр в одной вспышке, если не передать число в emitParticleAt
    });
    this.blast.setDepth(16);

    // Танк на глубине 25. Искры поверх брони, иначе вспышка прячется под корпус.
    this.armorSparks = createArmorSparks(this);

    this.tank = new Tank(this, Tank.spawn.x, Tank.spawn.y);
    // Прячем меню браузера ещё и на объекте мыши Phaser, не только в HTML.
    this.input.mouse?.disableContextMenu();

    // Пустые группы. Снаряды и враги попадут в них в момент выстрела и спавна.
    this.shells = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    // Если тело снаряда пересеклось с телом врага, Arcade вызовет эту функцию.
    // Попадание дополнительно проверяется по дистанции в resolveShellHits: тела меньше «радиуса урона».
    this.physics.add.overlap(
      this.shells,
      this.infantry,
      (shellObj, infObj) => {
        // Колбэк получает широкий тип «тело или объект». Приводим к нужным классам.
        const shell = this.asImage(shellObj);
        const unit = this.asInfantry(infObj);
        if (!shell || !unit) {
          return;
        }
        this.detonateShell(shell, unit);
      },
      undefined, // свой фильтр пересечения не нужен, хватает стандартного
      this, // this внутри колбэка — сцена, а не undefined
    );

    this.createUi();
    this.applyCameraFx();
    // Первая волна не сразу: игрок успевает увидеть поле.
    this.time.delayedCall(EnemyFactory.timing.startDelayMs, () => this.beginNextWave());

    // Разовый клик. Зажатая кнопка обрабатывается отдельно в update.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Пока гриб ещё стоит, клик не сбрасывает бой: сначала нужно увидеть обломки и плашку.
      if (this.gameOver) {
        if (this.overlay.visible) {
          this.scene.restart();
        }
        return;
      }
      // Пока открыт магазин, клик по полю не стреляет. Кнопки магазина ловят событие сами.
      if (this.shopOpen) {
        return;
      }
      if (pointer.leftButtonDown()) {
        this.shoot();
      }
    });
  }

  // Кадр игры. _time не используется (общее время сцены). delta — длина кадра в миллисекундах.
  update(_time: number, delta: number): void {
    // На паузе магазина и после поражения сцена не крутит бой.
    // Физический мир в эти моменты тоже стоит, но ранний return дешевле лишних проверок.
    if (this.gameOver || this.shopOpen) {
      return;
    }

    const pointer = this.input.activePointer;
    this.tank.tick(delta);
    // worldX/worldY — координаты курсора в игровом мире, а не в пикселях окна браузера.
    this.tank.aimAt(pointer.worldX, pointer.worldY);

    // Зажатая левая кнопка стреляет с кулдауном танка, не только в момент нажатия.
    if (pointer.leftButtonDown()) {
      this.shoot();
    }

    // Ручная проверка «снаряд близко к торсу» дополняет overlap физических тел.
    this.resolveShellHits();

    this.shells.getChildren().forEach((obj) => {
      const shell = obj as Phaser.Physics.Arcade.Image;
      // Снаряд улетел за экран или в зону нижнего баннера — удаляем, чтобы не копить объекты.
      if (shell.x > GAME.width + 40 || shell.x < 0 || shell.y < 0 || shell.y > GAME.bannerY) {
        shell.destroy();
      }
    });

    this.updateEnemyShots();
    this.snareOnWire(delta);

    this.infantry.getChildren().forEach((obj) => {
      const unit = obj as Infantry;
      // Уже мёртвый или уже засчитанный контакт повторно базу не бьёт.
      if (!unit.active || unit.reachedWall) {
        return;
      }
      // Линия стены. Стрелки до неё не доходят: они встают на x = 640.
      if (unit.x <= Infantry.baseReachX) {
        this.hitBase(unit);
      }
    });

    this.checkWaveClear();
  }

  // Перебирает пары снаряд–враг и взрывает снаряд, если он попал в радиус торса.
  private resolveShellHits(): void {
    const shells = this.shells.getChildren() as Phaser.Physics.Arcade.Image[];
    const units = this.infantry.getChildren() as Infantry[];

    for (const shell of shells) {
      if (!shell.active) {
        continue;
      }
      for (const unit of units) {
        if (!unit.active || unit.reachedWall) {
          continue;
        }
        if (this.shellHitsUnit(shell, unit)) {
          this.detonateShell(shell, unit);
          // Один снаряд взрывается один раз. Дальше по списку врагов не идём:
          // соседей в радиусе добьёт уже сам взрыв, если куплен blastLevel.
          break;
        }
      }
    }
  }

  // Попадание считается по расстоянию до точки груди, не до точки ног спрайта.
  private shellHitsUnit(shell: Phaser.Physics.Arcade.Image, unit: Infantry): boolean {
    const torso = this.torsoPoint(unit);
    return Phaser.Math.Distance.Between(shell.x, shell.y, torso.x, torso.y) <= unit.hitRadius;
  }

  // Точка на корпусе: origin спрайта у ног, поэтому грудь выше y на долю высоты картинки.
  private torsoPoint(unit: Infantry): { x: number; y: number } {
    return {
      x: unit.x,
      y: unit.y - unit.displayHeight * 0.42,
    };
  }

  // Взрыв снаряда. direct — кого задели напрямую. Остальных заденет радиус, если он куплен.
  private detonateShell(shell: Phaser.Physics.Arcade.Image, direct?: Infantry): void {
    // Повторный вызов на том же снаряде (overlap и ручная проверка в одном кадре) ничего не делает.
    if (!shell.active) {
      return;
    }
    // Координаты запоминаем до destroy: после удаления читать shell.x уже нельзя полагаться.
    const x = shell.x;
    const y = shell.y;
    shell.destroy();
    this.playBlast(x, y);

    if (direct) {
      this.hurtInfantry(direct);
    }

    const blastRadius = this.blastLevel * Tank.blastRadiusPerLevel;
    // Нулевой уровень — только прямое попадание, круг по соседям не считаем.
    if (blastRadius <= 0) {
      return;
    }

    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      // Прямую цель уже ударили выше, второй раз в этом взрыве её не трогаем.
      if (unit === direct || !unit.active || unit.reachedWall) {
        return;
      }
      const torso = this.torsoPoint(unit);
      if (Phaser.Math.Distance.Between(x, y, torso.x, torso.y) <= blastRadius) {
        this.hurtInfantry(unit);
      }
    });
  }

  // Один удар по врагу. Если здоровья не осталось — очки, монеты и анимация смерти.
  // damage задаёт проволока: её удар всегда 1, без уровня урона снаряда.
  // wire включает красное мигание вместо вспышки снаряда.
  private hurtInfantry(unit: Infantry, damage = Infantry.shellDamage + this.damageLevel, wire = false): void {
    if (unit.hit(damage, wire)) {
      this.score += 10;
      this.coins += unit.coinReward;
      this.scoreText.setText(`SCORE  ${this.score}`);
      this.coinsText.setText(`COINS  ${this.coins}`);
      unit.kill();
    }
  }

  // Искры и короткая вспышка muzzle в точке взрыва. На прокачанном радиусе вспышка крупнее.
  private playBlast(x: number, y: number): void {
    const radius = this.blastLevel * Tank.blastRadiusPerLevel;
    this.blast.emitParticleAt(x, y, radius > 0 ? 16 : 8);
    const flash = this.add.image(x, y, 'muzzle').setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale(radius > 0 ? 1 : 0.55);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: radius > 0 ? 2.2 : 1.1,
      duration: radius > 0 ? 160 : 90,
      onComplete: () => flash.destroy(),
    });
  }

  // overlap может передать и спрайт, и его физическое тело, и даже тайл карты.
  // Функция достаёт живую картинку снаряда или возвращает null.
  private asImage(
    obj:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): Phaser.Physics.Arcade.Image | null {
    // Если пришло тело, настоящий объект лежит в gameObject. Если пришёл сам спрайт — берём его.
    const go = 'gameObject' in obj && obj.gameObject ? obj.gameObject : obj;
    if (!(go instanceof Phaser.Physics.Arcade.Image) || !go.active) {
      return null;
    }
    return go;
  }

  // То же приведение, но к классу врага, и только если он ещё участвует в бою.
  private asInfantry(
    obj:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): Infantry | null {
    const go = 'gameObject' in obj && obj.gameObject ? obj.gameObject : obj;
    if (!(go instanceof Infantry) || !go.active || go.reachedWall) {
      return null;
    }
    return go;
  }

  // Начинает волну: увеличивает номер, показывает надпись, через паузу выпускает врагов.
  private beginNextWave(): void {
    if (this.gameOver) {
      return;
    }

    this.wave += 1;
    // Пока волна идёт, checkWaveClear не имеет права открыть магазин.
    this.awaitingClear = false;
    // Сколько тел в этой волне. Между шагами число то же, растёт только сила.
    this.remainingToSpawn = EnemyFactory.count(this.wave);
    this.waveText.setText(`WAVE  ${this.wave}`);
    this.showWaveBanner();

    this.time.delayedCall(EnemyFactory.timing.announceMs, () => {
      if (this.gameOver) {
        return;
      }
      this.releaseWave();
    });
  }

  // Анимация заголовка волны: выскакивает и гаснет. Сама волна в этот момент ещё не идёт.
  private showWaveBanner(): void {
    this.waveBanner.setText(`ВОЛНА ${this.wave}`);
    this.waveBanner.setAlpha(1);
    this.waveBanner.setScale(0.86);
    // Если игрок как-то вызвал баннер повторно, старые твины не должны тянуть масштаб.
    this.tweens.killTweensOf(this.waveBanner);
    this.tweens.add({
      targets: this.waveBanner,
      scale: 1.08,
      duration: 280,
      ease: 'Back.Out', // лёгкий отскок в конце, надпись «доезжает» чуть дальше и возвращается
    });
    this.tweens.add({
      targets: this.waveBanner,
      alpha: 0,
      duration: 500,
      delay: 900, // сначала надпись читается, потом полсекунды растворяется
    });
  }

  // Ставит таймер на каждого врага. Чем дальше волна, тем короче пауза между ними.
  private releaseWave(): void {
    const count = this.remainingToSpawn;
    // На каждой волне промежуток меньше на 28 мс, но не ниже waveMinGap.
    const gap = Math.max(
      EnemyFactory.timing.minGap,
      EnemyFactory.timing.spawnGap - (this.wave - 1) * 28,
    );

    for (let i = 0; i < count; i += 1) {
      // i * gap: первый враг сразу (0 мс), второй через gap, третий через 2 * gap.
      this.time.delayedCall(i * gap, () => {
        if (this.gameOver) {
          return;
        }
        this.spawnInfantry(i);
        // Уменьшаем счётчик в момент появления, не в момент планирования.
        // Пока число больше нуля, волна не считается выпущенной до конца.
        this.remainingToSpawn = Math.max(0, this.remainingToSpawn - 1);
      });
    }
  }

  // Сколько врагов ещё на поле и не засчитаны как дошедшие до стены.
  private livingInfantryCount(): number {
    return (this.infantry.getChildren() as Infantry[]).filter(
      (unit) => unit.active && !unit.reachedWall,
    ).length;
  }

  // Волна зачищена, когда все запланированные враги вышли и ни одного живого не осталось.
  private checkWaveClear(): void {
    if (this.gameOver || this.awaitingClear || this.remainingToSpawn > 0) {
      return;
    }
    if (this.livingInfantryCount() > 0) {
      return;
    }
    // Сразу ставим флаг, чтобы следующий кадр не открыл магазин второй раз.
    this.awaitingClear = true;
    this.openShop();
  }

  private openShop(): void {
    this.shopOpen = true;
    // Враги в preUpdate видят combat === false и перестают стрелять.
    this.registry.set('combat', false);
    // Замирают скорости снарядов и шаги. Без паузы пули долетели бы, пока игрок читает магазин.
    this.physics.world.pause();
    this.shop.show(this.coins, this.blastLevel, this.damageLevel, this.wireOwned);
  }

  private closeShopAndContinue(): void {
    this.shop.hide();
    this.shopOpen = false;
    this.registry.set('combat', true);
    this.physics.world.resume();
    this.beginNextWave();
  }

  // Покупка радиуса. Если монет мало, выходим: карточка всё равно присылает клик.
  private buyBlast(): void {
    const cost = ShopPanel.upgradeCost(this.blastLevel);
    if (this.coins < cost) {
      return;
    }
    this.coins -= cost;
    this.blastLevel += 1;
    this.coinsText.setText(`COINS  ${this.coins}`);
    this.shop.refresh(this.coins, this.blastLevel, this.damageLevel, this.wireOwned);
  }

  private buyDamage(): void {
    const cost = ShopPanel.upgradeCost(this.damageLevel);
    if (this.coins < cost) {
      return;
    }
    this.coins -= cost;
    this.damageLevel += 1;
    this.coinsText.setText(`COINS  ${this.coins}`);
    this.shop.refresh(this.coins, this.blastLevel, this.damageLevel, this.wireOwned);
  }

  // Одна полоса на всю высоту поля. Повторный клик по уже купленной карточке сюда не доходит.
  private buyWire(): void {
    if (this.wireOwned || this.coins < BarbedWire.shop.cost) {
      return;
    }
    this.coins -= BarbedWire.shop.cost;
    this.wireOwned = true;
    this.wire = new BarbedWire(this);
    this.coinsText.setText(`COINS  ${this.coins}`);
    this.shop.refresh(this.coins, this.blastLevel, this.damageLevel, this.wireOwned);
  }

  // Пехота, которая идёт к базе, упирается в проволоку.
  // Удар сразу при касании, потом ещё раз каждые barbedWireIntervalMs.
  private snareOnWire(delta: number): void {
    const wire = this.wire;
    if (!wire) {
      return;
    }
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!wire.blocks(unit)) {
        return;
      }
      if (unit.snare(BarbedWire.bounds.face, delta, BarbedWire.shop.hurtIntervalMs)) {
        this.hurtInfantry(unit, BarbedWire.shop.damage, true);
      }
    });
  }

  // Танк сам решает, прошёл ли кулдаун. Сцена только создаёт снаряд, если выстрел разрешён.
  private shoot(): void {
    const shot = this.tank.tryFire();
    if (shot) {
      this.fireShell(shot.x, shot.y, shot.angle);
    }
  }

  // Ставит одного врага справа за экраном, на случайной дорожке.
  private spawnInfantry(index = 0): void {
    if (this.gameOver) {
      return;
    }
    // Шесть горизонтальных линий. Y растёт вниз, 176 — верхняя дорожка, 536 — нижняя.
    const lanes = [176, 248, 320, 392, 464, 536];
    // Between включает оба конца. К дорожке добавляется дрожание ±16, чтобы строй не был линейкой.
    const y = lanes[Phaser.Math.Between(0, lanes.length - 1)] + Phaser.Math.Between(-16, 16);
    // Стартуют правее видимой области, поэтому на экран въезжают, а не появляются вдруг.
    const x = GAME.width + 24 + Phaser.Math.Between(0, 70);
    // Кого ставить на этот номер, решает состав волны в фабрике.
    const unit = EnemyFactory.create(index, {
      scene: this,
      x,
      y,
      wave: this.wave,
      shots: this.enemyShots,
      fireTarget: Tank.aimPoint(),
    });
    this.infantry.add(unit);
    // Скорость берёт ранг роста, который спавн записал в юнита. Пикап подменяет формулу своей.
    unit.march();
  }

  // Создаёт летящий снаряд танка и короткую вспышку у дула.
  private fireShell(x: number, y: number, angle: number): void {
    const shell = this.physics.add.image(x, y, 'shell');
    this.shells.add(shell);
    shell.setDepth(15);
    shell.setBlendMode(Phaser.BlendModes.ADD);
    // Картинка снаряда — горизонтальная вспышка, её крутим по углу ствола.
    shell.setRotation(angle);
    shell.setVelocity(
      Math.cos(angle) * Tank.shellSpeed,
      Math.sin(angle) * Tank.shellSpeed,
    );
    const body = shell.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    // Круглое тело радиуса 18 нужно overlap-проверке. Урон по дистанции использует hitRadius врага.
    body.setCircle(18);

    const flash = this.add.image(x, y, 'muzzle').setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    flash.setRotation(angle);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: Tank.muzzleFlash.scale,
      duration: Tank.muzzleFlash.ms,
      onComplete: () => flash.destroy(),
    });
  }

  // Пули врагов: убрать за экраном или снять HP, если влетели в прямоугольник танка.
  private updateEnemyShots(): void {
    this.enemyShots.getChildren().forEach((obj) => {
      const shot = obj as EnemyShot;
      if (!shot.active) {
        return;
      }
      if (shot.x < 0 || shot.x > GAME.width || shot.y < 0 || shot.y > GAME.bannerY) {
        shot.destroy();
        return;
      }
      if (this.tank.containsPoint(shot.x, shot.y)) {
        // Урон и точку удара читаем до destroy: после удаления объект лучше не трогать.
        const damage = shot.damage;
        const x = shot.x;
        const y = shot.y;
        const travel = shot.rotation;
        shot.destroy();
        if (shot instanceof Rocket) {
          Rocket.burstAt(this, x, y);
        } else {
          this.sparkOnTank(x, y, travel);
        }
        this.damageTank(damage);
      }
    });
  }

  // Пуля врезалась в броню. Искры летят назад, туда, откуда прилетел выстрел.
  private sparkOnTank(x: number, y: number, travel: number): void {
    emitArmorSparks(this.armorSparks, x, y, travel);
  }

  // Общий путь урона по базе: и пуля, и солдат, дошедший до стены.
  private damageTank(amount: number): void {
    if (this.gameOver) {
      return;
    }
    this.hp = Math.max(0, this.hp - amount);
    // Полная полоска — 236 пикселей. Доля hp / baseHp умножает ширину.
    this.hpFill.width = 236 * (this.hp / Tank.baseHp);
    if (this.hp <= 0) {
      this.beginDefeat();
    }
  }

  // Солдат дошёл до линии. Стрелок и пикап имеют reachesBase = false и здесь выходят.
  private hitBase(unit: Infantry): void {
    if (!unit.reachesBase) {
      return;
    }
    unit.kill();
    this.damageTank(unit.contactDamage);
  }

  // Надписи, полоска HP, плашка поражения и магазин. Игровые объекты к этому моменту уже созданы.
  private createUi(): void {
    // Декоративная красная лента внизу экрана.
    this.add.image(GAME.width / 2, 677, 'banner').setDepth(50);

    this.add
      .text(GAME.width / 2, 678, 'TANK', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '42px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(51);

    this.scoreText = this.add
      .text(28, 18, 'SCORE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.waveText = this.add
      .text(28, 48, 'WAVE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#e8c48a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.coinsText = this.add
      .text(28, 74, 'COINS  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    // Пустая строка: текст подставится в showWaveBanner. alpha 0 — пока невидима.
    this.waveBanner = this.add
      .text(GAME.width / 2, 120, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '56px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);

    this.add
      .text(GAME.width / 2, 708, 'мышь — прицел   ЛКМ — огонь', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#e8c48a',
      })
      .setOrigin(0.5)
      .setDepth(51)
      .setAlpha(0.8);

    // Рамка полоски в правом верхнем углу. Сама красная заливка — отдельный прямоугольник,
    // потому что у картинки рамки нельзя плавно менять ширину внутренней полосы.
    this.add.image(1128, 28, 'hp-frame').setDepth(51);
    // Тёмная подложка фиксированной ширины 236. origin (0, 0.5) — левый край остаётся на месте.
    this.add.rectangle(1018, 28, 236, 10, 0x2a0a0a).setOrigin(0, 0.5).setDepth(51);
    this.hpFill = this.add.rectangle(1018, 28, 236, 10, 0xd42a2a).setOrigin(0, 0.5).setDepth(52);

    // Плашка поражения в центре. Появляется, когда ядерный гриб уже гаснет.
    this.overlay = this.add.container(GAME.width / 2, GAME.height / 2).setDepth(80).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.55);
    const title = this.add
      .text(0, -24, 'БАЗА РАЗБИТА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(0, 36, 'Кликните, чтобы начать снова', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);
    this.overlay.add([dim, title, hint]);

    // Стрелки передают методы сцены. () => нужно, чтобы this внутри buyBlast остался сценой.
    this.shop = new ShopPanel(this, {
      onBuyBlast: () => this.buyBlast(),
      onBuyDamage: () => this.buyDamage(),
      onBuyWire: () => this.buyWire(),
      onContinue: () => this.closeShopAndContinue(),
    });
  }

  // Затемнение по краям и лёгкое свечение ярких мест. На геймплей не влияет.
  private applyCameraFx(): void {
    const camera = this.cameras.main;
    try {
      // Виньетка: центр светлый, углы темнее. Числа — сила и радиус эффекта конкретной версии Phaser 4.
      camera.filters.internal.addVignette(0.5, 0.5, 0.85, 0.18);
    } catch {
      // Если в другой мелкой версии Phaser сигнатура другая, игра просто остаётся без виньетки.
    }
    try {
      // Bloom раздувает яркие пиксели (вспышки, искры). threshold — с какой яркости начинать.
      Phaser.Actions.AddEffectBloom(camera, {
        threshold: 0.62,
        blurRadius: 1.2,
        blurSteps: 3,
      });
    } catch {
      // Свечение необязательно. Бой считается и без него.
    }
  }

  // HP кончились. Бой встаёт сразу, плашка — после взрыва, чтобы гриб и обломки успели прочитаться.
  private beginDefeat(): void {
    this.gameOver = true;
    this.registry.set('combat', false);
    this.physics.world.pause();
    this.shells.clear(true, true);
    this.enemyShots.clear(true, true);
    // Останавливаем тех, кто ещё шёл, чтобы они не уезжали под надписью поражения.
    this.infantry.getChildren().forEach((obj) => {
      (obj as Infantry).body?.stop();
    });
    this.tank.die();
    this.cameras.main.shake(680, 0.014);
    this.time.delayedCall(1300, () => {
      this.overlay.setVisible(true);
    });
  }
}
