// Гильза выстрела. Одна картинка: пуля мелкая, снаряд танка крупнее и тяжелее.
// Вылетает из окна у казённика вверх и назад, крутится и гаснет в воздухе.
// На паузе стоит вместе с часами сцены: вспышка в это время тоже стоит.

import Phaser from 'phaser';
import { bake } from './textures';

const casingKey = 'spent-casing';
const casingFrame = { w: 8, h: 4 };
// Картинка мельче ствола. Множитель оставляет латунь читаемой рядом с дулом.
const casingFit = 1.5;
const gravity = 1200;

type Flight = {
  image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
  gravity: number;
  age: number;
  lifeMs: number;
};

const flights = new WeakMap<Phaser.Scene, Flight[]>();

// travel — угол выстрела: 0 смотрит вправо. Гильза идёт вверх от ствола и немного назад.
// scale — масштаб картинки 8×4 до множителя читаемости. heft — тяжесть: 1 у пули.
// Больше единицы замедляет дугу и кручение, высота подброса остаётся.
export function ejectCasing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  travel: number,
  depth: number,
  scale: number,
  heft = 1,
): void {
  ensureCasing(scene);
  const image = scene.add.image(x, y, casingKey);
  // Чуть выше ствола: картинку оружия добавляли раньше, при равной глубине она закрыла бы окно.
  image.setDepth(depth + 0.2);
  image.setScale(scale * casingFit);
  image.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
  const launch = toss(travel, heft);
  flightsOf(scene).push({
    image,
    vx: launch.vx,
    vy: launch.vy,
    spin: launch.spin,
    gravity: launch.gravity,
    age: 0,
    lifeMs: Phaser.Math.Between(460, 620) * heft,
  });
}

function flightsOf(scene: Phaser.Scene): Flight[] {
  const existing = flights.get(scene);
  if (existing) {
    return existing;
  }
  const bag: Flight[] = [];
  flights.set(scene, bag);
  const onUpdate = (_time: number, delta: number) => step(scene, bag, delta);
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    for (const flight of bag) {
      if (flight.image.active) {
        flight.image.destroy();
      }
    }
    bag.length = 0;
    flights.delete(scene);
  });
  return bag;
}

function step(scene: Phaser.Scene, bag: Flight[], delta: number): void {
  // Пауза ставит time.paused и не останавливает update сцены.
  if (scene.time.paused) {
    return;
  }
  const dt = Math.min(delta, 64) / 1000;
  const ms = dt * 1000;
  for (let i = bag.length - 1; i >= 0; i -= 1) {
    const flight = bag[i];
    if (!flight || !flight.image.active) {
      bag.splice(i, 1);
      continue;
    }
    flight.age += ms;
    if (flight.age >= flight.lifeMs) {
      flight.image.destroy();
      bag.splice(i, 1);
      continue;
    }
    flight.vy += flight.gravity * dt;
    flight.image.x += flight.vx * dt;
    flight.image.y += flight.vy * dt;
    flight.image.rotation += flight.spin * dt;
    // Гаснет в воздухе. Очередь из нескольких пуль засыпала бы ствол, если гильзы ложились.
    const left = flight.lifeMs - flight.age;
    if (left < 180) {
      flight.image.setAlpha(left / 180);
    }
  }
}

// Вверх от ствола и назад, к казённику. Веер, чтобы очередь не летела одной дугой.
// heft делит скорость, кручение и тяжесть сразу: дуга той же высоты, только ленивее.
function toss(travel: number, heft: number): { vx: number; vy: number; spin: number; gravity: number } {
  const pace = 1 / heft;
  const up = Phaser.Math.FloatBetween(280, 420) * pace;
  const back = Phaser.Math.FloatBetween(60, 150) * pace;
  const sky = skyward(travel);
  const ux = sky.x;
  const uy = sky.y;
  const bx = -Math.cos(travel);
  const by = -Math.sin(travel);
  const vx = ux * up + bx * back;
  const vy = uy * up + by * back;
  const fan = Phaser.Math.FloatBetween(-0.4, 0.4) / heft;
  const cos = Math.cos(fan);
  const sin = Math.sin(fan);
  return {
    vx: vx * cos - vy * sin,
    vy: vx * sin + vy * cos,
    spin: Phaser.Math.FloatBetween(10, 18) * (Phaser.Math.Between(0, 1) === 0 ? -1 : 1) * pace,
    gravity: gravity * pace,
  };
}

// Из двух боков ствола берём тот, что ближе к небу.
// Ствол влево и ствол вправо тогда кидают гильзу вверх, а не в корпус.
function skyward(travel: number): { x: number; y: number } {
  const a = { x: -Math.sin(travel), y: Math.cos(travel) };
  const b = { x: -a.x, y: -a.y };
  return a.y <= b.y ? a : b;
}

function ensureCasing(scene: Phaser.Scene): void {
  if (scene.textures.exists(casingKey)) {
    return;
  }
  const { w, h } = casingFrame;
  bake(scene, casingKey, w, h, (g) => {
    g.fillStyle(0x4a3014, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0xc48a32, 1);
    g.fillRect(1, 1, w - 2, h - 2);
    g.fillStyle(0xf0d090, 1);
    g.fillRect(1, 1, w - 3, 1);
    // Донышко темнее открытого края: крутясь, гильза читается не как искра.
    g.fillStyle(0x6a4018, 1);
    g.fillRect(w - 2, 0, 2, h);
  });
  // Крутится на любой угол. Ближний фильтр на таком маленьком прямоугольнике рвёт латунь в точки.
  scene.textures.get(casingKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
}
