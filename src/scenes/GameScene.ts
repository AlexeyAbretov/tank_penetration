// Главная сцена. Phaser один раз вызывает preload() и create(), потом каждый кадр — update().
// Сцена почти не считает бой сама. Она создаёт системы и по очереди зовёт их методы.
// Порядок чтения: поля — кто участвует в партии, create() их собирает, update() крутит кадр.

import Phaser from 'phaser';
import { ArtilleryStrikeAbilityConfig, EmpFlashAbilityConfig } from '../abilities';
import { BomberStrike } from '../entities/BomberStrike';
import { IonCannon } from '../entities/IonCannon';
import { EnergyWall } from '../entities/EnergyWall';
import { EnemyShot } from '../entities/EnemyShot';
import { Infantry } from '../entities/Infantry';
import { LaserDefense } from '../entities/LaserDefense';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { RocketSalvo } from '../entities/RocketSalvo';
import { Tank } from '../entities/Tank/Tank';
import { DEBUG_FORFEIT_EVENT, DEBUG_RESTART_WAVE_EVENT, ENEMY_HASTE, GAME, enemyHasteOf, isDebugRun } from '../gameConfig';
import { boom } from '../gfx/boom';
import { createAmbientEmbers } from '../gfx/particles';
import { ensureGameTextures } from '../gfx/ensureGameTextures';
import { BattleEffects } from '../sounds/BattleEffects';
import { BattleMusic } from '../sounds/BattleMusic';
import type { CombatCallbacks } from '../types/CombatCallbacks';
import type { CombatSystem } from '../types/CombatSystem';
import { FocusPause } from '../controllers/FocusPause';
import { PauseStack } from '../controllers/PauseStack';
import { ProgressShopController } from '../controllers/ProgressShopController';
import { PlayerController } from '../controllers/PlayerController';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { CombatSave, type SavedRun } from '../saves/CombatSave';
import { ShopController } from '../controllers/ShopController';
import { WaveManager } from '../systems/WaveManager';
import { GameHud } from '../ui/huds/GameHud';
import { SettingsPanel } from '../ui/settings/SettingsPanel';
import { ShopPanel, type ShopDelegate } from '../ui/shops/ShopPanel';
import { preloadImages } from '../images/imagePreloader';
import { preloadSounds } from '../sounds/soundPreloader';
import { HudAbility, HudFrame } from '../ui/huds/GameHud.types';
import { AbilityList, cooldownFor } from '../abilities';

export class GameScene extends Phaser.Scene {
  // Группа пуль врагов. Group — список спрайтов с физикой, по которому системы ходят циклом.
  private enemyShots!: Phaser.Physics.Arcade.Group;
  // Все враги на поле: солдаты, пикап и босс.
  private infantry!: Phaser.Physics.Arcade.Group;

  // Танк и число здоровья базы.
  private player!: PlayerController;
  // Снаряды танка, попадания, проволока, пулемёт, артиллерия, мины, атомный взрыв и энергетическая стена.
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
  // Сколько пауз держит часы. Ноль — бой идёт. Вид паузы сцена не хранит.
  private holdDepth = 0;
  // true, если пауза сама остановила физику. Магазин останавливает её раньше,
  // и тогда снятие паузы физику не отпускает: магазин всё ещё открыт.
  private pausedPhysics = false;
  private pausedEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  // Клавиша + и плюс на цифровом блоке. Обе крутят темп врагов.
  // Клавиша 2 — мины, её слушает CombatSystem.
  private hasteKey?: Phaser.Input.Keyboard.Key;
  private hasteNumpad?: Phaser.Input.Keyboard.Key;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  // Дебаг: F сразу проигрывает партию и открывает магазин очков.
  private forfeitKey?: Phaser.Input.Keyboard.Key;
  // false до конца create() и в момент гибели, чтобы оборванная партия не записалась поверх стирания.
  private persistEnabled = false;
  // Сколько миллисекунд прошло с прошлой автозаписи. Порог — в touchAutosave.
  private autosaveMs = 0;
  // Секунда автопокупки после открытия магазина волны. Снятие выключателя её убирает.
  private shopAutoTimer?: Phaser.Time.TimerEvent;
  // Ожидание, пока доиграет разрыв, и только потом витрина. Перезапуск волны его снимает.
  private waveShopTimer?: Phaser.Time.TimerEvent;
  // Одна функция на pagehide и beforeunload, чтобы снять оба слушателя одним и тем же объектом.
  private readonly onPageHide = (): void => {
    this.writeSave();
  };

  // Классы интерфейса и боя приходят снаружи. Экземпляры создаются в create():
  // restart() конструктор сцены не вызывает, а до create() нет scene.add и текстуры баннера.
  private hud!: GameHud;
  private field!: Phaser.GameObjects.Image;

  constructor(
    private readonly combatSave: CombatSave,
    private readonly progressShop: ProgressShopController,
    private readonly waves: WaveManager,
    private readonly music: BattleMusic,
    private readonly Hud: (new (
      scene: Phaser.Scene,
      frame: HudFrame,
      maxHp: number,
      abilities: readonly HudAbility[],
    ) => GameHud) & {
      preload(scene: Phaser.Scene): void;
    },
    private readonly Combat: new (
      scene: Phaser.Scene,
      tank: Tank,
      infantry: Phaser.Physics.Arcade.Group,
      shop: ShopController,
      progressShop: ProgressShopController,
      enemyShots: Phaser.Physics.Arcade.Group,
      callbacks: CombatCallbacks,
      progressDamage: number,
      progressBlast: number,
      progressKnockback: number,
      progressPierce: number,
      mgBullets: number,
      progressMgDamage: number,
      progressSalvoDamage: number,
      progressArtilleryDamage: number,
      progressMinesDamage: number,
      progressWireDamage: number,
      progressFlameDamage: number,
      progressIonDamage: number,
      progressBomberDamage: number,
      laserShots: number,
      effects: BattleEffects,
    ) => CombatSystem,
    private readonly pauses: PauseStack,
    // Окно громкости. Дебаг подставляет наследника с полем числа врагов. Обычная партия — само окно.
    private readonly SettingsView: new (
      scene: Phaser.Scene,
      frame: { width: number; height: number },
      onMusic: (level: number) => void,
      onEffects: (level: number) => void,
      onFocusPause: (on: boolean) => void,
      onClose: () => void,
    ) => SettingsPanel = SettingsPanel,
    // Игрок. Дебаг подставляет наследника со своим запасом здоровья.
    private readonly Player: typeof PlayerController = PlayerController,
    // Витрина волны. Дебаг подставляет наследника с кнопкой «+». Обычная партия — само окно.
    private readonly ShopView: new (
      scene: Phaser.Scene,
      shop: ShopDelegate,
      screen: { width: number; height: number },
    ) => ShopPanel = ShopPanel,
    // Магазин волны. Дебаг подставляет наследника, который слушает M. Обычная партия — сам контроллер.
    private readonly Shop: typeof ShopController = ShopController,
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
    // Дебаг-интерфейс добавляет свою картинку. Общий список её не знает.
    this.Hud.preload(this);
  }

  create(): void {
    ensureGameTextures(this);
    this.score = 0;
    this.coins = 0;
    // combat — можно ли стрелять из танка. Магазин ставит false.
    this.registry.set('combat', true);
    // Темп врагов. Читают пехота и пули через enemyHasteOf.
    this.registry.set(ENEMY_HASTE.key, 1);
    this.holdDepth = 0;
    this.pausedPhysics = false;
    this.settingsOpen = false;
    this.settingsPausedPhysics = false;
    this.pausedEmitters = [];
    // «Новая игра» с экрана паузы перезапускает сцену, не отпуская часы.
    // shutdown твинов и глобальных анимаций флаг паузы не сбрасывает.
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.persistEnabled = false;
    this.autosaveMs = 0;
    this.defeatShop = false;
    // Купленный запас до полоски: интерфейс и игрок читают уже новое число.
    // Дебаг здесь свой запас не трогает — его держит поле в настройках.
    this.progressShop.syncTankHp();
    Tank.setProgressSpeedLevel(this.progressShop.speedLevel());
    Tank.setProgressFlightLevel(this.progressShop.flightLevel());
    Tank.setProgressBlastLevel(this.progressShop.blastBonus());
    Tank.setProgressKnockbackLevel(this.progressShop.knockbackBonus());
    Tank.setProgressPierceLevel(this.progressShop.pierceBonus());
    Tank.setAbsorbLevel(this.progressShop.absorbBonus());
    MachineGun.setProgressSpeedLevel(this.progressShop.mgSpeedLevel());
    MachineGun.setProgressFlightLevel(this.progressShop.mgFlightLevel());
    RocketSalvo.setProgressRocketLevel(this.progressShop.salvoRocketLevel());
    Mines.setProgressMineLevel(this.progressShop.minesCountLevel());
    Mines.setProgressCooldownLevel(this.progressShop.minesCooldownLevel());
    NuclearStrike.setProgressCooldownLevel(this.progressShop.nuclearCooldownLevel());
    IonCannon.setProgressCooldownLevel(this.progressShop.ionCooldownLevel());
    IonCannon.setProgressSweepLevel(this.progressShop.ionSweepLevel());
    IonCannon.setProgressWidthLevel(this.progressShop.ionWidthLevel());
    EnergyWall.setProgressDurationLevel(this.progressShop.wallDurationLevel());
    EnergyWall.setProgressCooldownLevel(this.progressShop.wallCooldownLevel());
    BomberStrike.setProgressCooldownLevel(this.progressShop.bomberCooldownLevel());
    LaserDefense.setProgressCooldownLevel(this.progressShop.laserCooldownLevel());

    // Фон на глубине 0. Враги, снаряды и интерфейс рисуются выше.
    this.field = this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);
    this.field.setDisplaySize(GAME.width, GAME.height);
    createAmbientEmbers(this);
    this.input.mouse?.disableContextMenu();

    // Пустые группы. Волна и выстрелы будут add() в них по ходу боя.
    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    // Следующая покупка — ещё одна строка. Порядок слева направо.
    this.hud = new this.Hud(this, GAME, this.Player.baseHp(), [
      ...AbilityList
    ]);
    this.progressShop.bind(this, () => {
      // Рестарт сцены создаёт create() заново. Пока флаг выключен, старая сцена в save не пишет.
      this.persistEnabled = false;
      this.scene.restart();
    });
    this.hud.setAutoFireMode(this.progressShop.autoFireEnabled());
    this.hud.setHaste(1);
    this.hud.onHasteCycle(() => {
      if (!this.pauses.blocking && !this.defeatShop) {
        this.cycleEnemyHaste();
      }
    });
    this.hud.onSettings(() => this.openSettings());
    this.hud.onAutoFire(() => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoFire();
      this.paintAutoFire();
    });
    this.hud.onAutoAim(() => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoAim();
      this.hud.setAutoAimToggle(this.progressShop.autoAimOwned(), this.progressShop.autoAimEnabled());
    });
    this.hud.setAutoAimToggle(this.progressShop.autoAimOwned(), this.progressShop.autoAimEnabled());
    this.hud.onAutoShop(() => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoShop();
      this.hud.setAutoShopToggle(this.progressShop.autoShopOwned(), this.progressShop.autoShopEnabled());
      if (!this.shop.shopOpen) {
        return;
      }
      if (this.progressShop.autoShopEnabled()) {
        this.armShopAutoBuy();
      } else {
        this.cancelShopAutoBuy();
      }
    });
    this.hud.setAutoShopToggle(this.progressShop.autoShopOwned(), this.progressShop.autoShopEnabled());
    this.hud.onAbility('artillery', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.combat.requestArtillery();
    });
    this.hud.onAbility('mines', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.combat.requestMines();
    });
    this.hud.onAbility('nuclear', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.combat.requestNuclear();
    });
    this.hud.onAbility('ion', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.combat.requestIon();
    });
    this.hud.onAbility('wall', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.combat.requestWall();
    });
    this.hud.onAbility('emp', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.combat.requestEmp();
    });
    this.hud.onAbility('bomber', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.combat.requestBomber();
    });
    this.hud.onAutoApply('artillery', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoArtillery();
      this.applyAutoStrikes();
      this.paintAutoStrikes();
    });
    this.hud.onAutoApply('mines', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoMines();
      this.applyAutoStrikes();
      this.paintAutoStrikes();
    });
    this.hud.onAutoApply('ion', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoIon();
      this.applyAutoStrikes();
      this.paintAutoStrikes();
    });
    this.hud.onAutoApply('bomber', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoBomber();
      this.applyAutoStrikes();
      this.paintAutoStrikes();
    });
    this.hud.onAutoApply('wall', () => {
      if (this.blocksPlay()) {
        return;
      }
      this.progressShop.toggleAutoWall();
      this.applyAutoStrikes();
      this.paintAutoStrikes();
    });
    // Стирает и партию, и постоянные улучшения. Кнопка живёт на плашке паузы.
    this.hud.onNewGame(() => this.restartRun());
    if (isDebugRun()) {
      this.events.on(DEBUG_FORFEIT_EVENT, this.onDebugForfeit, this);
      // Раньше волн: на одном событии сцена закрывает витрину, и только потом менеджер
      // заново объявляет номер. Иначе враги вышли бы под открытым магазином.
      this.events.on(DEBUG_RESTART_WAVE_EVENT, this.onDebugRestartWave, this);
    }
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.hasteKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
      this.hasteNumpad = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD);
      this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      if (isDebugRun()) {
        this.forfeitKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      }
    }
    this.events.once('shutdown', this.onShutdown, this);

    const fx = new BattleEffects(this);
    this.fx = fx;
    this.player = new this.Player(
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

    this.shop = new this.Shop(
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
        // Кошелёк партии. Магазин просит прибавить, сцена пишет число, счёт и сохранение.
        addCoins: (amount) => {
          const gained = Math.max(0, Math.round(amount));
          this.coins += gained;
          this.hud.setCoins(this.coins);
          this.writeSave();
        },
      },
      {
        damage: this.progressShop.damageBonus(),
        blast: this.progressShop.blastBonus(),
        knockback: this.progressShop.knockbackBonus(),
        pierce: this.progressShop.pierceBonus(),
        coins: this.progressShop.coinBonus(),
        points: this.progressShop.pointBonus(),
        mg: this.progressShop.mgDamageBonus(),
        salvo: this.progressShop.salvoDamageBonus(),
        artillery: this.progressShop.artilleryDamageBonus(),
        artilleryShells: this.progressShop.shellCount(),
        artilleryCooldownLevel: this.progressShop.artilleryCooldownLevel(),
        empCooldownLevel: this.progressShop.empCooldownLevel(),
        empStunLevel: this.progressShop.empStunLevel(),
        mines: this.progressShop.minesDamageBonus(),
        wire: this.progressShop.wireDamageBonus(),
        flame: this.progressShop.flameDamageBonus(),
        ion: this.progressShop.ionDamageBonus(),
        bomber: this.progressShop.bomberDamageBonus(),
      },
      () => {
        this.cancelShopAutoBuy();
        this.waves.beginNextWave();
      },
      // Любая покупка сразу пишет партию, не дожидаясь автозаписи раз в 400 мс.
      () => this.writeSave(),
      this.ShopView,
    );

    this.combat = new this.Combat(
      this,
      this.player.tank,
      this.infantry,
      this.shop,
      this.progressShop,
      this.enemyShots,
      {
        onKill: (reward) => this.onEnemyKill(reward),
        onBaseHit: (amount) => this.onBaseHit(amount),
      },
      this.progressShop.damageBonus(),
      this.progressShop.blastBonus(),
      this.progressShop.knockbackBonus(),
      this.progressShop.pierceBonus(),
      this.progressShop.bulletCount(),
      this.progressShop.mgDamageBonus(),
      this.progressShop.salvoDamageBonus(),
      this.progressShop.artilleryDamageBonus(),
      this.progressShop.minesDamageBonus(),
      this.progressShop.wireDamageBonus(),
      this.progressShop.flameDamageBonus(),
      this.progressShop.ionDamageBonus(),
      this.progressShop.bomberDamageBonus(),
      this.progressShop.laserShotCount(),
      fx,
    );
    // Пересечения снарядов танка с пехотой. Без этого выстрел пролетает сквозь спрайт.
    this.combat.setupOverlap();

    this.music.bind(this);
    this.music.create();
    this.settings = new this.SettingsView(
      this,
      GAME,
      (level) => this.music.setVolume(level),
      (level) => {
        fx.setVolume(level);
        this.previewEffect();
      },
      (on) => FocusPause.setEnabled(on),
      () => this.closeSettings(),
    );
    this.settings.setMusic(this.music.volume);
    this.settings.setEffects(fx.volume);
    this.settings.setFocusPause(FocusPause.enabled);

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
          this.hud.showWaveBanner(wave, banner.boss, banner.title);
        }
        this.music.playForWave(wave);
      },
      (reward) => this.onEnemyKill(reward),
    );

    this.projectiles = new ProjectileSystem(
      this,
      this.player.tank,
      this.enemyShots,
      (amount) => this.onBaseHit(amount),
      fx,
      () => this.combat.shieldFace(),
      (y) => this.combat.shieldGlint(y),
    );

    this.applyCameraFx();
    // Автострельба живёт в прогрессе. Надпись и бой читают её до разбора партии.
    this.paintAutoFire();
    this.applyAutoStrikes();
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
    this.pauses.attach(this, this.hud, keyboard ?? null, {
      // Магазин между волнами уже остановил поле. Пауза поверх карточек не нужна.
      // Магазин очков закрыт флагом defeatShop.
      canPause: () =>
        !this.settingsOpen && !this.player.isGameOver && !this.defeatShop && !this.shop.shopOpen,
      acquire: () => this.acquireClock(),
      release: () => this.releaseClock(),
      save: () => this.writeSave(),
      showPlate: (on) => this.hud.setPaused(on),
      coverShop: (on) => this.shop.panel.coverForPause(on),
    });
    if (document.hidden) {
      this.pauses.onHidden();
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutFrame, this);
  }

  // Ширина поля изменилась вместе с окном. Фон и окна, которые стоят по центру, едут за ней.
  // Лежащие мины правее нового края бой подтягивает на поле.
  private layoutFrame(): void {
    this.field.setPosition(GAME.width / 2, GAME.height / 2);
    this.field.setDisplaySize(GAME.width, GAME.height);
    this.hud.layout();
    this.settings.layout();
    this.shop.panel.place();
    this.progressShop.layout();
    this.combat.pullMines();
  }

  // Конец волны. Панель выходит, когда последний разрыв доиграл.
  // Гриб и вспышка бомбы, если они ещё стоят дольше разрыва, держат её до своего конца.
  private openWaveShop(): void {
    this.waveShopTimer?.remove(false);
    const wait = Math.max(boom.goneMs, this.combat.nuclearCloudLeft(), this.combat.bomberBlastLeft());
    this.waveShopTimer = this.time.delayedCall(wait, () => {
      this.waveShopTimer = undefined;
      if (this.player.isGameOver || this.defeatShop || this.shop.shopOpen) {
        return;
      }
      this.shop.open();
      this.armShopAutoBuy();
    });
  }

  // Секунда после появления магазина волны. Выключенная автопокупка секунду не ставит.
  private armShopAutoBuy(): void {
    this.cancelShopAutoBuy();
    if (!this.shop.shopOpen || !this.progressShop.autoShopEnabled()) {
      return;
    }
    this.shopAutoTimer = this.time.delayedCall(1000, () => {
      this.shopAutoTimer = undefined;
      if (!this.shop.shopOpen || !this.progressShop.autoShopEnabled()) {
        return;
      }
      if (this.player.isGameOver || this.defeatShop) {
        return;
      }
      this.shop.spendTankThenGun();
      this.shop.closeAndContinue();
    });
  }

  private cancelShopAutoBuy(): void {
    this.shopAutoTimer?.remove(false);
    this.shopAutoTimer = undefined;
  }

  // Кадр боя. delta — миллисекунды с прошлого кадра, его забирают системы.
  update(_time: number, delta: number): void {
    // Раньше магазинов и паузы: иначе F молчит, пока витрина открыта.
    if (this.forfeitPressed()) {
      this.forfeitRun();
    }

    // Поражение и магазин очков живут своими кнопками. Кадр боя им не нужен.
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }

    // Esc закрывает настройки и не ставит паузу тем же нажатием.
    if (this.settingsOpen) {
      if (this.pausePressed()) {
        this.closeSettings();
      }
      return;
    }

    const held = this.pauses.blocking;
    this.pauses.tick(this.pausePressed());
    if (held || this.pauses.blocking) {
      return;
    }

    if (this.hastePressed()) {
      this.cycleEnemyHaste();
    }

    const fighting = !this.shop.shopOpen;
    // Перезарядка артиллерии, ионной пушки, мин, атомного взрыва, стены, бомбардировщика и ЭМИ идёт и в магазине. Вызов — только когда fighting.
    // Секунда автоприменения тикает там же. Сам удар, постановка, луч, завеса и пролёт ждут закрытого магазина. Уже пущенный луч, стоящая стена, летящий самолёт и вспышка ЭМИ не замирают.
    this.applyAutoStrikes();
    this.combat.tickArtillery(delta, fighting);
    this.combat.tickMines(delta, fighting);
    this.combat.tickNuclear(delta, fighting);
    this.combat.tickIon(delta, fighting);
    this.combat.tickWall(delta, fighting);
    this.combat.tickBomber(delta, fighting);
    this.combat.tickEmp(delta, fighting);
    this.hud.setAbility(
      'artillery',
      this.shop.artilleryOwned,
      this.combat.artilleryCooldown,
      cooldownFor(this.shop.artilleryCooldownLevel,
        this.progressShop.artilleryCooldownLevel(),
        ArtilleryStrikeAbilityConfig),
    );
    this.hud.setAbility(
      'mines',
      this.shop.minesOwned,
      this.combat.minesCooldown,
      Mines.cooldownFor(this.shop.minesCooldownLevel),
    );
    this.hud.setAbility(
      'nuclear',
      this.shop.nuclearOwned,
      this.combat.nuclearCooldown,
      NuclearStrike.cooldownFor(this.shop.nuclearCooldownLevel),
    );
    this.hud.setAbility(
      'ion',
      this.shop.ionOwned,
      this.combat.ionCooldown,
      IonCannon.cooldownFor(this.shop.ionCooldownLevel),
    );
    this.hud.setAbility(
      'wall',
      this.shop.wallOwned,
      this.combat.wallCooldown,
      EnergyWall.cooldownFor(this.shop.wallCooldownLevel),
    );
    this.hud.setAbility(
      'bomber',
      this.shop.bomberOwned,
      this.combat.bomberCooldown,
      BomberStrike.cooldownFor(this.shop.bomberCooldownLevel),
    );
    this.hud.setAbility(
      'emp',
      this.shop.empOwned,
      this.combat.empCooldown,
      cooldownFor(this.shop.empCooldownLevel, this.progressShop.empCooldownLevel(), EmpFlashAbilityConfig),
    );
    this.paintAutoStrikes();
    this.hud.setAutoAimToggle(this.progressShop.autoAimOwned(), this.progressShop.autoAimEnabled());
    this.hud.setAutoShopToggle(this.progressShop.autoShopOwned(), this.progressShop.autoShopEnabled());
    this.paintAutoFire();
    if (!fighting) {
      return;
    }

    // worldX/worldY — курсор в координатах поля, а не окна браузера.
    // Включённое автонаведение подставляет живую цель и не бросает её, пока она не погибла.
    const pointer = this.input.activePointer;
    const locked = this.progressShop.autoAimEnabled() ? this.combat.aimPoint() : null;
    this.player.tick(delta, locked?.x ?? pointer.worldX, locked?.y ?? pointer.worldY);

    // Клик по кнопкам темпа, паузы, автострельбы, автонаведения, автопокупки, урона врагов, клавиш, иконкам покупок, настройкам и дебаг-плашкам не считается выстрелом: они лежат поверх поля.
    this.combat.tick(
      delta,
      !this.hud.coversHaste(pointer) &&
        !this.hud.coversPause(pointer) &&
        !this.hud.coversSettings(pointer) &&
        !this.hud.coversDebugPlates(pointer) &&
        !this.hud.coversAutoFire(pointer) &&
        !this.hud.coversAutoAim(pointer) &&
        !this.hud.coversAutoShop(pointer) &&
        !this.hud.coversEnemyDamage(pointer) &&
        !this.hud.coversAbility(pointer) &&
        !this.hud.coversKeys(pointer),
    );
    this.projectiles.tick();
    this.waves.tick();
    this.touchAutosave(delta);
  }

  // Знак питания на иконке и сам вызов читают одну покупку прогресса.
  private applyAutoStrikes(): void {
    this.combat.setAutoArtillery(this.progressShop.autoArtilleryEnabled());
    this.combat.setAutoMines(this.progressShop.autoMinesEnabled());
    this.combat.setAutoIon(this.progressShop.autoIonEnabled());
    this.combat.setAutoBomber(this.progressShop.autoBomberEnabled());
    this.combat.setAutoWall(this.progressShop.autoWallEnabled());
  }

  private paintAutoStrikes(): void {
    this.hud.setAutoApply('artillery', this.progressShop.autoArtilleryOwned(), this.progressShop.autoArtilleryEnabled());
    this.hud.setAutoApply('mines', this.progressShop.autoMinesOwned(), this.progressShop.autoMinesEnabled());
    this.hud.setAutoApply('ion', this.progressShop.autoIonOwned(), this.progressShop.autoIonEnabled());
    this.hud.setAutoApply('bomber', this.progressShop.autoBomberOwned(), this.progressShop.autoBomberEnabled());
    this.hud.setAutoApply('wall', this.progressShop.autoWallOwned(), this.progressShop.autoWallEnabled());
  }

  // Иконка справа и выстрел без ЛКМ читают одну и ту же покупку прогресса.
  // Слово «авто» или «ЛКМ» сцена пишет отдельно, в create().
  public paintAutoFire(): void {
    const enabled = this.progressShop.autoFireEnabled();
    this.hud.setAutoFireToggle(this.progressShop.autoFireOwned(), enabled);
    this.combat.setAutoFire(enabled);
  }

  // Ранний выход из update не останавливает физику, таймеры, твины и анимации.
  // Магазин уже держит физику на паузе — тогда мир не трогаем, чтобы не отпустить врагов.
  // Повторный acquire, пока часы уже стоят, частицы второй раз не собирает.
  private acquireClock(): void {
    this.holdDepth += 1;
    if (this.holdDepth > 1) {
      return;
    }
    this.shop.setPaused(true);
    this.progressShop.setPaused(true);
    this.time.paused = true;
    this.tweens.pauseAll();
    this.anims.pauseAll();
    this.freezeEmitters();
    if (!this.physics.world.isPaused) {
      this.physics.world.pause();
      this.pausedPhysics = true;
    }
    this.music.setPaused(true);
    this.fx?.setPaused(true);
  }

  private releaseClock(): void {
    if (this.holdDepth === 0) {
      return;
    }
    this.holdDepth -= 1;
    if (this.holdDepth > 0) {
      return;
    }
    this.shop.setPaused(false);
    this.progressShop.setPaused(false);
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.thawEmitters();
    if (this.pausedPhysics) {
      this.physics.world.resume();
      this.pausedPhysics = false;
    }
    this.music.setPaused(false);
    this.fx?.setPaused(false);
  }

  private blocksPlay(): boolean {
    return this.pauses.blocking || this.settingsOpen || this.player.isGameOver || this.defeatShop;
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
    if (this.blocksPlay()) {
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
    this.shop.panel.coverForPause(this.pauses.coversShop);
  }

  private onTabHidden(): void {
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }
    this.writeSave();
    // Настройки уже держат бой. Плашку паузы не ставим: иначе по возврату вместо громкости «ПАУЗА».
    if (this.settingsOpen) {
      return;
    }
    this.pauses.onHidden();
  }

  private onShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutFrame, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onTabHidden, this);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('beforeunload', this.onPageHide);
    // Часы и твины живут дольше сцены: иначе загрузка следующей игры идёт на паузе.
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.music.destroy();
    this.fx?.destroy();
    this.events.off(DEBUG_FORFEIT_EVENT, this.onDebugForfeit, this);
    this.events.off(DEBUG_RESTART_WAVE_EVENT, this.onDebugRestartWave, this);
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

  private forfeitPressed(): boolean {
    return this.forfeitKey !== undefined && Phaser.Input.Keyboard.JustDown(this.forfeitKey);
  }

  // Кнопка на дебаг-счёте. Та же гибель, что у F, в том числе пока открыта витрина.
  private onDebugForfeit(): void {
    this.forfeitRun();
  }

  // R и кнопка на дебаг-счёте. Витрина и её отложенное открытие уходят, следующая волна не стартует.
  // Номер заново объявляет DebugWaveManager на том же событии, сразу после этого метода.
  private onDebugRestartWave(): void {
    if (this.player.isGameOver || this.defeatShop || this.time.paused) {
      return;
    }
    this.cancelShopAutoBuy();
    this.waveShopTimer?.remove(false);
    this.waveShopTimer = undefined;
    this.shop.dismiss();
  }

  // Обычная гибель без паузы на взрыв: хп 0, очки в копилку, партия стёрта, магазин очков.
  private forfeitRun(): void {
    if (this.player.isGameOver || this.defeatShop) {
      return;
    }
    this.pauses.yieldAll();
    // Сначала запрещаем запись, потом стираем партию. Иначе writeSave успеет положить труп боя обратно.
    this.persistEnabled = false;
    this.progressShop.bank(this.score);
    this.combatSave.clear();
    this.player.forfeit();
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
    this.score += 10 + this.progressShop.pointBonus();
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
    this.cancelShopAutoBuy();
    this.defeatShop = true;
    this.hud.hideKeys();
    this.closeSettings();
    this.music.stop();
    // Остальные звуки боя здесь уже не нужны. Взрыв базы этот вызов не обрывает.
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
    this.combat.setIonCooldown(saved.ionCooldownMs);
    this.combat.setWallCooldown(saved.wallCooldownMs);
    this.combat.setBomberCooldown(saved.bomberCooldownMs);
    this.combat.setEmpCooldown(saved.empCooldownMs);
    this.combat.setFlameCooldown(saved.flameCooldownMs);
    this.combat.restoreMines(saved.plantedMines);
    this.combat.restoreFlameWall(saved.flameWall);
    this.registry.set(ENEMY_HASTE.key, saved.haste);
    this.hud.setHaste(saved.haste);
    if (saved.phase === 'shop') {
      this.waves.resumeShop(saved.wave);
      this.shop.open();
      this.armShopAutoBuy();
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
      ionCooldownMs: Math.round(this.combat.ionCooldown),
      wallCooldownMs: Math.round(this.combat.wallCooldown),
      bomberCooldownMs: Math.round(this.combat.bomberCooldown),
      empCooldownMs: Math.round(this.combat.empCooldown),
      flameCooldownMs: Math.round(this.combat.flameCooldown),
      flameWall: this.combat.captureFlameWall(),
      plantedMines: this.combat.captureMines(),
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
