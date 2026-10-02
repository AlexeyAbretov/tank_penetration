// Холст просмотра: запекает текстуры выбранной сущности и рисует их с рамками игры.

import Phaser from 'phaser';
import { EnemyShot } from '../entities/EnemyShot';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { Infantry } from '../entities/Infantry';
import { PickupTruck } from '../entities/PickupTruck';
import { Tank } from '../entities/Tank';
import {
  BULLET_FRAME,
  CORPSE_FRAME,
  GUNNER_FLASH_FRAME,
  GUNNER_RIFLE_FRAME,
  MUZZLE_FRAME,
  PICKUP_FLASH_FRAME,
  PICKUP_FRAME,
  PICKUP_GUN_FRAME,
  SHELL_FRAME,
  SOLDIER_FRAME,
  TANK_GUN_FRAME,
  TANK_HULL_FRAME,
  TANK_TURRET_FRAME,
  TANK_WRECK_FRAME,
  type BulletPaint,
  type MuzzlePaint,
  type PickupPaint,
  type ShellPaint,
  type SoldierLook,
  type TankPaint,
} from '../gfx/looks';
import { createArmorSparks, emitArmorSparks } from '../gfx/sparks';
import { bake } from '../gfx/textures';
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
// Сколько секунд снаряд летит от дула до плиты. Одинаково для танка, стрелка и пикапа.
const PLATE_FLIGHT_S = 0.36;

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
  private rig?: ShotRig;
  private flies: Fly[] = [];
  private readonly sparkPoint = new Phaser.Math.Vector2();
  private bodyKeys: string[] = [];
  private gunnerBodyKeys: string[] = [];
  // true, пока галочка «Смерть» включена. Взрыв пикапа играем один раз при включении, не на каждый ползунок.
  private deathOn = false;
  private blastPending = false;
  private blastTimer?: Phaser.Time.TimerEvent;
  private deathFx: Phaser.GameObjects.GameObject[] = [];

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
    if (this.entity.id === 'pickup') {
      this.bakePickupBody();
    }
    if (this.entity.id === 'gunner') {
      this.bakeGunnerBody();
    }
    this.refreshFx();
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
    this.disarm();
    this.clearDeathFx();
    this.holders.forEach((holder) => holder.destroy());
    this.holders = [];
    this.captions.forEach((caption) => caption.destroy());
    this.captions = [];
    if (this.liveKeys.length === 0) {
      return;
    }
    const view = readView();
    const dying = view.death && this.entity.death !== undefined;
    this.blastPending =
      dying && (this.entity.death === 'wreck' || this.entity.death === 'nuke') && !this.deathOn;
    this.deathOn = dying;
    const firing = !dying && view.fire && this.entity.shot !== undefined;
    if (dying) {
      this.holders.push(this.makeDeath(view));
    } else if (this.entity.kind === 'tank') {
      this.holders.push(this.makeTank(view));
    } else if (firing && this.entity.id === 'pickup') {
      this.holders.push(this.makePickup(view));
    } else if (firing && this.entity.id === 'gunner') {
      this.holders.push(this.makeGunner(view));
    } else if (firing || (this.entity.frameCount > 1 && view.animate && this.liveAnim)) {
      const holder = this.makeSprite(this.liveKeys[0], view, view.animate && Boolean(this.liveAnim));
      this.holders.push(holder);
      if (firing && this.entity.muzzle) {
        const pixel = this.pixel(view);
        this.arm(holder, { x: this.entity.muzzle.x * pixel, y: this.entity.muzzle.y * pixel }, Math.PI, pixel);
      }
    } else {
      for (let i = 0; i < this.entity.frameCount; i += 1) {
        this.holders.push(this.makeSprite(this.liveKeys[i], view, false));
      }
    }
    this.place();
    this.publish();
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

  private frameOf(view: ViewState): { w: number; h: number } {
    if (view.death && this.entity.death === 'corpse') {
      return CORPSE_FRAME;
    }
    if (view.death && this.entity.death === 'nuke') {
      return TANK_WRECK_FRAME;
    }
    return { w: this.entity.texW, h: this.entity.texH };
  }

  private makeDeath(view: ViewState): Phaser.GameObjects.Container {
    if (this.entity.death === 'nuke') {
      return this.makeTankWreck(view);
    }
    const wreck = this.entity.death === 'wreck';
    const frame = wreck ? PICKUP_FRAME : CORPSE_FRAME;
    this.restamp('studio-death', frame.w, frame.h, (g) => {
      if (wreck) {
        PickupTruck.renderWreck(g, this.paint as PickupPaint);
      } else {
        Infantry.drawCorpse(g, this.paint as SoldierLook);
      }
    });
    return this.makeSprite('studio-death', view, false);
  }

  private makeTankWreck(view: ViewState): Phaser.GameObjects.Container {
    const layout = Tank.layout;
    this.restamp('studio-death', TANK_WRECK_FRAME.w, TANK_WRECK_FRAME.h, (g) => {
      Tank.renderWreck(g, this.paint as TankPaint);
    });
    const root = this.add.container(0, 0);
    const wreck = this.add.image(layout.hullX, layout.hullY, 'studio-death');
    root.add(wreck);
    const guides = this.add.graphics();
    root.add(guides);
    if (view.bounds) {
      guides.lineStyle(1, 0xf0d56a, 0.9);
      strokeImage(guides, wreck);
    }
    if (view.origin) {
      paintCross(guides);
    }
    return root;
  }

  // Взрыв в координатах холста. visual — во сколько раз картинка крупнее, чем на поле боя.
  private playStudioBlast(holder: Phaser.GameObjects.Container): void {
    const view = readView();
    const fit = holder.scaleX;
    const visual = fit * (view.scale / PickupTruck.placed.scale);
    const x = holder.x - 8 * view.scale * fit;
    const y = holder.y - 26 * view.scale * fit;
    const keys = { muzzle: 'studio-fx-muzzle' };
    this.deathFx.push(...PickupTruck.burstAt(this, x, y, visual, keys));
    this.blastTimer = this.time.delayedCall(90, () => {
      this.blastTimer = undefined;
      this.deathFx.push(
        ...PickupTruck.burstAt(this, x + 22 * view.scale * fit, y + 8 * view.scale * fit, visual, keys),
      );
    });
  }

  // Гриб в мировых координатах холста. Масштаб контейнера уже включает зум просмотра.
  private playStudioNuke(holder: Phaser.GameObjects.Container): void {
    const layout = Tank.layout;
    const x = holder.x + layout.hullX * holder.scaleX;
    const y = holder.y + (layout.hullY - 12) * holder.scaleY;
    this.deathFx.push(...Tank.nukeAt(this, x, y, Math.abs(holder.scaleX)));
  }

  private clearDeathFx(): void {
    this.blastTimer?.remove(false);
    this.blastTimer = undefined;
    for (const fx of this.deathFx) {
      this.tweens.killTweensOf(fx);
      fx.destroy();
    }
    this.deathFx = [];
  }

  private makeTank(view: ViewState): Phaser.GameObjects.Container {
    const layout = Tank.layout;
    const root = this.add.container(0, 0);
    root.setScale(view.scale);
    const hull = this.add.image(layout.hullX, layout.hullY, this.liveKeys[0]);
    root.add(hull);
    // Башня и ствол крутятся вокруг днища башни, как в бою.
    const pivot = this.add.container(layout.seatX, layout.seatY);
    pivot.setRotation(view.angle);
    const turret = this.add.image(layout.turretX - layout.seatX, layout.turretY - layout.seatY, this.liveKeys[1]);
    turret.setOrigin(layout.turretOriginX, layout.turretOriginY);
    const gun = this.add.image(layout.gunX - layout.seatX, layout.gunY - layout.seatY, this.liveKeys[2]);
    gun.setOrigin(layout.gunOriginX, layout.gunOriginY);
    pivot.add([turret, gun]);
    root.add(pivot);

    const guides = this.add.graphics();
    root.add(guides);
    if (view.bounds) {
      guides.lineStyle(1, 0xf0d56a, 0.9);
      strokeImage(guides, hull);
      const frame = this.add.graphics();
      frame.lineStyle(1, 0xf0d56a, 0.9);
      strokeImage(frame, turret);
      strokeImage(frame, gun);
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
    const muzzle = Tank.muzzleAt(view.angle);
    if (view.muzzle) {
      guides.fillStyle(0xffee66, 1);
      guides.fillCircle(muzzle.x, muzzle.y, 4);
    }
    if (view.fire && this.entity.shot) {
      this.arm(root, muzzle, view.angle, 1, { gun });
    }
    return root;
  }

  private paintSpriteGuides(g: Phaser.GameObjects.Graphics, view: ViewState): void {
    const entity = this.entity;
    const frame = this.frameOf(view);
    const s = view.scale;
    const left = -entity.originX * frame.w * s;
    const top = -entity.originY * frame.h * s;
    const width = frame.w * s;
    const height = frame.h * s;
    if (view.bounds) {
      g.lineStyle(1, 0xf0d56a, 0.9);
      g.strokeRect(left, top, width, height);
    }
    if (!view.death && view.hitbox && entity.hitbox) {
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
    if (!view.death && view.muzzle && entity.muzzle) {
      // Смещение дула в игре задано при игровом масштабе. Если ползунок масштаба другой, точка едет вместе с рисунком.
      const fit = entity.gameScale === 0 ? 1 : view.scale / entity.gameScale;
      const x = entity.muzzle.x * fit;
      const y = entity.muzzle.y * fit;
      g.lineStyle(1, 0xffee66, 0.7);
      g.lineBetween(0, 0, x, y);
      g.fillStyle(0xffee66, 1);
      g.fillCircle(x, y, 3);
    }
    if (!view.death && view.hp && entity.hpColor !== undefined) {
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
    // Снаряд, вспышка и пуля мелкие. Без общего окна они растягиваются на весь холст
    // и даже при минимальном увеличении выглядят крупнее танка.
    const frame = this.entity.kind === 'shot' ? tankFrameSpan() : null;
    const spanW = frame ? Math.max(localW, frame.w) : localW;
    const spanH = frame ? Math.max(localH, frame.h) : localH;
    const fit = Math.min(availW / (spanW * extra * count), availH / (spanH * extra));
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
    // Искры живут на сцене, не в контейнере: в контейнере их кадры не рисуются.
    // Масштаб тот же, что у сборки, поэтому размер вспышки совпадает с боем.
    if (this.rig?.sparks && this.holders[0]) {
      this.rig.sparks.setScale(this.holders[0].scaleX);
    }
    if (this.blastPending && this.holders[0]) {
      this.blastPending = false;
      if (this.entity.death === 'nuke') {
        this.playStudioNuke(this.holders[0]);
      } else {
        this.playStudioBlast(this.holders[0]);
      }
    }

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
      const box = this.tankBounds(view);
      if (view.death) {
        return box;
      }
      return this.withPlate(box, view);
    }
    const entity = this.entity;
    const frame = this.frameOf(view);
    const s = view.scale;
    let left = -entity.originX * frame.w * s;
    let right = (1 - entity.originX) * frame.w * s;
    let top = -entity.originY * frame.h * s;
    let bottom = (1 - entity.originY) * frame.h * s;
    if (!view.death && view.hp && entity.hpColor !== undefined) {
      top = Math.min(top, -frame.h * s * 0.95 - 6);
    }
    if (!view.death && view.muzzle && entity.muzzle) {
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
    return this.withPlate({ left, top, right, bottom }, view);
  }

  // Плита стоит на линии выстрела. Без неё в кадре остаётся только спрайт, и стена уезжает за край.
  private withPlate(
    box: { left: number; top: number; right: number; bottom: number },
    view: ViewState,
  ): { left: number; top: number; right: number; bottom: number } {
    const plate = this.plateFor(view);
    if (!plate) {
      return box;
    }
    let left = box.left;
    let right = box.right;
    let top = box.top;
    let bottom = box.bottom;
    for (const across of [-plate.half, plate.half]) {
      for (const forward of [0, plate.depth]) {
        const x = plate.x - Math.sin(plate.angle) * across + Math.cos(plate.angle) * forward;
        const y = plate.y + Math.cos(plate.angle) * across + Math.sin(plate.angle) * forward;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    // Запас сверху: искры взлетают выше плиты и не должны обрезаться краем холста.
    return { left: left - 28, top: top - 56, right: right + 28, bottom: bottom + 36 };
  }

  // Лицо плиты в тех же локальных координатах, что и летящий снаряд.
  private plateFor(view: ViewState): Plate | null {
    const shot = this.entity.shot;
    if (!view.fire || !shot) {
      return null;
    }
    const pixel = this.pixel(view);
    let angle = Math.PI;
    let muzzle = { x: 0, y: 0 };
    if (this.entity.kind === 'tank') {
      angle = view.angle;
      muzzle = Tank.muzzleAt(angle);
    } else if (this.entity.muzzle) {
      muzzle = { x: this.entity.muzzle.x * pixel, y: this.entity.muzzle.y * pixel };
    } else {
      return null;
    }
    const distance = shot.speed * pixel * PLATE_FLIGHT_S;
    return {
      x: muzzle.x + Math.cos(angle) * distance,
      y: muzzle.y + Math.sin(angle) * distance,
      angle,
      half: 84,
      depth: 18,
    };
  }

  private addPlate(root: Phaser.GameObjects.Container, plate: Plate): void {
    const g = this.add.graphics();
    g.setPosition(plate.x, plate.y);
    g.setRotation(plate.angle);
    const top = -plate.half;
    const height = plate.half * 2;
    g.fillStyle(0x2c261e, 1);
    g.fillRect(0, top, plate.depth, height);
    g.fillStyle(0x6e675b, 1);
    g.fillRect(0, top, 5, height);
    g.fillStyle(0x9a9080, 1);
    g.fillRect(0, top, 2, height);
    g.lineStyle(2, 0x16110c, 1);
    g.strokeRect(0, top, plate.depth, height);
    g.fillStyle(0xd2c2a4, 1);
    for (const y of [-plate.half * 0.55, 0, plate.half * 0.55]) {
      g.fillCircle(3, y, 2.4);
    }
    root.add(g);
  }

  private tankBounds(view: ViewState): { left: number; top: number; right: number; bottom: number } {
    const layout = Tank.layout;
    if (view.death && this.entity.death === 'nuke') {
      // Запас сверху и по бокам — под шапку гриба. Иначе взрыв обрезается краем холста.
      return {
        left: layout.hullX - Tank.doom.half - 24,
        top: layout.hullY - 12 - Tank.doom.rise - 48,
        right: layout.hullX + Tank.doom.half + 24,
        bottom: layout.hullY + TANK_WRECK_FRAME.h / 2,
      };
    }
    let left = layout.hullX - TANK_HULL_FRAME.w / 2;
    let right = layout.hullX + TANK_HULL_FRAME.w / 2;
    let top = layout.hullY - TANK_HULL_FRAME.h / 2;
    let bottom = layout.hullY + TANK_HULL_FRAME.h / 2;

    const box = { left, top, right, bottom };
    includeMounted(box, layout, TANK_TURRET_FRAME, layout.turretX, layout.turretY, layout.turretOriginX, layout.turretOriginY, view.angle);
    includeMounted(box, layout, TANK_GUN_FRAME, layout.gunX, layout.gunY, layout.gunOriginX, layout.gunOriginY, view.angle);
    left = box.left;
    right = box.right;
    top = box.top;
    bottom = box.bottom;
    if (view.muzzle) {
      const muzzle = Tank.muzzleAt(view.angle);
      const x = muzzle.x;
      const y = muzzle.y;
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
    if (view.death && this.entity.death === 'nuke') {
      return ['ядерный взрыв · обломки'];
    }
    if (view.death && this.entity.death === 'wreck') {
      return ['взрыв · обломки'];
    }
    if (view.death && this.entity.death === 'corpse') {
      return ['тело в крови'];
    }
    if (view.fire && this.entity.shot) {
      const motion =
        this.entity.frameCount > 1 && view.animate ? `${this.entity.motion ?? 'шаг'} · ` : '';
      return [`${motion}выстрел о стену · ${this.entity.shot.delay} мс`];
    }
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

  update(_time: number, delta: number): void {
    const rig = this.rig;
    if (rig && readView().fire) {
      rig.cooldown -= delta;
      if (rig.cooldown <= 0) {
        rig.cooldown = rig.delay;
        this.emitShot();
      }
      if (rig.gun && rig.recoil) {
        const scale = readView().scale;
        if (this.entity.id === 'gunner') {
          this.placeGunnerRifle(scale, rig);
        } else {
          this.placePickupGun(scale, rig);
        }
      }
    }
    const plate = rig?.plate;
    for (const fly of this.flies) {
      fly.image.x += (fly.vx * delta) / 1000;
      fly.image.y += (fly.vy * delta) / 1000;
      fly.life -= delta;
      if (!plate || !fly.image.active || !rig?.sparks) {
        continue;
      }
      // into < 0 — снаряд ещё не долетел до лица плиты. 0 — удар.
      const dx = fly.image.x - plate.x;
      const dy = fly.image.y - plate.y;
      const into = dx * Math.cos(plate.angle) + dy * Math.sin(plate.angle);
      const across = -dx * Math.sin(plate.angle) + dy * Math.cos(plate.angle);
      if (into < 0 || Math.abs(across) > plate.half) {
        continue;
      }
      const x = fly.image.x;
      const y = fly.image.y;
      fly.image.destroy();
      fly.life = 0;
      this.sparkOnPlate(x, y, rig.angle);
    }
    this.flies = this.flies.filter((fly) => {
      if (fly.life > 0 && fly.image.active) {
        return true;
      }
      if (fly.image.active) {
        fly.image.destroy();
      }
      return false;
    });
  }

  // Пикап в бою рисует ствол отдельно от кузова. Здесь то же самое, иначе откат не виден.
  private bakePickupBody(): void {
    this.dropPickupBody();
    const paint = this.paint as PickupPaint;
    this.bodyKeys = Array.from({ length: PickupTruck.wheelFrames }, (_, phase) => {
      const key = `studio-pickup-body-${phase}`;
      this.restamp(key, PICKUP_FRAME.w, PICKUP_FRAME.h, (g) => PickupTruck.render(g, phase, paint, false));
      return key;
    });
    this.restamp('studio-pickup-gun', PICKUP_GUN_FRAME.w, PICKUP_GUN_FRAME.h, (g) =>
      PickupTruck.renderGun(g, paint),
    );
    this.anims.create({
      key: 'studio-pickup-body',
      frames: this.bodyKeys.map((key) => ({ key })),
      frameRate: PickupTruck.driveFps,
      repeat: -1,
    });
  }

  private dropPickupBody(): void {
    if (this.anims.exists('studio-pickup-body')) {
      this.anims.remove('studio-pickup-body');
    }
    for (const key of [...this.bodyKeys, 'studio-pickup-gun']) {
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
    }
    this.bodyKeys = [];
  }

  private makePickup(view: ViewState): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0);
    const sprite = this.add.sprite(0, 0, this.bodyKeys[0]);
    sprite.setOrigin(this.entity.originX, this.entity.originY);
    sprite.setScale(view.scale);
    if (view.animate) {
      sprite.play('studio-pickup-body');
    }
    root.add(sprite);
    const gun = this.add.image(0, 0, 'studio-pickup-gun');
    gun.setOrigin(
      (PickupTruck.breech.x - PickupTruck.gunCut.x) / PICKUP_GUN_FRAME.w,
      (PickupTruck.breech.y - PickupTruck.gunCut.y) / PICKUP_GUN_FRAME.h,
    );
    gun.setScale(view.scale);
    root.add(gun);
    const guides = this.add.graphics();
    root.add(guides);
    this.paintSpriteGuides(guides, view);
    const recoil = { x: 0, climb: 0 };
    const pixel = this.pixel(view);
    this.arm(
      root,
      { x: this.entity.muzzle!.x * pixel, y: this.entity.muzzle!.y * pixel },
      Math.PI,
      pixel,
      { gun, recoil },
    );
    this.placePickupGun(view.scale, this.rig!);
    return root;
  }

  private placePickupGun(scale: number, rig: ShotRig): void {
    if (!rig.gun || !rig.recoil) {
      return;
    }
    const breechX = PickupTruck.breech.x + rig.recoil.x;
    const breechY = PickupTruck.breech.y;
    rig.gun.setPosition(
      (breechX - PickupTruck.placed.originX * PICKUP_FRAME.w) * scale,
      (breechY - PickupTruck.placed.originY * PICKUP_FRAME.h) * scale,
    );
    rig.gun.setRotation(rig.recoil.climb);
  }

  // Стрелок в бою рисует винтовку отдельно от тела. Здесь то же самое, иначе откат не виден.
  private bakeGunnerBody(): void {
    this.dropGunnerBody();
    const look = this.paint as SoldierLook;
    this.gunnerBodyKeys = ([0, 1] as const).map((phase) => {
      const key = `studio-gunner-body-${phase}`;
      this.restamp(key, SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        Infantry.drawSoldier(g, phase, look, false),
      );
      return key;
    });
    this.restamp('studio-gunner-rifle', GUNNER_RIFLE_FRAME.w, GUNNER_RIFLE_FRAME.h, (g) =>
      GunnerInfantry.renderRifle(g, look),
    );
    this.anims.create({
      key: 'studio-gunner-body',
      frames: this.gunnerBodyKeys.map((key) => ({ key })),
      frameRate: GunnerInfantry.walkFps,
      repeat: -1,
    });
  }

  private dropGunnerBody(): void {
    if (this.anims.exists('studio-gunner-body')) {
      this.anims.remove('studio-gunner-body');
    }
    for (const key of [...this.gunnerBodyKeys, 'studio-gunner-rifle']) {
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
    }
    this.gunnerBodyKeys = [];
  }

  private makeGunner(view: ViewState): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0);
    const sprite = this.add.sprite(0, 0, this.gunnerBodyKeys[0]);
    sprite.setOrigin(this.entity.originX, this.entity.originY);
    sprite.setScale(view.scale);
    if (view.animate) {
      sprite.play('studio-gunner-body');
    }
    root.add(sprite);
    const rifle = this.add.image(0, 0, 'studio-gunner-rifle');
    rifle.setOrigin(
      (GunnerInfantry.breech.x - GunnerInfantry.rifleCut.x) / GUNNER_RIFLE_FRAME.w,
      (GunnerInfantry.breech.y - GunnerInfantry.rifleCut.y) / GUNNER_RIFLE_FRAME.h,
    );
    rifle.setScale(view.scale);
    root.add(rifle);
    const guides = this.add.graphics();
    root.add(guides);
    this.paintSpriteGuides(guides, view);
    const recoil = { x: 0, climb: 0 };
    const pixel = this.pixel(view);
    this.arm(
      root,
      { x: this.entity.muzzle!.x * pixel, y: this.entity.muzzle!.y * pixel },
      Math.PI,
      pixel,
      { gun: rifle, recoil },
    );
    this.placeGunnerRifle(view.scale, this.rig!);
    return root;
  }

  private placeGunnerRifle(scale: number, rig: ShotRig): void {
    if (!rig.gun || !rig.recoil) {
      return;
    }
    const breechX = GunnerInfantry.breech.x + rig.recoil.x;
    const breechY = GunnerInfantry.breech.y;
    rig.gun.setPosition(
      (breechX - Infantry.placed.originX * SOLDIER_FRAME.w) * scale,
      (breechY - Infantry.placed.originY * SOLDIER_FRAME.h) * scale,
    );
    rig.gun.setRotation(rig.recoil.climb);
  }

  // Снаряд, пуля и вспышки. Цвета снаряда берутся из сохранённого просмотра этих картинок.
  private refreshFx(): void {
    const paintOf = (id: string) => loadPaint(ENTITIES.find((entry) => entry.id === id) ?? ENTITIES[0]);
    this.restamp('studio-fx-shell', SHELL_FRAME.w, SHELL_FRAME.h, (g) =>
      Tank.renderShell(g, paintOf('shell') as ShellPaint),
    );
    this.restamp('studio-fx-muzzle', MUZZLE_FRAME.w, MUZZLE_FRAME.h, (g) =>
      Tank.renderMuzzle(g, paintOf('muzzle') as MuzzlePaint),
    );
    this.restamp('studio-fx-bullet', BULLET_FRAME.w, BULLET_FRAME.h, (g) =>
      EnemyShot.render(g, paintOf('bullet') as BulletPaint),
    );
    this.restamp('studio-fx-pickup-flash', PICKUP_FLASH_FRAME.w, PICKUP_FLASH_FRAME.h, (g) =>
      PickupTruck.renderFlash(g),
    );
    this.restamp('studio-fx-gunner-flash', GUNNER_FLASH_FRAME.w, GUNNER_FLASH_FRAME.h, (g) =>
      GunnerInfantry.renderFlash(g),
    );
  }

  private restamp(
    key: string,
    width: number,
    height: number,
    draw: (g: Phaser.GameObjects.Graphics) => void,
  ): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    bake(this, key, width, height, draw);
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private pixel(view: ViewState): number {
    return this.entity.gameScale === 0 ? 1 : view.scale / this.entity.gameScale;
  }

  private arm(
    root: Phaser.GameObjects.Container,
    muzzle: { x: number; y: number },
    angle: number,
    pixel: number,
    extra?: Pick<ShotRig, 'pivot' | 'gun' | 'recoil'>,
  ): void {
    const shot = this.entity.shot;
    if (!shot) {
      return;
    }
    this.rig = {
      delay: shot.delay,
      cooldown: 0,
      root,
      angle,
      muzzle,
      speed: shot.speed,
      projectile: shot.projectile,
      flash: shot.flash,
      pixel,
      ...extra,
    };
    const plate = this.plateFor(readView());
    if (!plate) {
      return;
    }
    this.addPlate(root, plate);
    this.rig.plate = plate;
    this.rig.sparks = createArmorSparks(this);
  }

  // x, y — локальные координаты контейнера. Эмиттер стоит в мире и уменьшен масштабом сборки.
  private sparkOnPlate(x: number, y: number, travel: number): void {
    const rig = this.rig;
    if (!rig?.sparks) {
      return;
    }
    const scale = rig.sparks.scaleX || 1;
    rig.root.getWorldTransformMatrix().transformPoint(x, y, this.sparkPoint);
    emitArmorSparks(rig.sparks, this.sparkPoint.x / scale, this.sparkPoint.y / scale, travel);
  }

  private disarm(): void {
    if (this.rig?.recoil) {
      this.tweens.killTweensOf(this.rig.recoil);
    }
    if (this.rig?.pivot) {
      this.tweens.killTweensOf(this.rig.pivot);
    }
    if (this.rig?.gun && this.entity.kind === 'tank') {
      this.tweens.killTweensOf(this.rig.gun);
    }
    this.rig?.sparks?.destroy();
    this.rig = undefined;
    this.flies = [];
  }

  private emitShot(): void {
    const rig = this.rig;
    if (!rig) {
      return;
    }
    if (this.entity.kind === 'tank' && rig.gun) {
      const layout = Tank.layout;
      const angle = readView().angle;
      rig.angle = angle;
      const restX = layout.gunX - layout.seatX;
      rig.muzzle = Tank.muzzleAt(angle);
      this.tweens.killTweensOf(rig.gun);
      rig.gun.setPosition(restX, layout.gunY - layout.seatY);
      this.tweens.add({
        targets: rig.gun,
        x: restX - Tank.recoilSlide.kick,
        duration: Tank.recoilSlide.ms,
        yoyo: true,
      });
    }
    if (rig.recoil) {
      const kick = this.entity.id === 'gunner' ? GunnerInfantry.recoilKick : PickupTruck.recoilKick;
      this.tweens.killTweensOf(rig.recoil);
      rig.recoil.x = kick.x;
      rig.recoil.climb = kick.climb;
      this.tweens.add({
        targets: rig.recoil,
        x: 0,
        climb: 0,
        duration: kick.ms,
        ease: 'Quad.Out',
      });
    }
    const shot = this.add.image(
      rig.muzzle.x,
      rig.muzzle.y,
      rig.projectile === 'shell' ? 'studio-fx-shell' : 'studio-fx-bullet',
    );
    shot.setRotation(rig.angle);
    shot.setScale(rig.pixel);
    if (rig.projectile === 'shell') {
      shot.setBlendMode(Phaser.BlendModes.ADD);
    }
    rig.root.add(shot);
    this.flies.push({
      image: shot,
      vx: Math.cos(rig.angle) * rig.speed * rig.pixel,
      vy: Math.sin(rig.angle) * rig.speed * rig.pixel,
      life: 900,
    });
    this.spawnFlash(rig);
  }

  private spawnFlash(rig: ShotRig): void {
    if (rig.flash === 'muzzle') {
      const flash = this.add.image(rig.muzzle.x, rig.muzzle.y, 'studio-fx-muzzle');
      flash.setBlendMode(Phaser.BlendModes.ADD);
      flash.setRotation(rig.angle);
      rig.root.add(flash);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: Tank.muzzleFlash.scale,
        duration: Tank.muzzleFlash.ms,
        onComplete: () => flash.destroy(),
      });
      return;
    }
    if (rig.flash === 'pickup') {
      const pop = PickupTruck.flashPop;
      const flash = this.add.image(rig.muzzle.x, rig.muzzle.y, 'studio-fx-pickup-flash');
      flash.setOrigin(0, 0.5);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      flash.setRotation(rig.angle);
      flash.setScale(pop.x * rig.pixel, pop.y * rig.pixel);
      rig.root.add(flash);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: pop.ms,
        ease: 'Quad.In',
        onComplete: () => flash.destroy(),
      });
      return;
    }
    if (rig.flash === 'gunner') {
      const pop = GunnerInfantry.flashPop;
      const flash = this.add.image(rig.muzzle.x, rig.muzzle.y, 'studio-fx-gunner-flash');
      flash.setOrigin(0, 0.5);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      flash.setRotation(rig.angle);
      flash.setScale(pop.x * rig.pixel, pop.y * rig.pixel);
      rig.root.add(flash);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: pop.ms,
        ease: 'Quad.In',
        onComplete: () => flash.destroy(),
      });
    }
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
    this.disarm();
    this.clearDeathFx();
    this.holders.forEach((holder) => holder.destroy());
    this.holders = [];
    this.captions.forEach((caption) => caption.destroy());
    this.captions = [];
    if (this.liveAnim && this.anims.exists(this.liveAnim)) {
      this.anims.remove(this.liveAnim);
    }
    this.liveAnim = undefined;
    this.dropPickupBody();
    this.dropGunnerBody();
    for (const key of this.liveKeys) {
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
    }
    this.liveKeys = [];
  }

  private keysFor(entity: PreviewEntity): string[] {
    if (entity.kind === 'tank') {
      return ['studio-tank-hull', 'studio-tank-turret', 'studio-tank-gun'];
    }
    if (entity.frameCount > 1) {
      return Array.from({ length: entity.frameCount }, (_, index) => `studio-${entity.id}-${index}`);
    }
    return [`studio-${entity.id}`];
  }

  private publish(): void {
    const view = readView();
    const frame = this.frameOf(view);
    setSnippet(formatLook(this.entity.exportName, this.entity.defaults, this.paint));
    setStoredNote(localStorage.getItem(STORAGE + this.entity.id) !== null);
    setStatus(
      `${frame.w}×${frame.h} · масштаб ${view.scale.toFixed(2)} · зум ×${view.zoom.toFixed(1)}`,
    );
  }
}

// Габарит танка при угле башни по умолчанию. Мелкие выстрелы вписываются в это окно,
// чтобы пиксель текстуры на холсте совпадал с пикселем танка при том же увеличении.
function tankFrameSpan(): { w: number; h: number } {
  const layout = Tank.layout;
  const box = {
    left: layout.hullX - TANK_HULL_FRAME.w / 2,
    right: layout.hullX + TANK_HULL_FRAME.w / 2,
    top: layout.hullY - TANK_HULL_FRAME.h / 2,
    bottom: layout.hullY + TANK_HULL_FRAME.h / 2,
  };
  includeMounted(box, layout, TANK_TURRET_FRAME, layout.turretX, layout.turretY, layout.turretOriginX, layout.turretOriginY, -0.3);
  includeMounted(box, layout, TANK_GUN_FRAME, layout.gunX, layout.gunY, layout.gunOriginX, layout.gunOriginY, -0.3);
  return { w: box.right - box.left, h: box.bottom - box.top };
}

// Углы картинки, повёрнутой вместе с башней вокруг сиденья на крыше.
function includeMounted(
  box: { left: number; top: number; right: number; bottom: number },
  layout: typeof Tank.layout,
  frame: { w: number; h: number },
  imageX: number,
  imageY: number,
  originX: number,
  originY: number,
  angle: number,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (const ox of [-originX, 1 - originX]) {
    for (const oy of [-originY, 1 - originY]) {
      const lx = imageX - layout.seatX + ox * frame.w;
      const ly = imageY - layout.seatY + oy * frame.h;
      const rx = layout.seatX + lx * cos - ly * sin;
      const ry = layout.seatY + lx * sin + ly * cos;
      box.left = Math.min(box.left, rx);
      box.right = Math.max(box.right, rx);
      box.top = Math.min(box.top, ry);
      box.bottom = Math.max(box.bottom, ry);
    }
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

type ShotRig = {
  delay: number;
  cooldown: number;
  root: Phaser.GameObjects.Container;
  angle: number;
  muzzle: { x: number; y: number };
  speed: number;
  projectile: 'shell' | 'bullet';
  flash?: 'muzzle' | 'pickup' | 'gunner';
  pixel: number;
  pivot?: Phaser.GameObjects.Container;
  gun?: Phaser.GameObjects.Image;
  recoil?: { x: number; climb: number };
  plate?: Plate;
  sparks?: Phaser.GameObjects.Particles.ParticleEmitter;
};

type Plate = {
  x: number;
  y: number;
  angle: number;
  half: number;
  depth: number;
};

type Fly = {
  image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
};
