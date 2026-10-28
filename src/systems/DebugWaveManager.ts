// Дебаг-волны. N убивает живых и сразу открывает следующую, без магазина.
// A добавляет в текущую волну ещё одного обычного юнита того же вида.
// Поле размера эту добавку не держит: потолок волны — 50, босс остаётся один.
// Пока баннер висит, поле ещё меняет длину очереди. Уже поставленные сверх неё остаются.
// Сцена этот класс не знает: фабрика подставляет его вместо WaveManager.
// Другая клавиша или другой момент пропуска меняются здесь.

import Phaser from 'phaser';
import { DebugEnemyFactory } from '../entities/DebugEnemyFactory';
import type { EnemySave } from '../types/EnemySave';
import type { EnemyWaves } from '../types/EnemyWaves';
import type { WaveUnit } from '../types/WaveUnit';
import { WaveManager } from './WaveManager';

export class DebugWaveManager extends WaveManager {
  private skipKey?: Phaser.Input.Keyboard.Key;
  private addKey?: Phaser.Input.Keyboard.Key;
  // true от объявления волны до первого назначения выходов.
  // В этот промежуток поле настроек меняет фабрику, а счётчик выхода ещё помнит старое число.
  private announced = false;
  // Сколько юнитов очередь выпустит, когда баннер уже снят.
  // Дальше поле настроек это число не двигает.
  private locked = 0;
  // Юниты с клавиши A. В размер волны входят и после гибели: потолок считает состав, не живых.
  private extra = 0;

  constructor(
    private readonly roster: EnemyWaves,
    game: { width: number },
  ) {
    super(roster, game);
  }

  protected override onBound(scene: Phaser.Scene): void {
    const keyboard = scene.input.keyboard;
    this.skipKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.addKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  }

  override tick(): void {
    if (this.skipKey !== undefined && Phaser.Input.Keyboard.JustDown(this.skipKey)) {
      this.skipToNext();
    }
    if (this.addKey !== undefined && Phaser.Input.Keyboard.JustDown(this.addKey)) {
      this.addRegular();
    }
    super.tick();
  }

  // Тот же вид, что у текущей волны. Босс, магазин и поражение клавишу не слушают.
  // Поле «обычных в волне» здесь не читается: тройка в настройках не мешает выпустить четвёртого.
  private addRegular(): void {
    if (this.isGameOver() || this.wave < 1 || this.awaitingClear) {
      return;
    }
    if (this.roster.isBossWave(this.wave)) {
      return;
    }
    if (this.waveSize() >= DebugEnemyFactory.regularMax) {
      return;
    }
    this.extra += 1;
    this.spawnInfantry();
  }

  // Пока баннер висит, база — живое число из поля. После выхода база заперта в locked.
  private waveSize(): number {
    const queued = this.announced ? this.roster.count(this.wave) : this.locked;
    return queued + this.extra;
  }

  // Живые умирают, ещё не вышедшие не появляются. Магазин не открывается.
  // Волна 0 и уже открытый магазин не пропускаются — там нечего зачищать.
  private skipToNext(): void {
    if (this.isGameOver() || this.wave < 1 || this.awaitingClear) {
      return;
    }
    // Старый таймер выхода молча сгорает: штамп волны уже другой.
    this.spawnStamp += 1;
    this.slayLiving();
    this.clearShots();
    this.beginNextWave();
  }

  // hp в ноль, чтобы остался труп, а не уход «дошёл до стены».
  private slayLiving(): void {
    for (const unit of this.infantry.getChildren() as WaveUnit[]) {
      if (!unit.active || unit.reachedWall) {
        continue;
      }
      unit.hp = 0;
      unit.kill();
    }
  }

  // Пули и ракеты уже в полёте. Иначе они добьют базу на баннере следующей волны.
  private clearShots(): void {
    for (const shot of [...this.enemyShots.getChildren()]) {
      shot.destroy();
    }
  }

  override reset(): void {
    this.announced = false;
    this.locked = 0;
    this.extra = 0;
    super.reset();
  }

  override beginNextWave(): void {
    this.announced = true;
    this.locked = 0;
    this.extra = 0;
    super.beginNextWave();
  }

  // Загрузка на баннере: никто ещё не вышел, поле снова может сменить длину.
  override resumeCombat(wave: number, spawned: number, enemies: EnemySave[]): void {
    this.extra = 0;
    this.announced = spawned === 0 && enemies.length === 0;
    super.resumeCombat(wave, spawned, enemies);
    if (this.announced) {
      this.locked = 0;
      return;
    }
    // Уже стоящие и ещё не вышедшие держат потолок. Поле настроек после загрузки его не сужает.
    this.locked = Math.min(
      DebugEnemyFactory.regularMax,
      this.remainingToSpawn + enemies.length,
    );
  }

  override capture(): ReturnType<WaveManager['capture']> {
    this.pullCount();
    return super.capture();
  }

  // База читает фабрику второй раз, когда назначает выходы. Сначала подтягиваем счётчик,
  // иначе короткая волна не кончится, а длинная закроется раньше последних врагов.
  protected override onRelease(startIndex: number): void {
    if (startIndex === 0) {
      this.pullCount();
      this.locked = this.remainingToSpawn;
    }
    this.announced = false;
  }

  // Очередь ужимается, если юниты с клавиши A уже заняли часть потолка.
  // Само поле при этом не меняется: следующая волна снова читает его как есть.
  private pullCount(): void {
    if (!this.announced) {
      return;
    }
    const room = DebugEnemyFactory.regularMax - this.extra;
    const wanted = this.roster.count(this.wave);
    this.remainingToSpawn = Math.min(wanted, Math.max(0, room));
  }
}
