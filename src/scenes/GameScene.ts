// Главная сцена. Phaser один раз вызывает preload() и create(), потом каждый кадр — update().
// Сцена почти не считает бой сама. Она создаёт системы и по очереди зовёт их методы.
// Порядок чтения: поля — кто участвует в партии, create() их собирает, update() крутит кадр.

import Phaser from 'phaser';
import { EnemyShot } from '../entities/EnemyShot';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { ENEMY_HASTE, GAME, PAUSED, enemyHasteOf } from '../gameConfig';
import { createAmbientEmbers } from '../gfx/particles';
import { ensureGameTextures } from '../gfx/ensureGameTextures';
import { BattleMusic } from '../systems/BattleMusic';
import { CombatSystem } from '../systems/CombatSystem';
import { loadMeta, resetMeta } from '../systems/MetaSave';
import { MetaShopController } from '../systems/MetaShopController';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { clearRun, loadRun, saveRun } from '../systems/RunSave';
import { ShopController } from '../systems/ShopController';
import { WaveManager } from '../systems/WaveManager';
import { GameHud } from '../ui/GameHud';

export class GameScene extends Phaser.Scene {
  // Группа пуль врагов. Group — список спрайтов с физикой, по которому системы ходят циклом.
  private enemyShots!: Phaser.Physics.Arcade.Group;
  // Все враги на поле: солдаты, пикап и босс.
  private infantry!: Phaser.Physics.Arcade.Group;

  private hud!: GameHud;
  // Танк и число здоровья базы.
  private player!: PlayerController;
  // Снаряды танка, попадания, проволока, пулемёт и артиллерия.
  private combat!: CombatSystem;
  // Когда выпускать волну и когда считать её зачищенной.
  private waves!: WaveManager;
  // Луп волны или босса. На паузе и после гибели базы молчит.
  private music?: BattleMusic;
  // Магазин между волнами.
  private shop!: ShopController;
  // Магазин очков после гибели базы.
  private metaShop!: MetaShopController;
  // Пули и ракеты, которые летят в танк.
  private projectiles!: ProjectileSystem;
  // true, пока на экране «БАЗА РАЗБИТА». Обычный update в этом состоянии не идёт.
  private defeatShop = false;

  // Очки этой партии. После гибели прибавляются к запасу в MetaSave.
  private score = 0;
  // Монеты этой партии. Тратятся между волнами и пропадают вместе с партией.
  private coins = 0;
  // Игрок нажал паузу или вкладка ушла в фон.
  private paused = false;
  // true, если пауза сама остановила физику. Магазин останавливает её раньше,
  // и тогда снятие паузы физику не отпускает: магазин всё ещё открыт.
  private pausedPhysics = false;
  // Клик по плашке только поднимает флаг. Снятие паузы делает следующий кадр update.
  private resumeRequested = false;
  // Первый кадр паузы игнорирует Esc и клик. Та же кнопка, которой паузу включили, не снимает её сразу.
  private resumeArmed = false;
  private pausedEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  // Клавиша 2 и та же клавиша на цифровом блоке. Обе крутят темп врагов.
  private hasteKey?: Phaser.Input.Keyboard.Key;
  private hasteNumpad?: Phaser.Input.Keyboard.Key;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  // false до конца create() и в момент гибели, чтобы оборванная партия не записалась поверх стирания.
  private persistEnabled = false;
  // Сколько миллисекунд прошло с прошлой автозаписи. Порог — в touchAutosave.
  private autosaveMs = 0;
  // Одна функция на pagehide и beforeunload, чтобы снять оба слушателя одним и тем же объектом.
  private readonly onPageHide = (): void => {
    this.writeSave();
  };

  constructor() {
    // Ключ сцены. restart() ищет её по этой строке.
    super('game');
  }

  // Phaser вызывает это до create. Картинки танка лежат в assets/, музыка — в audio/.
  // Солдат, пули и поле рисует ensureGameTextures уже внутри create.
  preload(): void {
    this.load.image('tank-hull', 'assets/tank-hull.png');
    this.load.image('tank-turret', 'assets/tank-turret.png');
    this.load.image('tank-gun', 'assets/tank-gun.png');
    this.load.image('tank-mg', 'assets/tank-mg.png');
    // TRACK_01 — обычные волны. boss — каждая 10-я.
    this.load.audio('music-wave', 'audio/TRACK_01.mp3');
    this.load.audio('music-boss', 'audio/boss.mp3');
  }

  create(): void {
    ensureGameTextures(this);
    this.score = 0;
    this.coins = 0;
    // combat — можно ли стрелять из танка. Магазин ставит false.
    this.registry.set('combat', true);
    // Темп врагов. Читают пехота и пули через enemyHasteOf.
    this.registry.set(ENEMY_HASTE.key, 1);
    this.registry.set(PAUSED, false);
    this.paused = false;
    this.pausedPhysics = false;
    this.resumeRequested = false;
    this.resumeArmed = false;
    this.pausedEmitters = [];
    this.time.paused = false;
    this.persistEnabled = false;
    this.autosaveMs = 0;
    this.defeatShop = false;
    Tank.setMetaSpeedLevel(loadMeta().speed);

    // Фон на глубине 0. Враги, снаряды и интерфейс рисуются выше.
    this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);
    createAmbientEmbers(this);
    this.input.mouse?.disableContextMenu();

    // Пустые группы. Волна и выстрелы будут add() в них по ходу боя.
    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    this.hud = new GameHud(this);
    this.hud.setHaste(1);
    this.hud.onHasteCycle(() => {
      if (!this.paused && !this.defeatShop) {
        this.cycleEnemyHaste();
      }
    });
    this.hud.onPause(() => this.setPaused(true));
    this.hud.onResume(() => {
      this.resumeRequested = true;
    });
    // Стирает и партию, и постоянные улучшения. Кнопка живёт на плашке паузы.
    this.hud.onNewGame(() => this.restartRun());
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.hasteKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.hasteNumpad = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO);
      this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }
    this.events.once('shutdown', this.onShutdown, this);

    // combat объявлен заранее: колбэк поражения зовёт его, а сам объект создаётся строками ниже.
    let combat: CombatSystem | undefined;
    this.player = new PlayerController(
      this,
      this.hud,
      {
        enemyShots: this.enemyShots,
        infantry: this.infantry,
        clearPlayerCombat: () => combat?.clearProjectiles(),
      },
      () => this.openDefeatShop(),
    );
    this.player.reset();

    this.shop = new ShopController(
      this,
      this.hud,
      this.player.tank,
      {
        getCoins: () => this.coins,
        // false — монет не хватило, уровень не растёт.
        spendCoins: (amount) => {
          if (this.coins < amount) {
            return false;
          }
          this.coins -= amount;
          return true;
        },
      },
      () => this.waves.beginNextWave(),
      // Любая покупка сразу пишет партию, не дожидаясь автозаписи раз в 400 мс.
      () => this.writeSave(),
    );

    const meta = loadMeta();
    combat = this.combat = new CombatSystem(
      this,
      this.player.tank,
      this.infantry,
      this.shop,
      {
        onKill: (reward) => this.onEnemyKill(reward),
        onBaseHit: (amount) => this.onBaseHit(amount),
      },
      meta.damage,
      meta.blast,
    );
    this.metaShop = new MetaShopController(this, () => {
      // Рестарт сцены создаёт create() заново. Пока флаг выключен, старая сцена в save не пишет.
      this.persistEnabled = false;
      this.scene.restart();
    });
    // Пересечения снарядов танка с пехотой. Без этого выстрел пролетает сквозь спрайт.
    this.combat.setupOverlap();

    const music = new BattleMusic(this);
    music.create();
    this.music = music;

    this.waves = new WaveManager(
      this,
      this.infantry,
      this.enemyShots,
      this.hud,
      () => this.player.isGameOver,
      () => this.shop.open(),
      () => this.writeSave(),
      (wave) => music.playForWave(wave),
    );

    this.projectiles = new ProjectileSystem(
      this,
      this.player.tank,
      this.enemyShots,
      (amount) => this.onBaseHit(amount),
    );

    this.applyCameraFx();
    // loadRun читает localStorage. Пустое сохранение начинает волну 1.
    // Если игрок закрыл вкладку на «БАЗА РАЗБИТА», continueRun откроет магазин очков.
    this.continueRun(loadRun());
    if (!this.defeatShop) {
      this.persistEnabled = true;
    }

    // HIDDEN — вкладка спряталась. pagehide и beforeunload — страницу закрывают или обновляют.
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onTabHidden, this);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('beforeunload', this.onPageHide);
    if (document.hidden) {
      this.setPaused(true);
    }
  }

  // Кадр боя. delta — миллисекунды с прошлого кадра, его забирают системы.
  update(_time: number, delta: number): void {
    // Поражение и магазин очков живут своими кнопками. Кадр боя им не нужен.
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }

    if (this.paused) {
      // resumeArmed становится true только со второго захода. Первый кадр паузы клик проглатывает.
      const resume = this.resumeArmed && (this.resumeRequested || this.pausePressed());
      this.resumeRequested = false;
      if (resume) {
        this.setPaused(false);
      } else {
        this.resumeArmed = true;
      }
      return;
    }

    if (this.pausePressed()) {
      this.setPaused(true);
      return;
    }

    if (this.hastePressed()) {
      this.cycleEnemyHaste();
    }

    const fighting = !this.shop.shopOpen;
    // Перезарядка артиллерии идёт и в магазине. Выстрел — только когда fighting.
    this.combat.tickArtillery(delta, fighting);
    this.hud.setArtillery(this.shop.artilleryOwned, this.combat.artilleryCooldown);
    if (!fighting) {
      return;
    }

    // worldX/worldY — курсор в координатах поля, а не окна браузера.
    const pointer = this.input.activePointer;
    this.player.tick(delta, pointer.worldX, pointer.worldY);

    // Клик по кнопкам темпа и паузы не считается выстрелом: они лежат поверх поля.
    this.combat.tick(delta, !this.hud.coversHaste(pointer) && !this.hud.coversPause(pointer));
    this.projectiles.tick();
    this.waves.tick();
    this.touchAutosave(delta);
  }

  // Ранний выход из update не останавливает физику, таймеры, твины и анимации.
  // Магазин уже держит физику на паузе — тогда мир не трогаем, чтобы не отпустить врагов.
  private setPaused(paused: boolean): void {
    if (this.paused === paused || (paused && (this.player.isGameOver || this.defeatShop))) {
      return;
    }
    this.paused = paused;
    this.registry.set(PAUSED, paused);
    this.time.paused = paused;
    if (paused) {
      this.resumeRequested = false;
      this.resumeArmed = false;
      this.tweens.pauseAll();
      this.anims.pauseAll();
      this.freezeEmitters();
      if (!this.physics.world.isPaused) {
        this.physics.world.pause();
        this.pausedPhysics = true;
      }
    } else {
      this.tweens.resumeAll();
      this.anims.resumeAll();
      this.thawEmitters();
      if (this.pausedPhysics) {
        this.physics.world.resume();
        this.pausedPhysics = false;
      }
    }
    this.hud.setPaused(paused);
    this.shop.panel.coverForPause(paused);
    this.music?.setPaused(paused);
    if (paused) {
      this.writeSave();
    }
  }

  private onTabHidden(): void {
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }
    this.writeSave();
    if (this.paused) {
      return;
    }
    this.setPaused(true);
  }

  private onShutdown(): void {
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onTabHidden, this);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('beforeunload', this.onPageHide);
    if (this.paused) {
      this.anims.resumeAll();
    }
    this.music?.destroy();
  }

  private freezeEmitters(): void {
    const held: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    this.children.each((child) => {
      if (child instanceof Phaser.GameObjects.Particles.ParticleEmitter && child.active) {
        child.pause();
        held.push(child);
      }
    });
    this.pausedEmitters = held;
  }

  private thawEmitters(): void {
    for (const emitter of this.pausedEmitters) {
      if (emitter.scene) {
        emitter.resume();
      }
    }
    this.pausedEmitters = [];
  }

  private hastePressed(): boolean {
    const keyDown = (key?: Phaser.Input.Keyboard.Key) =>
      key !== undefined && Phaser.Input.Keyboard.JustDown(key);
    return keyDown(this.hasteKey) || keyDown(this.hasteNumpad);
  }

  private pausePressed(): boolean {
    return this.pauseKey !== undefined && Phaser.Input.Keyboard.JustDown(this.pauseKey);
  }

  private cycleEnemyHaste(): void {
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }
    const current = enemyHasteOf(this.registry);
    const next = current >= ENEMY_HASTE.max ? 1 : current + 1;
    this.registry.set(ENEMY_HASTE.key, next);
    this.hud.setHaste(next);
    this.writeSave();
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (unit.active) {
        unit.syncPace();
      }
    });
    (this.enemyShots.getChildren() as EnemyShot[]).forEach((shot) => {
      if (shot.active) {
        shot.syncPace();
      }
    });
  }

  private onEnemyKill(coinReward: number): void {
    this.score += 10;
    // coinReward — монеты вида врага. loadMeta().coins — постоянная прибавка за каждое убийство.
    this.coins += coinReward + loadMeta().coins;
    this.hud.setScore(this.score);
    this.hud.setCoins(this.coins);
    this.writeSave();
  }

  private onBaseHit(amount: number): void {
    this.player.damage(amount);
    if (this.player.isGameOver) {
      // Сначала запрещаем запись, потом стираем партию. Иначе writeSave успеет положить труп боя обратно.
      this.persistEnabled = false;
      this.metaShop.bank(this.score);
      clearRun();
      return;
    }
    this.writeSave();
  }

  // Новая игра: партия, score и все купленные уровни стираются.
  private restartRun(): void {
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }
    this.persistEnabled = false;
    resetMeta();
    clearRun();
    this.scene.restart();
  }

  // Экран после гибели. Партия к этому моменту уже стёрта, здесь только окно очков.
  private openDefeatShop(): void {
    this.defeatShop = true;
    this.music?.stop();
    this.persistEnabled = false;
    if (this.shop.shopOpen) {
      this.shop.panel.hide();
      this.shop.shopOpen = false;
    }
    this.registry.set('combat', false);
    if (!this.physics.world.isPaused) {
      this.physics.world.pause();
    }
    this.metaShop.open();
  }

  private continueRun(saved: ReturnType<typeof loadRun>): void {
    // Гибель уже случилась, а «В бой» игрок не нажал. Магазин очков открывается снова.
    if (loadMeta().awaitingShop) {
      clearRun();
      this.shop.syncTankStats();
      this.openDefeatShop();
      return;
    }
    if (!saved) {
      this.shop.syncTankStats();
      this.waves.scheduleFirstWave();
      return;
    }

    // Числа партии. Врагов и покупки поднимают свои системы, сцена только раздаёт поля.
    this.score = saved.score;
    this.coins = saved.coins;
    this.hud.setScore(this.score);
    this.hud.setCoins(this.coins);
    this.player.restoreHealth(saved.hp);
    this.shop.restore(saved.shop);
    this.shop.syncTankStats();
    this.combat.setArtilleryCooldown(saved.artilleryCooldownMs);
    this.registry.set(ENEMY_HASTE.key, saved.haste);
    this.hud.setHaste(saved.haste);
    if (saved.phase === 'shop') {
      this.waves.resumeShop(saved.wave);
      this.shop.open();
      return;
    }
    this.waves.resumeCombat(saved.wave, saved.spawned, saved.enemies);
  }

  private touchAutosave(delta: number): void {
    this.autosaveMs += delta;
    // Реже, чем каждый кадр: localStorage на частом JSON.stringify заметно тормозит.
    if (this.autosaveMs < 400) {
      return;
    }
    this.autosaveMs = 0;
    this.writeSave();
  }

  private writeSave(): void {
    if (!this.persistEnabled || this.player.isGameOver) {
      return;
    }
    const wave = this.waves.capture();
    // Волна ещё не началась — писать нечего, иначе загрузка восстановит пустой бой как магазин.
    if (!wave) {
      return;
    }
    saveRun({
      version: 1,
      score: this.score,
      coins: this.coins,
      hp: this.player.health,
      haste: enemyHasteOf(this.registry),
      artilleryCooldownMs: Math.round(this.combat.artilleryCooldown),
      wave: wave.wave,
      phase: wave.phase,
      spawned: wave.spawned,
      enemies: wave.enemies,
      shop: this.shop.capture(),
    });
  }

  private applyCameraFx(): void {
    const camera = this.cameras.main;
    try {
      camera.filters.internal.addVignette(0.5, 0.5, 0.85, 0.18);
    } catch {
      // Виньетка необязательна.
    }
    try {
      Phaser.Actions.AddEffectBloom(camera, {
        threshold: 0.62,
        blurRadius: 1.2,
        blurSteps: 3,
      });
    } catch {
      // Bloom необязателен.
    }
  }
}
