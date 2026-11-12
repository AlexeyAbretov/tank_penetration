// Дебаг-счёт. Между шестерёнкой и обычной паузой — тихая пауза, перезапуск волны, пропуск и проигрыш.
// Обычная партия этот класс не импортирует, и зазора под эти кнопки у неё нет.

import Phaser from 'phaser';

import { GameHud } from './GameHud';
import { HudFrame } from './GameHud.types';

import { EnemyDamageDebugAbilityIcon, EnemyDamageDebugAbility } from '../../abilities';
import {
  DEBUG_FORFEIT_EVENT,
  DEBUG_QUIET_PAUSE_EVENT,
  DEBUG_RESTART_WAVE_EVENT,
  DEBUG_SKIP_WAVE_EVENT,
} from '../../gameConfig';

// Тот же красный, что у надписи DEBUG. Золотые знаки остаются у обычных кнопок.
const debugMark = '#ff5a48';
const debugBar = 0xff5a48;

export class DebugGameHud extends GameHud {
  // Картинка урона врагов. Общий список её не грузит: обычная партия этот класс не импортирует.
  static override preload(scene: Phaser.Scene): void {
    super.preload(scene);

    EnemyDamageDebugAbilityIcon.preload(scene);
  }

  private readonly debugLabel: Phaser.GameObjects.Text;
  private readonly enemyDamageRoot: Phaser.GameObjects.Container;
  private readonly enemyDamageGlow: Phaser.GameObjects.Image;
  private readonly quietPlate: Phaser.GameObjects.Rectangle;
  private readonly quietFace: Phaser.GameObjects.Graphics;
  private readonly quietLeft: Phaser.GameObjects.Rectangle;
  private readonly quietRight: Phaser.GameObjects.Rectangle;
  private readonly restartPlate: Phaser.GameObjects.Rectangle;
  private readonly restartFace: Phaser.GameObjects.Graphics;
  private readonly restartMark: Phaser.GameObjects.Text;
  private readonly skipPlate: Phaser.GameObjects.Rectangle;
  private readonly skipFace: Phaser.GameObjects.Graphics;
  private readonly skipMark: Phaser.GameObjects.Text;
  private readonly losePlate: Phaser.GameObjects.Rectangle;
  private readonly loseFace: Phaser.GameObjects.Graphics;
  private readonly loseMark: Phaser.GameObjects.Text;

  // Дебаг-клавиши только в окне списка. Верхняя плашка остаётся статусом партии.
  protected override controlHints(): readonly string[] {
    return [
      ...super.controlHints(),
      'пробел — пауза без экрана',
      'двойное нажатие — сброс',
      'A — ещё юнит',
      'R — перезапуск волны',
      'N — пропуск волны',
      'F — проигрыш',
      'иконка слева — урон врагов',
    ];
  }

  // Четыре плашки. База сдвигает шестерёнку на это число и сама место не рисует.
  protected override platesBetweenSettingsAndPause(): number {
    return 4;
  }

  constructor(scene: Phaser.Scene, frame: HudFrame, maxHp: number) {
    super(scene, frame, maxHp);

    this.debugLabel = scene.add
      .text(frame.width / 2, this.statusY, 'DEBUG', {
        ...this.statusStyle,
        color: debugMark,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(51);

    // То же имя шлёт DebugQuietPause. Константа ради одной подписи не нужна.
    // Эмиттер сцены переживает перезапуск. Старая подпись после «новой игры»
    // пишет в уничтоженный текст: updateText падает, и requestAnimationFrame
    // больше не ставит следующий кадр — пробел паузу уже не снимает.
    const onQuietPause = (on: boolean): void => {
      if (!this.debugLabel.scene) {
        return;
      }
      this.debugLabel.setText(on ? 'DEBUG  ПАУЗА' : 'DEBUG');
    };

    scene.events.on('quiet-pause', onQuietPause);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off('quiet-pause', onQuietPause);
    });

    GameHud.nearest(scene, EnemyDamageDebugAbilityIcon.iconKey);
    const icon = this.bindRoundIcon(EnemyDamageDebugAbilityIcon.iconKey, this.rightSkillRoots().length, 53);
    
    this.enemyDamageRoot = icon.root;
    this.enemyDamageGlow = icon.glow;
    this.showRoundToggle(icon.root, icon.glow, true, EnemyDamageDebugAbility.isEnabled);

    icon.root.on('pointerup', () => {
      this.showRoundToggle(this.enemyDamageRoot, this.enemyDamageGlow, true, EnemyDamageDebugAbility.toggle());
    });

    // Выше магазина (70), ниже списка клавиш (82), настроек (88) и плашки паузы (90).
    // Иначе проигрыш не нажать, пока между волнами висит витрина.
    const quiet = this.addPlate(scene, () => scene.events.emit(DEBUG_QUIET_PAUSE_EVENT));
    this.quietPlate = quiet.plate;
    this.quietFace = quiet.face;
    // Полоски — прямоугольники, как у обычной паузы: узкая заливка Graphics съезжает.
    this.quietLeft = scene.add.rectangle(0, this.plateY, 4, 16, debugBar).setDepth(81);
    this.quietRight = scene.add.rectangle(0, this.plateY, 4, 16, debugBar).setDepth(81);

    const restart = this.addPlate(scene, () => scene.events.emit(DEBUG_RESTART_WAVE_EVENT));
    this.restartPlate = restart.plate;
    this.restartFace = restart.face;
    this.restartMark = this.addMark(scene, 'R');

    const skip = this.addPlate(scene, () => scene.events.emit(DEBUG_SKIP_WAVE_EVENT));
    this.skipPlate = skip.plate;
    this.skipFace = skip.face;
    this.skipMark = this.addMark(scene, 'N');

    const lose = this.addPlate(scene, () => scene.events.emit(DEBUG_FORFEIT_EVENT));
    this.losePlate = lose.plate;
    this.loseFace = lose.face;
    this.loseMark = this.addMark(scene, 'F');

    this.placeDebugRow();
  }

  override layout(): void {
    super.layout();

    this.placeDebugRow();
    this.enemyDamageRoot.setPosition(this.edgeIconX(this.rightSkillRoots().length), this.skillY());
    this.debugLabel.setX(this.frame.width / 2);
  }

  override coversEnemyDamage(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.enemyDamageRoot.visible &&
      this.enemyDamageRoot.getBounds().contains(pointer.worldX, pointer.worldY)
    );
  }

  override coversDebugPlates(pointer: Phaser.Input.Pointer): boolean {
    return [this.quietPlate, this.restartPlate, this.skipPlate, this.losePlate].some((plate) =>
      plate.getBounds().contains(pointer.worldX, pointer.worldY),
    );
  }

  // Слева направо от шестерёнки: тихая пауза, перезапуск, пропуск, проигрыш, затем обычная пауза.
  private placeDebugRow(): void {
    const y = this.plateY;
    this.placePlate(this.quietPlate, this.quietFace, this.plateXLeftOfPause(4), y);
    this.quietLeft.setPosition(this.quietPlate.x - 4, y);
    this.quietRight.setPosition(this.quietPlate.x + 4, y);
    this.placePlate(this.restartPlate, this.restartFace, this.plateXLeftOfPause(3), y);
    this.restartMark.setPosition(this.restartPlate.x, y);
    this.placePlate(this.skipPlate, this.skipFace, this.plateXLeftOfPause(2), y);
    this.skipMark.setPosition(this.skipPlate.x, y);
    this.placePlate(this.losePlate, this.loseFace, this.plateXLeftOfPause(1), y);
    this.loseMark.setPosition(this.losePlate.x, y);
  }

  private addPlate(scene: Phaser.Scene, fire: () => void): {
    plate: Phaser.GameObjects.Rectangle;
    face: Phaser.GameObjects.Graphics;
  } {
    const plate = scene.add
      .rectangle(0, this.plateY, this.plateSize, this.plateSize, 0x000000, 0)
      .setDepth(80)
      .setInteractive({ useHandCursor: true });
    const face = scene.add.graphics().setPosition(0, this.plateY).setDepth(80);
    this.drawMetalPlate(face);
    plate.on('pointerup', () => {
      this.hideKeys();
      fire();
    });
    return { plate, face };
  }

  private addMark(scene: Phaser.Scene, label: string): Phaser.GameObjects.Text {
    return scene.add
      .text(0, this.plateY, label, {
        fontSize: '20px',
        color: debugMark,
      })
      .setOrigin(0.5)
      .setDepth(81);
  }

  private placePlate(
    plate: Phaser.GameObjects.Rectangle,
    face: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
  ): void {
    plate.setPosition(x, y);
    face.setPosition(x, y);
  }
}
