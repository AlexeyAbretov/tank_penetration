// Главная сцена. Phaser один раз вызывает preload() и create(), потом каждый кадр — update().
// Сцена почти не считает бой сама. Она создаёт системы и по очереди зовёт их методы.
// Порядок чтения: поля — кто участвует в партии, create() их собирает, update() крутит кадр.

import Phaser from 'phaser';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { EnemyShot } from '../entities/EnemyShot';
import { Infantry } from '../entities/Infantry';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { Tank } from '../entities/Tank';
import { ENEMY_HASTE, GAME, enemyHasteOf } from '../gameConfig';
import { createAmbientEmbers } from '../gfx/particles';
import { ensureGameTextures } from '../gfx/ensureGameTextures';
import { BattleEffects } from '../sounds/BattleEffects';
import { BattleMusic } from '../sounds/BattleMusic';
import type { CombatCallbacks } from '../types/CombatCallbacks';
import type { CombatSystem } from '../types/CombatSystem';
import { ProgressShopController } from '../controllers/ProgressShopController';
import { PlayerController } from '../controllers/PlayerController';
import { FramePace } from '../systems/FramePace';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { CombatSave, type SavedRun } from '../saves/CombatSave';
import { ShopController } from '../controllers/ShopController';
import { WaveManager } from '../systems/WaveManager';
import { GameHud, type HudAbility, type HudFrame } from '../ui/huds/GameHud';
import { SettingsPanel } from '../ui/settings/SettingsPanel';
import { preloadImages } from '../images/imagePreloader';
import { preloadSounds } from '../sounds/soundPreloader';

export class GameScene extends Phaser.Scene {
  // Группа пуль врагов. Group — список спрайтов с физикой, по которому системы ходят циклом.
  private enemyShots!: Phaser.Physics.Arcade.Group;
  // Все враги на поле: солдаты, пикап и босс.
  private infantry!: Phaser.Physics.Arcade.Group;

  // Танк и число здоровья базы.
  private player!: PlayerController;
  // Снаряды танка, попадания, проволока, пулемёт, артиллерия, мины и атомный взрыв.
  private combat!: CombatSystem;
  // Выстрелы, взрывы и крики. Музыка сюда не входит: у неё свой ползунок.
  private fx?: BattleEffects;
  // Окно громкости. Бой замирает, музыка нет: иначе ползунок музыки нечего слушать.
  private settings!: SettingsPanel;
  // Когда в последний раз проиграли пример эффекта. Бой на паузе, this.time.now стоит.
  private effectsPreviewAt = 0;
  private settingsOpen = false;
  // true, если окно само остановило физику. Магазин мог остановить её раньше.
  private settingsPausedPhysics = false;
  // Магазин между волнами.
  private shop!: ShopController;
  // Пули и ракеты, которые летят в танк.
  private projectiles!: ProjectileSystem;
  // true, пока на экране «БАЗА РАЗБИТА». Обычный update в этом состоянии не идёт.
  private defeatShop = false;

  // Очки этой партии. После гибели их забирает магазин постоянных улучшений.
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
  // Клавиша + и плюс на цифровом блоке. Обе крутят темп врагов.
  // Клавиша 2 — мины, её слушает CombatSystem.
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

  // Классы интерфейса и боя приходят снаружи. Экземпляры создаются в create():
  // restart() конструктор сцены не вызывает, а до create() нет scene.add и текстуры баннера.
  private hud!: GameHud;

  constructor(
    private readonly combatSave: CombatSave,
    private readonly progressShop: ProgressShopController,
    private readonly waves: WaveManager,
    private readonly music: BattleMusic,
    private readonly Hud: new (
      scene: Phaser.Scene,
      frame: HudFrame,
      maxHp: number,
      abilities: readonly HudAbility[],
    ) => GameHud,
    private readonly Combat: new (
      scene: Phaser.Scene,
      tank: Tank,
      infantry: Phaser.Physics.Arcade.Group,
      shop: ShopController,
      callbacks: CombatCallbacks,
      progressDamage: number,
      progressBlast: number,
      effects: BattleEffects,
    ) => CombatSystem,
    private readonly framePace: FramePace,
  ) {
    // Ключ сцены. restart() ищет её по этой строке и поднимает тот же объект,
    // поэтому хранилище, магазин очков, волны и музыка, переданные при старте, не подменяются.
    super('game');
  }

  // Phaser вызывает это до create. Картинки танка лежат в assets/, музыка — в audio/.
  // Солдат, пули и поле рисует ensureGameTextures уже внутри create.
  preload(): void {
    preloadImages(this);
    preloadSounds(this);
  }

  create(): void {
    ensureGameTextures(this);
    this.score = 0;
    this.coins = 0;
    // combat — можно ли стрелять из танка. Магазин ставит false.
    this.registry.set('combat', true);
    // Темп врагов. Читают пехота и пули через enemyHasteOf.
    this.registry.set(ENEMY_HASTE.key, 1);
    this.paused = false;
    this.pausedPhysics = false;
    this.settingsOpen = false;
    this.settingsPausedPhysics = false;
    this.resumeRequested = false;
    this.resumeArmed = false;
    this.pausedEmitters = [];
    this.time.paused = false;
    this.persistEnabled = false;
    this.autosaveMs = 0;
    this.defeatShop = false;
    this.progressShop.bind(this, () => {
      // Рестарт сцены создаёт create() заново. Пока флаг выключен, старая сцена в save не пишет.
      this.persistEnabled = false;
      this.scene.restart();
    });
    Tank.setProgressSpeedLevel(this.progressShop.speedLevel());

    // Фон на глубине 0. Враги, снаряды и интерфейс рисуются выше.
    this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);
    createAmbientEmbers(this);
    this.input.mouse?.disableContextMenu();

    // Пустые группы. Волна и выстрелы будут add() в них по ходу боя.
    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    // Следующая покупка — ещё одна строка. Порядок слева направо.
    this.hud = new this.Hud(this, GAME, Tank.baseHp, [
      {
        id: 'artillery',
        texture: ArtilleryStrike.iconKey,
        keyLabel: '1',
        hint: '1 — удар',
        cooldownMs: ArtilleryStrike.shop.cooldownMs,
        iconRadius: ArtilleryStrike.iconRadius,
      },
      {
        id: 'mines',
        texture: Mines.iconKey,
        keyLabel: '2',
        hint: '2 — мины',
        cooldownMs: Mines.shop.cooldownMs,
        iconRadius: Mines.iconRadius,
      },
      {
        id: 'nuclear',
        texture: NuclearStrike.iconKey,
        keyLabel: '3',
        hint: '3 — атом',
        cooldownMs: NuclearStrike.shop.cooldownMs,
        iconRadius: NuclearStrike.iconRadius,
      },
    ]);
    this.hud.setHaste(1);
    this.hud.onHasteCycle(() => {
      if (!this.paused && !this.defeatShop) {
        this.cycleEnemyHaste();
      }
    });
    this.hud.onPause(() => this.setPaused(true));
    this.hud.onSettings(() => this.openSettings());
    this.hud.onAutoFire(() => {
      if (this.paused || this.settingsOpen || this.player.isGameOver || this.defeatShop) {
        return;
      }
      this.shop.toggleAutoFire();
    });
    this.hud.onAbility('artillery', () => {
      if (this.paused || this.settingsOpen || this.player.isGameOver || this.defeatShop) {
        return;
      }
      this.combat.requestArtillery();
    });
    this.hud.onAbility('mines', () => {
      if (this.paused || this.settingsOpen || this.player.isGameOver || this.defeatShop) {
        return;
      }
      this.combat.requestMines();
    });
    this.hud.onAbility('nuclear', () => {
      if (this.paused || this.settingsOpen || this.player.isGameOver || this.defeatShop) {
        return;
      }
      this.combat.requestNuclear();
    });
    this.hud.onResume(() => {
      this.resumeRequested = true;
    });
    // Стирает и партию, и постоянные улучшения. Кнопка живёт на плашке паузы.
    this.hud.onNewGame(() => this.restartRun());
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.hasteKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
      this.hasteNumpad = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD);
      this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }
    this.framePace.attach(this);
    this.events.once('shutdown', this.onShutdown, this);

    const fx = new BattleEffects(this);
    this.fx = fx;
    this.player = new PlayerController(
      this,
      this.hud,
      {
        enemyShots: this.enemyShots,
        infantry: this.infantry,
        clearPlayerCombat: () => this.combat.clearProjectiles(),
      },
      () => this.openDefeatShop(),
      fx.tankDeath,
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
      {
        damage: this.progressShop.damageBonus(),
        blast: this.progressShop.blastBonus(),
        coins: this.progressShop.coinBonus(),
      },
      () => this.waves.beginNextWave(),
      // Любая покупка сразу пишет партию, не дожидаясь автозаписи раз в 400 мс.
      () => this.writeSave(),
    );

    this.combat = new this.Combat(
      this,
      this.player.tank,
      this.infantry,
      this.shop,
      {
        onKill: (reward) => this.onEnemyKill(reward),
        onBaseHit: (amount) => this.onBaseHit(amount),
      },
      this.progressShop.damageBonus(),
      this.progressShop.blastBonus(),
      fx,
    );
    // Пересечения снарядов танка с пехотой. Без этого выстрел пролетает сквозь спрайт.
    this.combat.setupOverlap();

    this.music.bind(this);
    this.music.create();
    this.settings = new SettingsPanel(
      this,
      GAME,
      (level) => this.music.setVolume(level),
      (level) => {
        fx.setVolume(level);
        this.previewEffect();
      },
      () => this.closeSettings(),
    );
    this.settings.setMusic(this.music.volume);
    this.settings.setEffects(fx.volume);

    this.waves.bind(
      this,
      this.infantry,
      this.enemyShots,
      Tank.aimPoint(),
      () => this.player.isGameOver,
      () => this.openWaveShop(),
      () => this.writeSave(),
      (wave, banner) => {
        this.hud.setWave(wave);
        if (banner) {
          this.hud.showWaveBanner(wave, banner.boss);
        }
        this.music.playForWave(wave);
      },
    );

    this.projectiles = new ProjectileSystem(
      this,
      this.player.tank,
      this.enemyShots,
      (amount) => this.onBaseHit(amount),
      fx,
    );

    this.applyCameraFx();
    // load читает localStorage. Пустое сохранение начинает волну 1.
    // Если игрок закрыл вкладку на «БАЗА РАЗБИТА», continueRun откроет магазин очков.
    this.continueRun(this.combatSave.load());
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

  // Конец волны. Если в этот момент ещё стоит гриб, панель подождёт, пока облако погаснет.
  private openWaveShop(): void {
    const wait = this.combat.nuclearCloudLeft();
    if (wait <= 0) {
      this.shop.open();
      return;
    }
    this.time.delayedCall(wait, () => {
      if (this.player.isGameOver || this.defeatShop || this.shop.shopOpen) {
        return;
      }
      this.shop.open();
    });
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

    // Esc закрывает настройки и не ставит паузу тем же нажатием.
    if (this.settingsOpen) {
      if (this.pausePressed()) {
        this.closeSettings();
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
    // Перезарядка артиллерии, мин и атомного взрыва идёт и в магазине. Вызов — только когда fighting.
    this.combat.tickArtillery(delta, fighting);
    this.combat.tickMines(delta, fighting);
    this.combat.tickNuclear(delta, fighting);
    this.hud.setAbility('artillery', this.shop.artilleryOwned, this.combat.artilleryCooldown);
    this.hud.setAbility('mines', this.shop.minesOwned, this.combat.minesCooldown);
    this.hud.setAbility('nuclear', this.shop.nuclearOwned, this.combat.nuclearCooldown);
    if (!fighting) {
      return;
    }

    // worldX/worldY — курсор в координатах поля, а не окна браузера.
    const pointer = this.input.activePointer;
    this.player.tick(delta, pointer.worldX, pointer.worldY);

    // Клик по кнопкам темпа, паузы, автострельбы, иконкам покупок, настройкам и замедлению
    // не считается выстрелом: они лежат поверх поля.
    this.combat.tick(
      delta,
      !this.hud.coversHaste(pointer) &&
        !this.hud.coversPause(pointer) &&
        !this.hud.coversSettings(pointer) &&
        !this.hud.coversAutoFire(pointer) &&
        !this.hud.coversAbility(pointer) &&
        !this.framePace.covers(pointer),
    );
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
    this.shop.setPaused(paused);
    this.progressShop.setPaused(paused);
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
    this.music.setPaused(paused);
    this.fx?.setPaused(paused);
    if (paused) {
      this.writeSave();
    }
  }

  // Ползунок эффектов. Бой стоит, поэтому без примера новую громкость не услышать.
  // Реже 180 мс, иначе перетаскивание сыплет ударами пачкой.
  private previewEffect(): void {
    const now = performance.now();
    if (now - this.effectsPreviewAt < 180) {
      return;
    }
    this.effectsPreviewAt = now;
    this.fx?.impacts.play();
  }

  private openSettings(): void {
    if (this.settingsOpen || this.paused || this.player.isGameOver || this.defeatShop) {
      return;
    }
    this.settingsOpen = true;
    // Таймеры и враги стоят. Музыку не трогаем: пауза игры её глушит, а здесь ползунок музыки должен быть слышен.
    this.tweens.pauseAll();
    this.anims.pauseAll();
    this.freezeEmitters();
    this.time.paused = true;
    if (!this.physics.world.isPaused) {
      this.physics.world.pause();
      this.settingsPausedPhysics = true;
    }
    // Камера списка магазина рисуется поверх основного холста и закрыла бы окно.
    this.shop.panel.coverForPause(true);
    this.music.applyVolume();
    this.settings.setOpen(true);
  }

  private closeSettings(): void {
    if (!this.settingsOpen) {
      return;
    }
    this.settingsOpen = false;
    this.settings.setOpen(false);
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.thawEmitters();
    this.time.paused = false;
    if (this.settingsPausedPhysics) {
      this.physics.world.resume();
      this.settingsPausedPhysics = false;
    }
    this.shop.panel.coverForPause(this.paused);
  }

  private onTabHidden(): void {
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }
    this.writeSave();
    if (this.settingsOpen) {
      this.closeSettings();
    }
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
    this.music.destroy();
    this.fx?.destroy();
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
    // coinReward — монеты вида врага. coinBonus() — постоянная прибавка за каждое убийство.
    this.coins += coinReward + this.progressShop.coinBonus();
    this.hud.setScore(this.score);
    this.hud.setCoins(this.coins);
    this.writeSave();
  }

  private onBaseHit(amount: number): void {
    this.player.damage(amount);
    if (this.player.isGameOver) {
      // Сначала запрещаем запись, потом стираем партию. Иначе writeSave успеет положить труп боя обратно.
      this.persistEnabled = false;
      this.progressShop.bank(this.score);
      this.combatSave.clear();
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
    this.progressShop.clearProgress();
    this.combatSave.clear();
    this.scene.restart();
  }

  // Экран после гибели. Партия к этому моменту уже стёрта, здесь только окно очков.
  private openDefeatShop(): void {
    this.defeatShop = true;
    this.closeSettings();
    this.music.stop();
    // Взрыв базы доигрывает сам: к этому моменту от файла остаётся короткий хвост.
    this.fx?.stop();
    this.persistEnabled = false;
    if (this.shop.shopOpen) {
      this.shop.panel.hide();
      this.shop.shopOpen = false;
    }
    this.registry.set('combat', false);
    if (!this.physics.world.isPaused) {
      this.physics.world.pause();
    }
    this.progressShop.open();
  }

  private continueRun(saved: SavedRun | null): void {
    // Гибель уже случилась, а «В бой» игрок не нажал. Магазин очков открывается снова.
    if (this.progressShop.isAwaitingShop()) {
      this.combatSave.clear();
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
    this.combat.setMinesCooldown(saved.minesCooldownMs);
    this.combat.setNuclearCooldown(saved.nuclearCooldownMs);
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
    this.combatSave.save({
      version: 1,
      score: this.score,
      coins: this.coins,
      hp: this.player.health,
      haste: enemyHasteOf(this.registry),
      artilleryCooldownMs: Math.round(this.combat.artilleryCooldown),
      minesCooldownMs: Math.round(this.combat.minesCooldown),
      nuclearCooldownMs: Math.round(this.combat.nuclearCooldown),
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
