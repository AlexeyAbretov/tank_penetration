// Счёт, полоска HP, баннер волны и окно клавиш. Плашка поражения — магазин между проигрышами.

import Phaser from 'phaser';

// Размер холста и линия баннера. Сцена передаёт их сама, HUD не читает gameConfig.
export type HudFrame = {
  width: number;
  height: number;
  bannerY: number;
};

// Иконка способности. Картинка и перезарядка приходят от сущности, подпись — от сцены.
export type HudAbility = {
  id: string;
  texture: string;
  keyLabel: string;
  hint: string;
  cooldownMs: number;
  iconRadius: number;
};

// Иконка покупки над баннером: картинка, затемнение перезарядки и цифра секунд.
type AbilityIcon = {
  id: string;
  root: Phaser.GameObjects.Container;
  sweep: Phaser.GameObjects.Graphics;
  time: Phaser.GameObjects.Text;
  owned: boolean;
  hint: string;
  cooldownMs: number;
  iconRadius: number;
  request?: () => void;
};

export class GameHud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly tankStatsText: Phaser.GameObjects.Text;
  private readonly banner: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hpFrame: Phaser.GameObjects.Image;
  private readonly hpTrack: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly waveBanner: Phaser.GameObjects.Text;
  private readonly keysButton: Phaser.GameObjects.Rectangle;
  private readonly keysMark: Phaser.GameObjects.Text;
  private readonly keysDim: Phaser.GameObjects.Rectangle;
  private readonly keysOverlay: Phaser.GameObjects.Container;
  private readonly keysPanel: Phaser.GameObjects.Rectangle;
  private readonly keysClose: Phaser.GameObjects.Container;
  private readonly keysTitle: Phaser.GameObjects.Text;
  private readonly keysRule: Phaser.GameObjects.Graphics;
  private keyRows: Phaser.GameObjects.Text[] = [];
  private readonly abilities: AbilityIcon[];
  private readonly hastePlate: Phaser.GameObjects.Rectangle;
  private readonly hasteIcon: Phaser.GameObjects.Graphics;
  private readonly pausePlate: Phaser.GameObjects.Rectangle;
  private readonly pauseLeft: Phaser.GameObjects.Rectangle;
  private readonly pauseRight: Phaser.GameObjects.Rectangle;
  private readonly settingsPlate: Phaser.GameObjects.Rectangle;
  private readonly settingsGear: Phaser.GameObjects.Graphics;
  private readonly autoFirePlate: Phaser.GameObjects.Rectangle;
  private readonly autoFireIcon: Phaser.GameObjects.Graphics;
  private readonly pauseOverlay: Phaser.GameObjects.Container;
  private readonly pauseDim: Phaser.GameObjects.Rectangle;
  protected readonly frame: HudFrame;
  private maxHp: number;
  private hasteCycle?: () => void;
  private pauseRequest?: () => void;
  private settingsRequest?: () => void;
  private autoFireRequest?: () => void;
  private newGameRequest?: () => void;

  protected readonly statusY = 28;
  // Ряд плашек у полоски HP. Дебаг ставит свою левее автострельбы тем же шагом.
  protected readonly plateSize = 40;
  protected readonly plateGap = 6;
  protected readonly plateY = 28;
  protected autoFireX = 0;
  protected readonly statusStyle = {
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '18px',
    stroke: '#2a0a08',
    strokeThickness: 4,
  };

  constructor(scene: Phaser.Scene, frame: HudFrame, maxHp: number, abilities: readonly HudAbility[]) {
    this.frame = frame;
    this.maxHp = maxHp;

    this.banner = scene.add.image(frame.width / 2, 677, 'banner').setDepth(50);

    // Центр ленты. Список клавиш открывается кнопкой справа, на самой ленте его больше нет.
    this.title = scene.add
      .text(frame.width / 2, 677, 'TANK', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '32px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(51);

    this.scoreText = scene.add
      .text(28, this.statusY, 'SCORE  0', { ...this.statusStyle, color: '#f3d56a' })
      .setOrigin(0, 0.5)
      .setDepth(51);
    this.waveText = scene.add
      .text(0, this.statusY, 'WAVE  0', { ...this.statusStyle, color: '#e8c48a' })
      .setOrigin(0, 0.5)
      .setDepth(51);
    this.coinsText = scene.add
      .text(0, this.statusY, 'COINS  0', { ...this.statusStyle, color: '#f3d56a' })
      .setOrigin(0, 0.5)
      .setDepth(51);
    this.layoutStatus();

    this.tankStatsText = scene.add
      .text(28, 56, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#e8c48a',
        stroke: '#2a0a08',
        strokeThickness: 3,
        lineSpacing: 4,
      })
      .setDepth(51);

    this.waveBanner = scene.add
      .text(frame.width / 2, 120, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '56px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);

    // Рамка HP стоит в 152 px от правого края. Иконки — сразу слева от неё.
    const icon = this.plateSize;
    const hpLeft = 1128 - 140;
    const hasteX = hpLeft - 8 - icon / 2;
    const pauseX = hasteX - this.plateGap - icon;
    const settingsX = pauseX - this.plateGap - icon;
    this.autoFireX = settingsX - this.plateGap - icon;
    const iconY = this.plateY;

    this.hastePlate = scene.add
      .rectangle(hasteX, iconY, icon, icon, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(53)
      .setInteractive({ useHandCursor: true });
    this.hasteIcon = scene.add.graphics().setPosition(hasteX, iconY).setDepth(54);
    this.drawSpeedometer(1);
    this.hastePlate.on('pointerup', () => this.hasteCycle?.());

    this.pausePlate = scene.add
      .rectangle(pauseX, iconY, icon, icon, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(53)
      .setInteractive({ useHandCursor: true });
    // Обычные прямоугольники, не Graphics: скруглённая заливка узкой полоски
    // сдвигает её низ в сторону.
    this.pauseLeft = scene.add.rectangle(pauseX - 4, iconY, 4, 16, 0xf0d56a).setDepth(54);
    this.pauseRight = scene.add.rectangle(pauseX + 4, iconY, 4, 16, 0xf0d56a).setDepth(54);
    this.pausePlate.on('pointerup', () => {
      this.setKeysOpen(false);
      this.pauseRequest?.();
    });

    // Выше магазина (глубина 70), но ниже окна настроек (88), паузы (90) и экрана поражения (85).
    // Иначе шестерёнка и кнопка автострельбы пропадают под затемнением между волнами.
    this.settingsPlate = scene.add
      .rectangle(settingsX, iconY, icon, icon, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(80)
      .setInteractive({ useHandCursor: true });
    this.settingsGear = scene.add.graphics().setPosition(settingsX, iconY).setDepth(81);
    this.drawGear(this.settingsGear);
    this.settingsPlate.on('pointerup', () => {
      this.setKeysOpen(false);
      this.settingsRequest?.();
    });

    // Пока автострельба не куплена, плашка не ловит клики: иначе пустое место гасило бы выстрел.
    this.autoFirePlate = scene.add
      .rectangle(this.autoFireX, iconY, icon, icon, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(80)
      .setVisible(false);
    this.autoFireIcon = scene.add.graphics().setPosition(this.autoFireX, iconY).setDepth(81).setVisible(false);
    this.drawAutoFire(false);
    this.autoFirePlate.on('pointerup', () => this.autoFireRequest?.());

    // Один ряд над баннером, слева направо в том порядке, в каком пришёл список.
    this.abilities = abilities.map((spec, index) => this.makeAbility(scene, index, spec));

    // Справа на ленте, внутри золотой рамки. Заливка чуть прозрачная: красное поле под кнопкой остаётся видно.
    const keysX = frame.width - 56;
    const keysY = 677;
    this.keysButton = scene.add
      .rectangle(keysX, keysY, 40, 40, 0x3a0c0c, 0.72)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(80)
      .setInteractive({ useHandCursor: true });
    this.keysMark = scene.add
      .text(keysX, keysY, '?', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '24px',
        color: '#f3d56a',
      })
      .setOrigin(0.5)
      .setDepth(81);
    this.keysButton.on('pointerup', () => {
      if (!this.keysOverlay.visible) {
        this.setKeysOpen(true);
      }
    });

    // Выше ленты и магазина (70), ниже поражения (85), настроек (88) и паузы (90).
    // Затемнение слабое: окно само полупрозрачное, поле за ним должно остаться узнаваемым.
    this.keysDim = scene.add.rectangle(0, 0, frame.width, frame.height, 0x000000, 0.28).setInteractive();
    this.keysPanel = scene.add.rectangle(0, 0, 540, 320, 0x3a0c0c, 0.78).setStrokeStyle(3, 0xc9a227);
    this.keysPanel.setInteractive();
    this.keysClose = this.makeKeysClose(scene);
    this.keysTitle = scene.add
      .text(0, 0, 'КЛАВИШИ', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '32px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.keysRule = scene.add.graphics();
    this.keysOverlay = scene.add
      .container(frame.width / 2, frame.height / 2, [
        this.keysDim,
        this.keysPanel,
        this.keysTitle,
        this.keysRule,
        this.keysClose,
      ])
      .setDepth(82)
      .setVisible(false);
    this.layoutKeys();

    this.hpFrame = scene.add.image(1128, 28, 'hp-frame').setDepth(51);
    this.hpTrack = scene.add.rectangle(1018, 28, 236, 10, 0x2a0a0a).setOrigin(0, 0.5).setDepth(51);
    this.hpFill = scene.add.rectangle(1018, 28, 236, 10, 0xd42a2a).setOrigin(0, 0.5).setDepth(52);

    this.pauseOverlay = scene.add.container(frame.width / 2, frame.height / 2).setDepth(90).setVisible(false);
    this.pauseDim = scene.add.rectangle(0, 0, frame.width, frame.height, 0x000000, 0.45).setInteractive();
    const pauseTitle = scene.add
      .text(0, -70, 'ПАУЗА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const pauseHint = scene.add
      .text(0, -8, 'Esc, чтобы продолжить', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);
    const fresh = scene.add.container(0, 78);
    const freshBg = scene.add.rectangle(0, 0, 300, 52, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    const freshLabel = scene.add
      .text(0, 0, 'НОВАЯ ИГРА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    fresh.add([freshBg, freshLabel]);
    fresh.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-150, -26, 300, 52),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    fresh.on('pointerup', () => this.newGameRequest?.());
    this.pauseOverlay.add([this.pauseDim, pauseTitle, pauseHint, fresh]);
    this.placeHud();
  }

  // Широкое окно сдвигает правый край. Полоска, кнопки и затемнения едут за ним.
  layout(): void {
    this.placeHud();
  }

  private placeHud(): void {
    const width = this.frame.width;
    const height = this.frame.height;
    const icon = this.plateSize;
    const hpCenter = width - 152;
    const barLeft = hpCenter - 110;
    const hpLeft = hpCenter - 140;
    const hasteX = hpLeft - 8 - icon / 2;
    const pauseX = hasteX - this.plateGap - icon;
    const settingsX = pauseX - this.plateGap - icon;
    this.autoFireX = settingsX - this.plateGap - icon;
    const y = this.plateY;

    this.banner.setPosition(width / 2, 677).setDisplaySize(width, 86);
    this.title.setX(width / 2);
    this.waveBanner.setX(width / 2);

    this.hastePlate.setPosition(hasteX, y);
    this.hasteIcon.setPosition(hasteX, y);
    this.pausePlate.setPosition(pauseX, y);
    this.pauseLeft.setPosition(pauseX - 4, y);
    this.pauseRight.setPosition(pauseX + 4, y);
    this.settingsPlate.setPosition(settingsX, y);
    this.settingsGear.setPosition(settingsX, y);
    this.autoFirePlate.setPosition(this.autoFireX, y);
    this.autoFireIcon.setPosition(this.autoFireX, y);

    this.hpFrame.setPosition(hpCenter, 28);
    this.hpTrack.setPosition(barLeft, 28);
    this.hpFill.setPosition(barLeft, 28);

    const keysX = width - 56;
    this.keysButton.setPosition(keysX, 677);
    this.keysMark.setPosition(keysX, 677);

    this.keysDim.setSize(width, height);
    this.keysOverlay.setPosition(width / 2, height / 2);
    this.pauseDim.setSize(width, height);
    this.pauseOverlay.setPosition(width / 2, height / 2);
  }

  setScore(score: number): void {
    this.scoreText.setText(`SCORE  ${score}`);
    this.layoutStatus();
  }

  setWave(wave: number): void {
    this.waveText.setText(`WAVE  ${wave}`);
    this.layoutStatus();
  }

  setCoins(coins: number): void {
    this.coinsText.setText(`COINS  ${coins}`);
    this.layoutStatus();
  }

  private layoutStatus(): void {
    const gap = 32;
    this.waveText.setX(this.scoreText.x + this.scoreText.width + gap);
    this.coinsText.setX(this.waveText.x + this.waveText.width + gap);
  }

  setTankStats(
    damage: number,
    blastRadius: number,
    fireDelayMs: number,
    autoFire = false,
    coinBonus = 0,
  ): void {
    const fireSec = (fireDelayMs / 1000).toFixed(2);
    const mode = autoFire ? 'авто' : 'ЛКМ';
    const coins = coinBonus > 0 ? `   МОНЕТЫ +${coinBonus}` : '';
    this.tankStatsText.setText(
      `УРОН  ${damage}   ВЗРЫВ  ${blastRadius}   ОГОНЬ  ${fireSec} с${coins}   ${mode}`,
    );
  }

  onHasteCycle(cycle: () => void): void {
    this.hasteCycle = cycle;
  }

  onPause(request: () => void): void {
    this.pauseRequest = request;
  }

  onSettings(request: () => void): void {
    this.settingsRequest = request;
  }

  onAutoFire(request: () => void): void {
    this.autoFireRequest = request;
  }

  onAbility(id: string, request: () => void): void {
    const icon = this.ability(id);
    if (icon) {
      icon.request = request;
    }
  }

  // Кнопка появляется после покупки. Красная плашка — режим включён, тёмная — выключен.
  setAutoFireToggle(owned: boolean, enabled: boolean): void {
    this.autoFirePlate.setVisible(owned);
    this.autoFireIcon.setVisible(owned);
    if (!owned) {
      if (this.autoFirePlate.input?.enabled) {
        this.autoFirePlate.disableInteractive();
      }
      return;
    }
    if (!this.autoFirePlate.input?.enabled) {
      this.autoFirePlate.setInteractive({ useHandCursor: true });
    }
    this.autoFirePlate.setFillStyle(enabled ? 0x8a1810 : 0x3a0c0c);
    this.drawAutoFire(enabled);
  }

  onNewGame(request: () => void): void {
    this.newGameRequest = request;
  }

  setPaused(paused: boolean): void {
    this.pauseOverlay.setVisible(paused);
    if (paused) {
      this.setKeysOpen(false);
    }
  }

  // Экран поражения лежит выше списка. Пока окно открыто, его затемнение перехватывало бы клики магазина.
  hideKeys(): void {
    this.setKeysOpen(false);
  }

  setHaste(multiplier: number): void {
    this.hastePlate.setFillStyle(multiplier > 1 ? 0x8a1810 : 0x3a0c0c);
    this.drawSpeedometer(multiplier);
  }

  // Три дуги разного цвета. Короткая светлая стрелка не сливается со средней в букву Т.
  private drawSpeedometer(level: number): void {
    const g = this.hasteIcon;
    g.clear();
    const cy = 5;
    const radius = 12;
    const gap = 0.22;
    const span = Math.PI;
    const seg = (span - gap * 2) / 3;
    const start = Math.PI;
    const step = Phaser.Math.Clamp(Math.round(level), 1, 3);
    const colors = [0x6ecf4a, 0xf0c14a, 0xe24a3a];
    const dim = [0x2c4a1c, 0x5a4320, 0x5a221c];

    g.lineStyle(1.5, 0x4a3018, 1);
    g.beginPath();
    g.arc(0, cy, radius + 3, start, start + span, false);
    g.strokePath();

    for (let i = 0; i < 3; i += 1) {
      const a0 = start + i * (seg + gap);
      const a1 = a0 + seg;
      g.lineStyle(4, i < step ? colors[i] : dim[i], 1);
      g.beginPath();
      g.arc(0, cy, radius, a0, a1, false);
      g.strokePath();
    }

    const mid = start + (step - 1) * (seg + gap) + seg / 2;
    const tip = 8;
    const ux = Math.cos(mid);
    const uy = Math.sin(mid);
    g.lineStyle(2, 0xfff8ee, 1);
    g.beginPath();
    g.moveTo(ux * 1.5, cy + uy * 1.5);
    g.lineTo(ux * tip, cy + uy * tip);
    g.strokePath();
  }

  // Клик по кнопке списка и по открытому окну не должен быть выстрелом танка.
  coversKeys(pointer: Phaser.Input.Pointer): boolean {
    if (this.keysOverlay.visible) {
      return true;
    }
    return this.keysButton.getBounds().contains(pointer.worldX, pointer.worldY);
  }

  // Клик по плашке темпа не должен быть выстрелом танка.
  coversHaste(pointer: Phaser.Input.Pointer): boolean {
    return this.hastePlate.getBounds().contains(pointer.worldX, pointer.worldY);
  }

  // Клик по кнопке паузы не должен быть выстрелом танка.
  coversPause(pointer: Phaser.Input.Pointer): boolean {
    return this.pausePlate.getBounds().contains(pointer.worldX, pointer.worldY);
  }

  // Клик по шестерёнке не должен быть выстрелом танка.
  coversSettings(pointer: Phaser.Input.Pointer): boolean {
    return this.settingsPlate.getBounds().contains(pointer.worldX, pointer.worldY);
  }

  // Скрытая кнопка не занимает место: до покупки курсор над ней всё ещё стреляет.
  coversAutoFire(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.autoFirePlate.visible && this.autoFirePlate.getBounds().contains(pointer.worldX, pointer.worldY)
    );
  }

  // В обычной партии плашки нет. Дебаг перекрывает клик своей кнопкой урона.
  coversEnemyDamage(_pointer: Phaser.Input.Pointer): boolean {
    return false;
  }

  // Та же плашка, на один шаг левее. Дебаг ставит так выключатель урона.
  protected plateLeftOf(x: number): number {
    return x - this.plateGap - this.plateSize;
  }

  // Скрытая иконка не занимает место: до покупки курсор над ней всё ещё стреляет.
  coversAbility(pointer: Phaser.Input.Pointer): boolean {
    return this.abilities.some(
      (icon) => icon.root.visible && icon.root.getBounds().contains(pointer.worldX, pointer.worldY),
    );
  }

  setAbility(id: string, owned: boolean, cooldownMs: number): void {
    const icon = this.ability(id);
    if (icon) {
      this.paintAbility(icon, owned, cooldownMs);
    }
  }

  setMaxHp(maxHp: number): void {
    this.maxHp = maxHp;
  }

  setHp(hp: number): void {
    this.hpFill.width = 236 * (hp / this.maxHp);
  }

  showWaveBanner(wave: number, boss = false): void {
    const scene = this.waveBanner.scene;
    this.waveBanner.setText(boss ? 'БОСС' : `ВОЛНА ${wave}`);
    this.waveBanner.setColor(boss ? '#ff5a48' : '#f3d56a');
    this.waveBanner.setAlpha(1);
    this.waveBanner.setScale(0.86);
    scene.tweens.killTweensOf(this.waveBanner);
    scene.tweens.add({
      targets: this.waveBanner,
      scale: 1.08,
      duration: 280,
      ease: 'Back.Out',
    });
    scene.tweens.add({
      targets: this.waveBanner,
      alpha: 0,
      duration: 500,
      delay: 900,
    });
  }

  private syncControls(): void {
    this.layoutKeys();
  }

  // Строки окна. Купленная способность дописывает свою, пока её нет — в списке её нет.
  protected controlHints(): readonly string[] {
    const hints = ['мышь — прицел', 'ЛКМ — огонь', '+ — темп', 'Esc — пауза', 'шестерёнка — звук'];
    for (const icon of this.abilities) {
      if (icon.owned) {
        hints.push(icon.hint);
      }
    }
    return hints;
  }

  private setKeysOpen(open: boolean): void {
    if (open) {
      this.layoutKeys();
    }
    this.keysOverlay.setVisible(open);
  }

  // Высота карточки растёт вместе со списком: у дебага и купленных способностей строк больше.
  private layoutKeys(): void {
    for (const row of this.keyRows) {
      row.destroy();
    }
    this.keyRows = [];

    const hints = this.controlHints();
    const rowH = 34;
    const titleBand = 68;
    const padBottom = 28;
    const w = 540;
    const h = titleBand + hints.length * rowH + padBottom;
    this.keysPanel.setSize(w, h);
    this.keysTitle.setY(-h / 2 + 34);
    this.keysClose.setPosition(w / 2 - 28, -h / 2 + 26);

    this.keysRule.clear();
    this.keysRule.lineStyle(2, 0xc9a227, 0.9);
    const ruleY = -h / 2 + 58;
    this.keysRule.beginPath();
    this.keysRule.moveTo(-w / 2 + 28, ruleY);
    this.keysRule.lineTo(w / 2 - 28, ruleY);
    this.keysRule.strokePath();

    const scene = this.keysTitle.scene;
    const keyX = -w / 2 + 40;
    const actionX = -w / 2 + 248;
    const firstY = -h / 2 + titleBand + rowH / 2;
    const keyStyle = {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#f3d56a',
      stroke: '#2a0a08',
      strokeThickness: 3,
    };
    const actionStyle = { ...keyStyle, color: '#f0dcc0' };

    hints.forEach((line, index) => {
      const parts = line.split(' — ');
      const key = parts[0] ?? line;
      const action = parts.length > 1 ? parts.slice(1).join(' — ') : '';
      const y = firstY + index * rowH;
      const keyText = scene.add.text(keyX, y, key, keyStyle).setOrigin(0, 0.5);
      const actionText = scene.add.text(actionX, y, action, actionStyle).setOrigin(0, 0.5);
      this.keysOverlay.add([keyText, actionText]);
      this.keyRows.push(keyText, actionText);
    });
  }

  // Крестик в правом верхнем углу карточки. Клик мимо окна её не закрывает.
  private makeKeysClose(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const hit = scene.add.rectangle(0, 0, 36, 36, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    const mark = scene.add
      .text(0, -1, '×', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '32px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    hit.on('pointerup', () => this.setKeysOpen(false));
    return scene.add.container(0, 0, [hit, mark]);
  }

  // Ряд над баннером, слева направо. index 0 — первая иконка у края поля.
  private makeAbility(scene: Phaser.Scene, index: number, spec: HudAbility): AbilityIcon {
    const glyph = scene.add.image(0, 0, spec.texture);
    const sweep = scene.add.graphics();
    const time = scene.add
      .text(0, 2, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const badge = scene.add.circle(20, 20, 10, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    const key = scene.add
      .text(20, 20, spec.keyLabel, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '14px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    const root = scene.add
      .container(56 + index * 88, this.frame.bannerY - 48, [glyph, sweep, time, badge, key])
      .setDepth(53)
      .setVisible(false);
    const icon: AbilityIcon = {
      id: spec.id,
      root,
      sweep,
      time,
      owned: false,
      hint: spec.hint,
      cooldownMs: spec.cooldownMs,
      iconRadius: spec.iconRadius,
    };
    root.on('pointerup', () => icon.request?.());
    return icon;
  }

  private ability(id: string): AbilityIcon | undefined {
    return this.abilities.find((icon) => icon.id === id);
  }

  private cooldownLabel(ms: number): string {
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) {
      return `${sec}`;
    }
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return `${min}:${rest.toString().padStart(2, '0')}`;
  }

  private paintAbility(icon: AbilityIcon, owned: boolean, cooldownMs: number): void {
    if (icon.owned !== owned) {
      icon.owned = owned;
      icon.root.setVisible(owned);
      this.syncControls();
      if (owned) {
        if (!icon.root.input?.enabled) {
          icon.root.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(-32, -32, 64, 64),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
          });
        }
      } else if (icon.root.input?.enabled) {
        icon.root.disableInteractive();
      }
    }
    if (!owned) {
      return;
    }

    const cooling = cooldownMs > 0;
    // Дольше минуты три цифры секунд не влезают в кружок, поэтому 3:00.
    const label = cooling ? this.cooldownLabel(cooldownMs) : '';
    if (icon.time.text !== label) {
      icon.time.setText(label);
    }

    icon.sweep.clear();
    if (!cooling) {
      return;
    }
    const ratio = Math.min(1, cooldownMs / icon.cooldownMs);
    const radius = icon.iconRadius - 4;
    icon.sweep.fillStyle(0x000000, 0.62);
    if (ratio > 0.98) {
      icon.sweep.fillCircle(0, 0, radius);
      return;
    }
    icon.sweep.slice(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
    icon.sweep.fillPath();
  }

  // Ствол справа и три трассы влево — очередь в сторону врагов. Тусклые, пока режим выключен.
  private drawAutoFire(on: boolean): void {
    const g = this.autoFireIcon;
    g.clear();
    const color = on ? 0xf0d56a : 0x6e5840;
    g.fillStyle(color, 1);
    g.fillRect(6, -8, 3, 16);
    const traces: ReadonlyArray<readonly [number, number]> = [
      [-7, 6],
      [0, 12],
      [7, 6],
    ];
    for (const [y, length] of traces) {
      g.fillRect(6 - length, y - 1, length, 2);
    }
  }

  // Сплошной обод и короткие зубцы. Лучи из центра читались как штурвал.
  // Дырку заливаем цветом плашки: у Graphics нет выреза в контуре.
  private drawGear(g: Phaser.GameObjects.Graphics): void {
    const teeth = 8;
    const outer = 13;
    const root = 9.2;
    const step = (Math.PI * 2) / teeth;
    g.fillStyle(0xf0d56a, 1);
    g.beginPath();
    let started = false;
    for (let i = 0; i < teeth; i += 1) {
      const mid = i * step - Math.PI / 2;
      const corners: ReadonlyArray<readonly [number, number]> = [
        [mid - step * 0.33, root],
        [mid - step * 0.14, outer],
        [mid + step * 0.14, outer],
        [mid + step * 0.33, root],
      ];
      for (const [angle, radius] of corners) {
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (!started) {
          g.moveTo(x, y);
          started = true;
        } else {
          g.lineTo(x, y);
        }
      }
    }
    g.closePath();
    g.fillPath();
    g.fillStyle(0x3a0c0c, 1);
    g.fillCircle(0, 0, 3.4);
    g.lineStyle(1.5, 0xf0d56a, 1);
    g.strokeCircle(0, 0, 3.4);
  }
}
