// Автострельба партии. Танк про неё не знает: бой сам решает, звать ли выстрел без ЛКМ.
// Покупка одна на партию. Кнопка у шестерёнки включает и выключает уже купленный режим.

export class AutoFire {
  static readonly shop = {
    cost: 1,
  };

  private owned = false;
  private switchedOn = false;

  get isOwned(): boolean {
    return this.owned;
  }

  // Стреляет сам, только когда покупка есть и кнопка включена.
  get enabled(): boolean {
    return this.owned && this.switchedOn;
  }

  // Свежая покупка сразу включена.
  grant(): void {
    this.owned = true;
    this.switchedOn = true;
  }

  restore(owned: boolean, enabled: boolean): void {
    this.owned = owned;
    this.switchedOn = owned && enabled;
  }

  clear(): void {
    this.owned = false;
    this.switchedOn = false;
  }

  toggle(): void {
    if (!this.owned) {
      return;
    }
    this.switchedOn = !this.switchedOn;
  }
}
