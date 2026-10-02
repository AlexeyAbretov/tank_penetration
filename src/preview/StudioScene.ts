// Холст просмотра: запекает текстуры выбранной сущности и рисует их с рамками игры.

import Phaser from 'phaser';
import { Tank } from '../entities/Tank';
import { TANK_HULL_FRAME, TANK_TURRET_FRAME } from '../gfx/looks';
import { ENTITIES, type PreviewEntity } from './catalog';
import { formatLook, type Paint } from './format';
import {
  bindPanel,
  configureView,
  copySnippet,
  flashCopy,
  markActive,
  readView,
  renderFields,
  setHint,
  setSnippet,
  setStatus,
  setStoredNote,
  type ViewState,
} from './panel';

const STORAGE = 'tank-defense-studio:v1:';

export class StudioScene extends Phaser.Scene {
  private entity: PreviewEntity = ENTITIES[0];
  private paint: Paint = { ...ENTITIES[0].defaults };
  private holders: Phaser.GameObjects.Container[] = [];
  private captions: Phaser.GameObjects.Text[] = [];
  private liveKeys: string[] = [];
  private liveAnim?: string;
  private backdrop!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private bakeQueued = false;

  constructor() {
    super('studio');
  }

  create(): void {
    this.backdrop = this.add.graphics();
    this.ground = this.add.graphics();
    this.scale.on('resize', () => this.place());
    bindPanel({
      select: (id) => this.select(id),
      paint: (key, value) => this.setPaint(key, value),
      view: () => this.buildHolders(),
      reset: () => this.resetPaint(),
      copy: () => {
        void copySnippet().then((ok) => flashCopy(ok));
      },
    });
    this.select(ENTITIES[0].id);
  }

  private select(id: string): void {
    const entity = ENTITIES.find((entry) => entry.id === id) ?? ENTITIES[0];
    this.entity = entity;
    this.paint = loadPaint(entity);
    markActive(entity.id);
    configureView(entity);
    renderFields(entity, this.paint, (key, value) => this.setPaint(key, value));
    setHint(entity.hint);
    this.rebake();
  }

  private setPaint(key: string, value: number | boolean): void {
    this.paint[key] = value;
    savePaint(this.entity.id, this.paint);
    this.publish();
    this.queueBake();
  }

  private resetPaint(): void {
    localStorage.removeItem(STORAGE + this.entity.id);
    this.paint = { ...this.entity.defaults };
    renderFields(this.entity, this.paint, (key, value) => this.setPaint(key, value));
    this.publish();
    this.rebake();
  }

  private queueBake(): void {
    if (this.bakeQueued) {
      return;
    }
    this.bakeQueued = true;
    requestAnimationFrame(() => {
      this.bakeQueued = false;
      if (this.scene.isActive()) {
        this.rebake();
      }
    });
  }

  private rebake(): void {
    this.dropArt();
    const keys = this.keysFor(this.entity);
    this.entity.bake(this, this.paint, keys);
    this.liveKeys = keys;
    if (this.entity.frameCount > 1) {
      const anim = `studio-${this.entity.id}`;
      this.anims.create({
        key: anim,
        frames: keys.map((key) => ({ key })),
        frameRate: this.entity.animFps ?? 7,
        repeat: -1,
      });
      this.liveAnim = anim;
    }
    this.buildHolders();
    this.publish();
  }

  private buildHolders(): void {
    this.holders.forEach((holder) => holder.destroy());
    this.holders = [];
    this.captions.forEach((caption) => caption.destroy());
    this.captions = [];
    if (this.liveKeys.length === 0) {
      return;
    }
    const view = readView();
    if (this.entity.kind === 'tank') {
      this.holders.push(this.makeTank(view));
    } else if (this.entity.frameCount > 1 && view.animate && this.liveAnim) {
      this.holders.push(this.makeSprite(this.liveKeys[0], view, true));
    } else {
      for (let i = 0; i < this.entity.frameCount; i += 1) {
        this.holders.push(this.makeSprite(this.liveKeys[i], view, false));
      }
    }
    this.place();
  }

  private makeSprite(key: string, view: ViewState, play: boolean): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0);
    const sprite = this.add.sprite(0, 0, key);
    sprite.setOrigin(this.entity.originX, this.entity.originY);
    sprite.setScale(view.scale);
    if (this.entity.addBlend && view.addBlend) {
      sprite.setBlendMode(Phaser.BlendModes.ADD);
    }
    if (this.entity.kind === 'shot') {
      sprite.setRotation(view.rotation);
    }
    if (play && this.liveAnim) {
      sprite.play(this.liveAnim);
    }
    root.add(sprite);
    const guides = this.add.graphics();
    root.add(guides);
    this.paintSpriteGuides(guides, view);
    return root;
  }

  private makeTank(view: ViewState): Phaser.GameObjects.Container {
    const layout = Tank.layout;
    const root = this.add.container(0, 0);
    root.setScale(view.scale);
    const hull = this.add.image(layout.hullX, layout.hullY, this.liveKeys[0]);
    root.add(hull);
    const pivot = this.add.container(layout.turretX, layout.turretY);
    pivot.setRotation(view.angle);
    const turret = this.add.image(0, 0, this.liveKeys[1]);
    turret.setOrigin(layout.turretOriginX, layout.turretOriginY);
    pivot.add(turret);
    root.add(pivot);

    const guides = this.add.graphics();
    root.add(guides);
    if (view.bounds) {
      guides.lineStyle(1, 0xf0d56a, 0.9);
      strokeImage(guides, hull);
      const frame = this.add.graphics();
      frame.lineStyle(1, 0xf0d56a, 0.9);
      frame.strokeRect(
        -turret.originX * turret.width,
        -turret.originY * turret.height,
        turret.width,
        turret.height,
      );
      pivot.add(frame);
    }
    if (view.hitbox) {
      guides.lineStyle(2, 0x66e080, 0.95);
      guides.strokeRect(
        -layout.hitLeft,
        -layout.hitUp,
        layout.hitLeft + layout.hitRight,
        layout.hitUp + layout.hitDown,
      );
    }
    if (view.origin) {
      paintCross(guides);
    }
    if (view.muzzle) {
      const x = layout.turretX + Math.cos(view.angle) * layout.muzzleLength;
      const y = layout.turretY + Math.sin(view.angle) * layout.muzzleLength;
      guides.fillStyle(0xffee66, 1);
      guides.fillCircle(x, y, 4);
    }
    return root;
  }

  private paintSpriteGuides(g: Phaser.GameObjects.Graphics, view: ViewState): void {
    const entity = this.entity;
    const s = view.scale;
    const left = -entity.originX * entity.texW * s;
    const top = -entity.originY * entity.texH * s;
    const width = entity.texW * s;
    const height = entity.texH * s;
    if (view.bounds) {
      g.lineStyle(1, 0xf0d56a, 0.9);
      g.strokeRect(left, top, width, height);
    }
    if (view.hitbox && entity.hitbox) {
      g.lineStyle(2, 0x66e080, 0.95);
      g.strokeRect(
        left + entity.hitbox.ox * s,
        top + entity.hitbox.oy * s,
        entity.hitbox.w * s,
        entity.hitbox.h * s,
      );
    }
    if (view.origin) {
      paintCross(g);
    }
    if (view.muzzle && entity.muzzle) {
      // Смещение дула в игре задано при игровом масштабе. Если ползунок масштаба другой, точка едет вместе с рисунком.
      const fit = entity.gameScale === 0 ? 1 : view.scale / entity.gameScale;
      const x = entity.muzzle.x * fit;
      const y = entity.muzzle.y * fit;
      g.lineStyle(1, 0xffee66, 0.7);
      g.lineBetween(0, 0, x, y);
      g.fillStyle(0xffee66, 1);
      g.fillCircle(x, y, 3);
    }
    if (view.hp && entity.hpColor !== undefined) {
      const barY = -height * 0.95;
      g.fillStyle(0x2a0a0a, 1);
      g.fillRect(-15, barY - 2.5, 30, 5);
      g.fillStyle(entity.hpColor, 1);
      g.fillRect(-15, barY - 2.5, 30, 5);
    }
  }

  private place(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    if (width < 10 || height < 10 || this.holders.length === 0) {
      this.paintBackdrop();
      return;
    }
    const view = readView();
    const bounds = this.contentBounds(view);
    const localW = Math.max(1, bounds.right - bounds.left);
    const localH = Math.max(1, bounds.bottom - bounds.top);
    const count = this.holders.length;
    const gutter = 28;
    const padX = 16;
    const padTop = 12;
    const padBottom = 36;
    // У танка масштаб сущности сидит на контейнере, у спрайта — на самой картинке.
    const extra = this.entity.kind === 'tank' ? view.scale : 1;
    const availW = Math.max(40, width - padX * 2 - gutter * Math.max(0, count - 1));
    const availH = Math.max(40, height - padTop - padBottom);
    const fit = Math.min(availW / (localW * extra * count), availH / (localH * extra));
    const scale = Math.max(0.05, fit * view.zoom);
    const step = localW * extra * scale + gutter;
    const midX = (bounds.left + bounds.right) / 2;
    const midY = (bounds.top + bounds.bottom) / 2;
    const centerY = padTop + availH / 2;

    this.holders.forEach((holder, index) => {
      const centerX = width / 2 + (index - (count - 1) / 2) * step;
      holder.setScale(scale * extra);
      holder.setPosition(centerX - midX * scale * extra, centerY - midY * scale * extra);
    });

    const footY = this.holders[0]?.y ?? centerY;
    this.paintBackdrop(footY);

    const labels = this.labels(view);
    this.captions.forEach((caption) => caption.destroy());
    this.captions = this.holders.map((holder, index) => {
      const boxBottom = holder.y + bounds.bottom * holder.scaleY;
      return this.add
        .text(holder.x + midX * holder.scaleX, boxBottom + 8, labels[index] ?? '', {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '14px',
          color: '#f0d6a8',
        })
        .setOrigin(0.5, 0);
    });

    this.ground.clear();
    this.ground.lineStyle(1, 0x8a6248, 0.7);
    this.ground.lineBetween(padX, footY, width - padX, footY);
  }

  // Прямоугольник всего, что рисуется вокруг сущности: текстура, полоска HP, дуло, крест опоры.
  // Координаты — локальные, до увеличения контейнера.
  private contentBounds(view: ViewState): { left: number; top: number; right: number; bottom: number } {
    if (this.entity.kind === 'tank') {
      return this.tankBounds(view);
    }
    const entity = this.entity;
    const s = view.scale;
    let left = -entity.originX * entity.texW * s;
    let right = (1 - entity.originX) * entity.texW * s;
    let top = -entity.originY * entity.texH * s;
    let bottom = (1 - entity.originY) * entity.texH * s;
    if (view.hp && entity.hpColor !== undefined) {
      top = Math.min(top, -entity.texH * s * 0.95 - 6);
    }
    if (view.muzzle && entity.muzzle) {
      const fit = entity.gameScale === 0 ? 1 : s / entity.gameScale;
      left = Math.min(left, entity.muzzle.x * fit - 6);
      right = Math.max(right, entity.muzzle.x * fit + 6);
      top = Math.min(top, entity.muzzle.y * fit - 6);
      bottom = Math.max(bottom, entity.muzzle.y * fit + 6);
    }
    if (view.origin) {
      left = Math.min(left, -16);
      right = Math.max(right, 16);
      top = Math.min(top, -16);
      bottom = Math.max(bottom, 16);
    }
    return { left, top, right, bottom };
  }

  private tankBounds(view: ViewState): { left: number; top: number; right: number; bottom: number } {
    const layout = Tank.layout;
    let left = layout.hullX - TANK_HULL_FRAME.w / 2;
    let right = layout.hullX + TANK_HULL_FRAME.w / 2;
    let top = layout.hullY - TANK_HULL_FRAME.h / 2;
    let bottom = layout.hullY + TANK_HULL_FRAME.h / 2;

    const cos = Math.cos(view.angle);
    const sin = Math.sin(view.angle);
    const turretX = [-layout.turretOriginX, 1 - layout.turretOriginX];
    const turretY = [-layout.turretOriginY, 1 - layout.turretOriginY];
    for (const ox of turretX) {
      for (const oy of turretY) {
        const x = ox * TANK_TURRET_FRAME.w;
        const y = oy * TANK_TURRET_FRAME.h;
        const rx = layout.turretX + x * cos - y * sin;
        const ry = layout.turretY + x * sin + y * cos;
        left = Math.min(left, rx);
        right = Math.max(right, rx);
        top = Math.min(top, ry);
        bottom = Math.max(bottom, ry);
      }
    }
    if (view.muzzle) {
      const x = layout.turretX + cos * layout.muzzleLength;
      const y = layout.turretY + sin * layout.muzzleLength;
      left = Math.min(left, x - 6);
      right = Math.max(right, x + 6);
      top = Math.min(top, y - 6);
      bottom = Math.max(bottom, y + 6);
    }
    if (view.hitbox) {
      left = Math.min(left, -layout.hitLeft);
      right = Math.max(right, layout.hitRight);
      top = Math.min(top, -layout.hitUp);
      bottom = Math.max(bottom, layout.hitDown);
    }
    if (view.origin) {
      left = Math.min(left, -16);
      right = Math.max(right, 16);
      top = Math.min(top, -16);
      bottom = Math.max(bottom, 16);
    }
    return { left, top, right, bottom };
  }

  private labels(view: ViewState): string[] {
    if (this.entity.kind === 'tank') {
      return ['сборка'];
    }
    if (this.entity.frameCount > 1 && view.animate) {
      const motion = this.entity.motion ?? 'шаг';
      return [`${motion} · ${this.entity.animFps ?? 7} кадров/с`];
    }
    if (this.entity.frameCount > 1) {
      return Array.from({ length: this.entity.frameCount }, (_, index) => `кадр ${index + 1}`);
    }
    return ['текстура'];
  }

  private paintBackdrop(groundY?: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const g = this.backdrop;
    g.clear();
    const view = readView();
    if (!view.checker) {
      g.fillStyle(0x1a0806, 1);
      g.fillRect(0, 0, width, height);
      g.fillStyle(0x3a120c, 1);
      const split = groundY ?? height * 0.62;
      g.fillRect(0, split, width, Math.max(0, height - split));
      return;
    }
    const cell = 20;
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const odd = (x / cell + y / cell) % 2 === 0;
        g.fillStyle(odd ? 0x1c100e : 0x2a1814, 1);
        g.fillRect(x, y, cell, cell);
      }
    }
  }

  private dropArt(): void {
    this.holders.forEach((holder) => holder.destroy());
    this.holders = [];
    this.captions.forEach((caption) => caption.destroy());
    this.captions = [];
    if (this.liveAnim && this.anims.exists(this.liveAnim)) {
      this.anims.remove(this.liveAnim);
    }
    this.liveAnim = undefined;
    for (const key of this.liveKeys) {
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
    }
    this.liveKeys = [];
  }

  private keysFor(entity: PreviewEntity): string[] {
    if (entity.kind === 'tank') {
      return ['studio-tank-hull', 'studio-tank-turret'];
    }
    if (entity.frameCount > 1) {
      return Array.from({ length: entity.frameCount }, (_, index) => `studio-${entity.id}-${index}`);
    }
    return [`studio-${entity.id}`];
  }

  private publish(): void {
    const view = readView();
    setSnippet(formatLook(this.entity.exportName, this.entity.defaults, this.paint));
    setStoredNote(localStorage.getItem(STORAGE + this.entity.id) !== null);
    setStatus(
      `${this.entity.texW}×${this.entity.texH} · масштаб ${view.scale.toFixed(2)} · зум ×${view.zoom.toFixed(1)}`,
    );
  }
}

function paintCross(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(2, 0xff5544, 1);
  g.lineBetween(-12, 0, 12, 0);
  g.lineBetween(0, -12, 0, 12);
}

function strokeImage(g: Phaser.GameObjects.Graphics, image: Phaser.GameObjects.Image): void {
  const width = image.width * image.scaleX;
  const height = image.height * image.scaleY;
  g.strokeRect(image.x - image.originX * width, image.y - image.originY * height, width, height);
}

function loadPaint(entity: PreviewEntity): Paint {
  const paint: Paint = { ...entity.defaults };
  const raw = localStorage.getItem(STORAGE + entity.id);
  if (!raw) {
    return paint;
  }
  try {
    const saved = JSON.parse(raw) as Paint;
    for (const key of Object.keys(entity.defaults)) {
      if (typeof saved[key] === typeof entity.defaults[key]) {
        paint[key] = saved[key];
      }
    }
  } catch {
    localStorage.removeItem(STORAGE + entity.id);
  }
  return paint;
}

function savePaint(id: string, paint: Paint): void {
  localStorage.setItem(STORAGE + id, JSON.stringify(paint));
}
