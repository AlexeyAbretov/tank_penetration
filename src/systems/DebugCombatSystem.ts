// Дебаг-бой. Те же выстрелы, но двойное нажатие кнопки способности сбрасывает перезарядку.
// Второе нажатие за короткое окно удар не вызывает. После сброса окно пустое.
// Двойной щелчок по РСЗО, лазеру или танку глушит и снова включает их стрельбу.
// У танка вместе с пушкой замолкает пулемёт. Щелчок по машине сам выстрел не даёт.

import Phaser from 'phaser';
import { HitboxOverlay } from '../debug/HitboxOverlay';
import { CombatSystem } from './CombatSystem';

const DOUBLE_MS = 400;

type AbilityTap = 'artillery' | 'mines' | 'nuclear';
type WeaponTap = 'tank' | 'laser' | 'salvo';

export class DebugCombatSystem extends CombatSystem {
  private readonly tappedAt: Record<AbilityTap, number> = {
    artillery: -1,
    mines: -1,
    nuclear: -1,
  };
  private readonly weaponAt: Record<WeaponTap, number> = {
    tank: -1,
    laser: -1,
    salvo: -1,
  };
  // true — эта стрельба молчит. Пушка и пулемёт делят один флаг танка.
  private readonly silenced: Record<WeaponTap, boolean> = {
    tank: false,
    laser: false,
    salvo: false,
  };
  // Зажатая кнопка началась на машине: пока её не отпустили, ЛКМ не стреляет.
  private blockShot = false;

  protected override afterConstruct(): void {
    new HitboxOverlay(this.scene, this.infantry);
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      this.onWeaponDown(pointer);
    };
    const onUp = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.button === 0) {
        this.blockShot = false;
      }
    };
    this.scene.input.on('pointerdown', onDown);
    this.scene.input.on('pointerup', onUp);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.input.off('pointerdown', onDown);
      this.scene.input.off('pointerup', onUp);
    });
  }

  override tick(delta: number, allowFire = true): void {
    super.tick(delta, allowFire);
    this.tank.setQuiet(this.silenced.tank);
    this.shop.machineGun?.setQuiet(this.silenced.tank);
    this.shop.laser?.setQuiet(this.silenced.laser);
    this.shop.salvo?.setQuiet(this.silenced.salvo);
  }

  protected override weaponLive(kind: WeaponTap): boolean {
    return !this.silenced[kind];
  }

  protected override handleFireInput(pointer: Phaser.Input.Pointer): void {
    if (this.blockShot && !this.shop.autoFire.enabled) {
      return;
    }
    super.handleFireInput(pointer);
  }

  private onWeaponDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0 || this.scene.registry.get('combat') !== true) {
      return;
    }
    if (this.scene.time.paused || this.scene.input.hitTestPointer(pointer).length > 0) {
      return;
    }
    const weapon = this.weaponUnder(pointer.worldX, pointer.worldY);
    if (!weapon) {
      return;
    }
    this.blockShot = true;
    const now = performance.now();
    const last = this.weaponAt[weapon];
    const doubled = last >= 0 && now - last <= DOUBLE_MS;
    this.weaponAt[weapon] = doubled ? -1 : now;
    if (doubled) {
      this.silenced[weapon] = !this.silenced[weapon];
    }
  }

  // РСЗО рисуется над танком, лазер — под ним. Сначала верхняя установка, потом корпус, потом лазер.
  private weaponUnder(x: number, y: number): WeaponTap | null {
    const salvo = this.shop.salvo;
    if (salvo?.visible && salvo.containsPoint(x, y)) {
      return 'salvo';
    }
    if (this.tank.containsPoint(x, y)) {
      return 'tank';
    }
    const laser = this.shop.laser;
    if (laser?.visible && laser.containsPoint(x, y)) {
      return 'laser';
    }
    return null;
  }

  protected override useArtillery(canFire: boolean): void {
    if (this.resetsCooldown('artillery', this.artilleryCooldown > 0)) {
      this.setArtilleryCooldown(0);
      return;
    }
    super.useArtillery(canFire);
  }

  protected override useMines(canFire: boolean): void {
    if (this.resetsCooldown('mines', this.minesCooldown > 0)) {
      this.setMinesCooldown(0);
      return;
    }
    super.useMines(canFire);
  }

  protected override useNuclear(canFire: boolean): void {
    if (this.resetsCooldown('nuclear', this.nuclearCooldown > 0)) {
      this.setNuclearCooldown(0);
      return;
    }
    super.useNuclear(canFire);
  }

  private resetsCooldown(ability: AbilityTap, cooling: boolean): boolean {
    const now = performance.now();
    const last = this.tappedAt[ability];
    const doubled = last >= 0 && now - last <= DOUBLE_MS;
    if (doubled && cooling) {
      this.tappedAt[ability] = -1;
      return true;
    }
    this.tappedAt[ability] = now;
    return false;
  }
}
