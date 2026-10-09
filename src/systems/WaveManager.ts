// Волны врагов: объявление, спавн и переход в магазин после зачистки.
// Сцена создаёт один WaveManager и каждый кадр зовёт tick().
// Сам менеджер врагов не двигает: он только ставит их на поле и следит, жив ли ещё кто-то.

import Phaser from 'phaser';
import { EnemyFactory } from '../entities/EnemyFactory';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import type { GameHud } from '../ui/GameHud';
import type { EnemySave, WavePhase } from './RunSave';

export class WaveManager {
  // Номер текущей волны. 0 — бой ещё не начался, сохранять такую партию нечего.
  wave = 0;
  // Сколько врагов из списка ещё не вышло. 0 значит, что спавн этой волны закончен.
  remainingToSpawn = 0;
  // true между волнами: отряд уже зачищен, магазин открыт или вот-вот откроется.
  // tick в этом состоянии зачистку второй раз не объявляет.
  awaitingClear = true;

  constructor(
    private readonly scene: Phaser.Scene,
    // Группа, в которую add() кладёт вышедшего врага. По ней же считаются живые.
    private readonly infantry: Phaser.Physics.Arcade.Group,
    // Та же группа, что у стрелков: сюда они складывают пули.
    private readonly enemyShots: Phaser.Physics.Arcade.Group,
    private readonly hud: GameHud,
    // Поражение обрывает отложенные выходы. Иначе враг появится уже на экране «БАЗА РАЗБИТА».
    private readonly isGameOver: () => boolean,
    // Сцена открывает магазин. Сам менеджер про покупки не знает.
    private readonly onWaveCleared: () => void,
    // Запись партии: после старта волны, после зачистки и по ходу спавна её зовёт сцена отдельно.
    private readonly onProgress: () => void,
  ) {}

  // Снимок для RunSave. null — волна ещё не началась.
  // В магазине список врагов пустой: они уже уничтожены, а номер волны сохраняется как есть.
  capture(): { wave: number; phase: WavePhase; spawned: number; enemies: EnemySave[] } | null {
    if (this.wave < 1) {
      return null;
    }
    if (this.awaitingClear) {
      return { wave: this.wave, phase: 'shop', spawned: 0, enemies: [] };
    }
    const total = EnemyFactory.count(this.wave);
    const enemies: EnemySave[] = [];
    for (const unit of this.infantry.getChildren() as Infantry[]) {
      // reachedWall — уже дошёл до базы или убит и доигрывает смерть. В сохранение он не входит.
      if (!unit.active || unit.reachedWall) {
        continue;
      }
      const kind = EnemyFactory.kindOf(unit);
      if (!kind) {
        continue;
      }
      enemies.push({
        kind,
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        pace: unit.paceRank,
      });
    }
    return {
      wave: this.wave,
      phase: 'combat',
      // Сколько мест в списке уже занято вышедшими. Ещё не вышедшие доспавнятся после загрузки.
      spawned: Math.max(0, total - this.remainingToSpawn),
      enemies,
    };
  }

  // Волна уже зачищена, магазин ещё открыт. Номер не увеличиваем: «дальше» само вызовет следующую.
  resumeShop(wave: number): void {
    this.wave = wave;
    this.remainingToSpawn = 0;
    this.awaitingClear = true;
    this.hud.setWave(wave);
  }

  // Середина волны: живые враги встают на сохранённые места, ещё не вышедшие доспавниваются.
  resumeCombat(wave: number, spawned: number, enemies: EnemySave[]): void {
    this.wave = wave;
    this.awaitingClear = false;
    this.hud.setWave(wave);
    for (const enemy of enemies) {
      this.restoreEnemy(enemy);
    }
    const total = EnemyFactory.count(wave);
    // Берём большее из двух чисел: запись «сколько вышло» и сколько реально положили на поле.
    // Так дыра в сохранении не заставит фабрику выпустить лишнюю копию.
    const already = Math.min(total, Math.max(spawned, enemies.length));
    this.remainingToSpawn = total - already;
    if (already === 0) {
      // Волна записана, но никто ещё не вышел: снова показываем баннер и ждём announceMs.
      this.hud.showWaveBanner(wave, EnemyFactory.isBossWave(wave));
      this.scene.time.delayedCall(EnemyFactory.timing.announceMs, () => {
        if (this.isGameOver()) {
          return;
        }
        this.releaseFrom(0);
      });
      return;
    }
    // Баннер не повторяем: игрок уже видел эту волну до перезагрузки.
    this.releaseFrom(already);
  }

  // Новая партия с нуля. Номер 0, первая волна ещё впереди.
  reset(): void {
    this.wave = 0;
    this.remainingToSpawn = 0;
    this.awaitingClear = true;
  }

  // Старт новой партии. delayedCall живёт в таймерах сцены и переживает кадры, пока не сработает.
  scheduleFirstWave(): void {
    this.scene.time.delayedCall(EnemyFactory.timing.startDelayMs, () => this.beginNextWave());
  }

  beginNextWave(): void {
    if (this.isGameOver()) {
      return;
    }

    this.wave += 1;
    this.awaitingClear = false;
    // Длина списка на этот номер. Босс-волна даёт 1.
    this.remainingToSpawn = EnemyFactory.count(this.wave);
    this.hud.setWave(this.wave);
    this.hud.showWaveBanner(this.wave, EnemyFactory.isBossWave(this.wave));

    // Пишем волну сразу, до выхода врагов. Закрытие вкладки на баннере не откатит номер.
    this.onProgress();
    this.scene.time.delayedCall(EnemyFactory.timing.announceMs, () => {
      if (this.isGameOver()) {
        return;
      }
      this.releaseWave();
    });
  }

  // Конец волны: спавн закончен и на поле не осталось тех, кто ещё дерётся.
  // reachedWall в livingInfantryCount не считается: труп и дошедший до базы волну не держат.
  tick(): void {
    if (this.isGameOver() || this.awaitingClear || this.remainingToSpawn > 0) {
      return;
    }
    if (this.livingInfantryCount() > 0) {
      return;
    }
    this.awaitingClear = true;
    this.onWaveCleared();
    this.onProgress();
  }

  private releaseWave(): void {
    this.releaseFrom(0);
  }

  private releaseFrom(startIndex: number): void {
    const total = EnemyFactory.count(this.wave);
    // 28 мс короче за каждую волну после первой, но не ниже minGap.
    const gap = Math.max(
      EnemyFactory.timing.minGap,
      EnemyFactory.timing.spawnGap - (this.wave - 1) * 28,
    );

    for (let i = startIndex; i < total; i += 1) {
      // (i - startIndex) — очередь среди тех, кто ещё не вышел. После загрузки она снова с нуля.
      this.scene.time.delayedCall((i - startIndex) * gap, () => {
        if (this.isGameOver()) {
          return;
        }
        this.spawnInfantry(i);
        this.remainingToSpawn = Math.max(0, this.remainingToSpawn - 1);
      });
    }
  }

  private restoreEnemy(enemy: EnemySave): void {
    const unit = EnemyFactory.restore(
      enemy.kind,
      {
        scene: this.scene,
        x: enemy.x,
        y: enemy.y,
        wave: this.wave,
        shots: this.enemyShots,
        fireTarget: Tank.aimPoint(),
      },
      enemy.hp,
      enemy.pace,
    );
    this.infantry.add(unit);
    // march включает скорость. Без него спрайт стоит в точке появления.
    unit.march();
  }

  private spawnInfantry(index = 0): void {
    if (this.isGameOver()) {
      return;
    }

    // Шесть горизонтальных дорожек. Случайный сдвиг ±16 px, чтобы строй не был линейкой.
    const lanes = [176, 248, 320, 392, 464, 536];
    const y = lanes[Phaser.Math.Between(0, lanes.length - 1)] + Phaser.Math.Between(-16, 16);
    // Правее края экрана: враг въезжает в кадр, а не появляется уже на поле.
    const x = GAME.width + 24 + Phaser.Math.Between(0, 70);
    // index — место в списке волны. Фабрика по нему выбирает вид и здоровье.
    // aimPoint — точка на танке, в которую целятся стрелки.
    const unit = EnemyFactory.create(index, {
      scene: this.scene,
      x,
      y,
      wave: this.wave,
      shots: this.enemyShots,
      fireTarget: Tank.aimPoint(),
    });
    this.infantry.add(unit);
    unit.march();
  }

  // Живые бойцы. active === false — спрайт уже уничтожен. reachedWall — выбыл из волны.
  private livingInfantryCount(): number {
    return (this.infantry.getChildren() as Infantry[]).filter(
      (unit) => unit.active && !unit.reachedWall,
    ).length;
  }
}
