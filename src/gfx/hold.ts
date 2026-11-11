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

type Bolt = { points: Phaser.Math.Vector2[]; rank: number };

type Box = { l: number; r: number; t: number; b: number };

// Канал с изломом поперёк хода и короткие ветки. Раз в короткий шаг рисуется заново, поэтому бежит по корпусу.
export function hullLightning(scene: Phaser.Scene): HoldMark {
  const g = scene.add.graphics();
  const bolts: Bolt[] = [];
  let left = 0;
  return {
    follow(unit, delta) {
      left -= delta;
      if (left <= 0 || bolts.length === 0) {
        left = Phaser.Math.Between(50, 90);
        rewrite(bolts, unit);
      }
      g.setDepth(unit.depth + 0.4);
      g.clear();
      for (const bolt of bolts) {
        paint(g, bolt);
      }
    },
    destroy() {
      g.destroy();
    },
  };
}

function rewrite(bolts: Bolt[], unit: Phaser.GameObjects.Sprite): void {
  bolts.length = 0;
  const box = hullBox(unit);
  if (box.r - box.l < 12 || box.b - box.t < 12) {
    return;
  }
  // С крыши к днищу, наискосок через борт и короткий скачок. Разряд покрывает корпус целиком.
  const ends = [strikeDown(box), strikeAcross(box), strikeLocal(box)];
  for (const [from, to] of ends) {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const sway = Math.min(len * 0.3, (box.b - box.t) * 0.48);
    const points = [from];
    bend(from, to, sway, points, bolts, 0, box, { forks: 0 });
    bolts.push({ points, rank: 0 });
  }
  bolts.sort((a, b) => a.rank - b.rank);
}

function hullBox(unit: Phaser.GameObjects.Sprite): Box {
  const w = unit.displayWidth;
  const h = unit.displayHeight;
  const left = unit.x - w * unit.originX;
  const top = unit.y - h * unit.originY;
  return {
    l: left + w * 0.1,
    r: left + w * 0.9,
    t: top + h * 0.14,
    b: top + h * 0.78,
  };
}

function strikeDown(box: Box): [Phaser.Math.Vector2, Phaser.Math.Vector2] {
  const span = box.r - box.l;
  const h = box.b - box.t;
  return [
    new Phaser.Math.Vector2(
      Phaser.Math.FloatBetween(box.l + span * 0.12, box.r - span * 0.12),
      box.t + h * Phaser.Math.FloatBetween(0, 0.1),
    ),
    new Phaser.Math.Vector2(
      Phaser.Math.FloatBetween(box.l + span * 0.12, box.r - span * 0.12),
      box.b - h * Phaser.Math.FloatBetween(0, 0.1),
    ),
  ];
}

function strikeAcross(box: Box): [Phaser.Math.Vector2, Phaser.Math.Vector2] {
  const w = box.r - box.l;
  const h = box.b - box.t;
  const fromLeft = Math.random() < 0.5;
  const x0 = fromLeft ? box.l + w * Phaser.Math.FloatBetween(0.04, 0.2) : box.r - w * Phaser.Math.FloatBetween(0.04, 0.2);
  const x1 = fromLeft ? box.r - w * Phaser.Math.FloatBetween(0.04, 0.2) : box.l + w * Phaser.Math.FloatBetween(0.04, 0.2);
  const high = box.t + h * Phaser.Math.FloatBetween(0.04, 0.32);
  const low = box.b - h * Phaser.Math.FloatBetween(0.04, 0.32);
  if (Math.random() < 0.5) {
    return [new Phaser.Math.Vector2(x0, high), new Phaser.Math.Vector2(x1, low)];
  }
  return [new Phaser.Math.Vector2(x0, low), new Phaser.Math.Vector2(x1, high)];
}

function strikeLocal(box: Box): [Phaser.Math.Vector2, Phaser.Math.Vector2] {
  const w = box.r - box.l;
  const h = box.b - box.t;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const from = new Phaser.Math.Vector2(
      Phaser.Math.FloatBetween(box.l + w * 0.22, box.r - w * 0.22),
      Phaser.Math.FloatBetween(box.t + h * 0.22, box.b - h * 0.22),
    );
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const reach = Math.min(w, h * 1.3) * Phaser.Math.FloatBetween(0.42, 0.75);
    const to = place(box, from, Math.cos(ang) * reach, Math.sin(ang) * reach);
    if (Math.hypot(to.x - from.x, to.y - from.y) > 14) {
      return [from, to];
    }
  }
  return strikeAcross(box);
}

function bend(
  from: Phaser.Math.Vector2,
  to: Phaser.Math.Vector2,
  sway: number,
  into: Phaser.Math.Vector2[],
  bolts: Bolt[],
  rank: number,
  box: Box,
  budget: { forks: number },
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 7) {
    into.push(to);
    return;
  }
  const t = Phaser.Math.FloatBetween(0.38, 0.62);
  const kick = len > 34 && Math.random() < 0.22 ? 1.65 : 1;
  const off = Phaser.Math.FloatBetween(-sway, sway) * kick;
  const mid = place(
    box,
    new Phaser.Math.Vector2(from.x + dx * t, from.y + dy * t),
    (-dy / len) * off,
    (dx / len) * off,
  );
  if (rank === 0 && budget.forks < 2 && len > 32 && Math.random() < 0.55) {
    const sign = Math.random() < 0.5 ? -1 : 1;
    const ang = Math.atan2(dy, dx) + sign * Phaser.Math.FloatBetween(0.45, 1.05);
    const reach = len * Phaser.Math.FloatBetween(0.28, 0.52);
    const tip = place(box, mid, Math.cos(ang) * reach, Math.sin(ang) * reach);
    if (Math.hypot(tip.x - mid.x, tip.y - mid.y) > 12) {
      budget.forks += 1;
      const fork = [new Phaser.Math.Vector2(mid.x, mid.y)];
      bend(mid, tip, sway * 0.55, fork, bolts, 1, box, budget);
      bolts.push({ points: fork, rank: 1 });
    }
  }
  bend(from, mid, sway * 0.52, into, bolts, rank, box, budget);
  bend(mid, to, sway * 0.52, into, bolts, rank, box, budget);
}

function place(box: Box, at: Phaser.Math.Vector2, ox: number, oy: number): Phaser.Math.Vector2 {
  let scale = 1;
  const x = at.x + ox;
  const y = at.y + oy;
  if (x < box.l) {
    scale = Math.min(scale, (at.x - box.l) / (at.x - x));
  } else if (x > box.r) {
    scale = Math.min(scale, (box.r - at.x) / (x - at.x));
  }
  if (y < box.t) {
    scale = Math.min(scale, (at.y - box.t) / (at.y - y));
  } else if (y > box.b) {
    scale = Math.min(scale, (box.b - at.y) / (y - at.y));
  }
  if (!Number.isFinite(scale) || scale < 0) {
    scale = 0;
  }
  return new Phaser.Math.Vector2(at.x + ox * scale, at.y + oy * scale);
}

function paint(g: Phaser.GameObjects.Graphics, bolt: Bolt): void {
  if (bolt.points.length < 2) {
    return;
  }
  if (bolt.rank === 0) {
    trace(g, bolt, 0x1a56c4, 7, 0.22);
    trace(g, bolt, 0x062033, 4.4, 0.92);
    trace(g, bolt, 0x8fdfff, 2.2, 1);
    trace(g, bolt, 0xffffff, 1, 1);
    return;
  }
  trace(g, bolt, 0x062033, 2.4, 0.75);
  trace(g, bolt, 0x9ae8ff, 1.25, 1);
  trace(g, bolt, 0xffffff, 0.6, 1);
  const root = bolt.points[0];
  if (!root) {
    return;
  }
  g.fillStyle(0xbff6ff, 0.95);
  g.fillCircle(root.x, root.y, 2.1);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(root.x, root.y, 1.1);
}

function trace(
  g: Phaser.GameObjects.Graphics,
  bolt: Bolt,
  color: number,
  width: number,
  alpha: number,
): void {
  const [first, ...rest] = bolt.points;
  if (!first || rest.length === 0) {
    return;
  }
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const point of rest) {
    g.lineTo(point.x, point.y);
  }
  g.strokePath();
}
