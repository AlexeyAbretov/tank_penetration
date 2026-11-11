// Знаки глушения: звёзды над головой и молнии по корпусу.
// Бой только просит удержать. Какой знак рисовать, решает сам юнит.

import Phaser from 'phaser';

export type HoldMark = {
  follow(unit: Phaser.GameObjects.Sprite, delta: number): void;
  destroy(): void;
};

// Три искры крутятся над макушкой, пока пехота стоит.
export function stunMark(scene: Phaser.Scene): HoldMark {
  const g = scene.add.graphics().setDepth(20);
  let spin = 0;
  return {
    follow(unit, delta) {
      spin += delta / 220;
      const head = unit.y - unit.displayHeight * unit.originY - 8;
      g.setDepth(unit.depth + 2);
      g.clear();
      for (let i = 0; i < 3; i += 1) {
        const angle = spin + (i * Math.PI * 2) / 3;
        const x = unit.x + Math.cos(angle) * 14;
        const y = head + Math.sin(angle) * 5;
        g.fillStyle(0xffe28a, 1);
        g.fillCircle(x, y, 3.4);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x - 1, y - 1, 1.3);
      }
    },
    destroy() {
      g.destroy();
    },
  };
}

type Bolt = { points: Phaser.Math.Vector2[] };

// Ломаные по корпусу. Раз в короткий шаг рисуются заново, поэтому бегут, а не висят.
export function hullLightning(scene: Phaser.Scene): HoldMark {
  const g = scene.add.graphics();
  const bolts: Bolt[] = [];
  let left = 0;
  return {
    follow(unit, delta) {
      left -= delta;
      if (left <= 0 || bolts.length === 0) {
        left = 90;
        rewrite(bolts, unit);
      }
      g.setDepth(unit.depth + 0.4);
      g.clear();
      for (const bolt of bolts) {
        trace(g, bolt, 0x062033, 5);
        trace(g, bolt, 0x9ae8ff, 2.4);
        trace(g, bolt, 0xffffff, 1);
      }
    },
    destroy() {
      g.destroy();
    },
  };
}

function rewrite(bolts: Bolt[], unit: Phaser.GameObjects.Sprite): void {
  bolts.length = 0;
  const width = Math.max(28, unit.displayWidth * 0.72);
  const height = Math.max(18, unit.displayHeight * 0.42);
  const left = unit.x - width / 2;
  const top = unit.y - unit.displayHeight * unit.originY + unit.displayHeight * 0.22;
  for (let n = 0; n < 3; n += 1) {
    const y = top + Phaser.Math.Between(0, Math.round(height));
    const points = [new Phaser.Math.Vector2(left, y)];
    const steps = 5;
    for (let i = 1; i <= steps; i += 1) {
      const x = left + (width * i) / steps;
      const bend = i === steps ? y : y + Phaser.Math.Between(-12, 12);
      points.push(new Phaser.Math.Vector2(x, Phaser.Math.Clamp(bend, top - 6, top + height + 6)));
    }
    bolts.push({ points });
  }
}

function trace(g: Phaser.GameObjects.Graphics, bolt: Bolt, color: number, width: number): void {
  const [first, ...rest] = bolt.points;
  if (!first) {
    return;
  }
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const point of rest) {
    g.lineTo(point.x, point.y);
  }
  g.strokePath();
}
