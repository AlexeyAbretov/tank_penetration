// Панель справа и список слева. Холст Phaser их не рисует: это обычный HTML поверх страницы.

import { ENTITIES, type PreviewEntity } from './catalog';
import { cssHex, parseHex, type Paint } from './format';

export type ViewState = {
  zoom: number;
  scale: number;
  animate: boolean;
  checker: boolean;
  bounds: boolean;
  hitbox: boolean;
  origin: boolean;
  hp: boolean;
  muzzle: boolean;
  fire: boolean;
  machineGun: boolean;
  death: boolean;
  addBlend: boolean;
  angle: number;
  rotation: number;
  // 1 — тряска как в бою, 0 — танк стоит.
  shake: number;
};

export type PanelHandlers = {
  select: (id: string) => void;
  paint: (key: string, value: number | boolean) => void;
  view: () => void;
  layout: () => void;
  reset: () => void;
  copy: () => void;
};

let bound = false;
let panelHandlers: PanelHandlers | undefined;

export function bindPanel(handlers: PanelHandlers): void {
  panelHandlers = handlers;
  if (bound) {
    return;
  }
  bound = true;

  const list = document.getElementById('list');
  if (!list) {
    return;
  }
  for (const entity of ENTITIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = entity.id;
    button.textContent = entity.title;
    button.addEventListener('click', () => panelHandlers?.select(entity.id));
    list.append(button);
  }

  const onZoom = () => {
    writeReadouts();
    panelHandlers?.layout();
  };
  document.getElementById('zoom')?.addEventListener('input', onZoom);
  document.getElementById('zoom')?.addEventListener('change', onZoom);
  document.getElementById('shake')?.addEventListener('input', () => writeReadouts());
  for (const id of ['scale', 'animate', 'checker', 'bounds', 'hitbox', 'origin', 'hp', 'muzzle', 'fire', 'machinegun', 'death', 'add', 'angle', 'spin']) {
    document.getElementById(id)?.addEventListener('input', () => {
      writeReadouts();
      panelHandlers?.view();
    });
  }

  document.getElementById('reset')?.addEventListener('click', () => panelHandlers?.reset());
  document.getElementById('copy')?.addEventListener('click', () => panelHandlers?.copy());

  const stage = document.getElementById('stage');
  stage?.addEventListener(
    'wheel',
    (event) => {
      if (!nudgeZoom(event.deltaY)) {
        return;
      }
      event.preventDefault();
      onZoom();
    },
    { passive: false },
  );
}

export function markActive(id: string): void {
  document.querySelectorAll<HTMLButtonElement>('#list button').forEach((button) => {
    button.classList.toggle('active', button.dataset.id === id);
  });
}

export function configureView(entity: PreviewEntity): void {
  show('animate-row', entity.frameCount > 1);
  show('hitbox-row', entity.kind === 'tank' || entity.hitbox !== undefined);
  show('hp-row', entity.hpColor !== undefined);
  show('muzzle-row', entity.kind === 'tank' || entity.muzzle !== undefined);
  show('fire-row', entity.shot !== undefined);
  show('machinegun-row', entity.kind === 'tank');
  show('death-row', entity.death !== undefined);
  const death = document.getElementById('death') as HTMLInputElement | null;
  if (death) {
    death.checked = false;
  }
  show('add-row', Boolean(entity.addBlend));
  show('angle-row', entity.kind === 'tank');
  show('shake-row', entity.kind === 'tank');
  show('spin-row', entity.kind === 'shot');

  const scale = document.getElementById('scale') as HTMLInputElement | null;
  const game = document.getElementById('scale-game');
  if (scale) {
    scale.value = String(entity.gameScale);
  }
  if (game) {
    game.textContent = `в игре ${entity.gameScale}`;
  }
  const angle = document.getElementById('angle') as HTMLInputElement | null;
  if (angle) {
    angle.value = '-0.3';
  }
  const shake = document.getElementById('shake') as HTMLInputElement | null;
  if (shake) {
    shake.value = '1';
  }
  const spin = document.getElementById('spin') as HTMLInputElement | null;
  if (spin) {
    spin.value = '0';
  }
  writeReadouts();
}

export function renderFields(
  entity: PreviewEntity,
  paint: Paint,
  onChange: (key: string, value: number | boolean) => void,
): void {
  const root = document.getElementById('fields');
  if (!root) {
    return;
  }
  root.replaceChildren();
  let group = '';
  for (const field of entity.fields) {
    if (field.group !== group) {
      group = field.group;
      const title = document.createElement('h3');
      title.textContent = group;
      root.append(title);
    }
    root.append(field.kind === 'color' ? colorRow(field, paint, onChange) : boolRow(field, paint, onChange));
  }
}

export function readView(): ViewState {
  return {
    zoom: num('zoom', 1),
    scale: num('scale', 1),
    animate: checked('animate'),
    checker: checked('checker'),
    bounds: checked('bounds'),
    hitbox: checked('hitbox'),
    origin: checked('origin'),
    hp: checked('hp'),
    muzzle: checked('muzzle'),
    fire: checked('fire'),
    machineGun: checked('machinegun'),
    death: checked('death'),
    addBlend: checked('add'),
    angle: num('angle', -0.3),
    rotation: num('spin', 0),
    shake: num('shake', 1),
  };
}

export function setSnippet(text: string): void {
  const node = document.getElementById('snippet');
  if (node) {
    node.textContent = text;
  }
}

export function setStatus(text: string): void {
  const node = document.getElementById('status');
  if (node) {
    node.textContent = text;
  }
}

export function setHint(text: string): void {
  const node = document.getElementById('hint');
  if (node) {
    node.textContent = text;
  }
}

export function setStoredNote(stored: boolean): void {
  const node = document.getElementById('stored');
  if (node) {
    node.hidden = !stored;
  }
}

export async function copySnippet(): Promise<boolean> {
  const text = document.getElementById('snippet')?.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    document.getElementById('code')?.setAttribute('open', '');
    return false;
  }
}

export function flashCopy(ok: boolean): void {
  const button = document.getElementById('copy');
  if (!button) {
    return;
  }
  button.textContent = ok ? 'Скопировано' : 'Открыл код ниже';
  window.setTimeout(() => {
    button.textContent = 'Копировать';
  }, 1200);
}

function colorRow(
  field: { key: string; label: string },
  paint: Paint,
  onChange: (key: string, value: number | boolean) => void,
): HTMLLabelElement {
  const raw = paint[field.key];
  const value = typeof raw === 'number' ? raw : 0;
  const row = document.createElement('label');
  row.className = 'row';
  const name = document.createElement('span');
  name.textContent = field.label;
  const color = document.createElement('input');
  color.type = 'color';
  color.value = cssHex(value);
  const text = document.createElement('input');
  text.type = 'text';
  text.spellcheck = false;
  text.value = cssHex(value).slice(1);
  const emit = (next: number) => {
    color.value = cssHex(next);
    text.value = cssHex(next).slice(1);
    onChange(field.key, next);
  };
  color.addEventListener('input', () => {
    const next = parseHex(color.value);
    if (next !== null) {
      text.value = cssHex(next).slice(1);
      onChange(field.key, next);
    }
  });
  text.addEventListener('input', () => {
    const next = parseHex(text.value);
    if (next !== null) {
      color.value = cssHex(next);
      onChange(field.key, next);
    }
  });
  text.addEventListener('change', () => {
    const next = parseHex(text.value);
    if (next !== null) {
      emit(next);
    } else {
      text.value = cssHex(value).slice(1);
    }
  });
  row.append(name, color, text);
  return row;
}

function boolRow(
  field: { key: string; label: string },
  paint: Paint,
  onChange: (key: string, value: number | boolean) => void,
): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = paint[field.key] === true;
  box.addEventListener('input', () => onChange(field.key, box.checked));
  const name = document.createElement('span');
  name.textContent = field.label;
  row.append(box, name);
  return row;
}

export function writeReadouts(): void {
  const zoom = document.getElementById('zoom') as HTMLInputElement | null;
  const zoomVal = document.getElementById('zoom-val');
  if (zoom && zoomVal) {
    zoomVal.textContent = `×${Number(zoom.value).toFixed(1)}`;
  }
  const scale = document.getElementById('scale') as HTMLInputElement | null;
  const scaleVal = document.getElementById('scale-val');
  if (scale && scaleVal) {
    scaleVal.textContent = Number(scale.value).toFixed(2);
  }
  const angle = document.getElementById('angle') as HTMLInputElement | null;
  const angleVal = document.getElementById('angle-val');
  if (angle && angleVal) {
    angleVal.textContent = angleText(Number(angle.value));
  }
  const spin = document.getElementById('spin') as HTMLInputElement | null;
  const spinVal = document.getElementById('spin-val');
  if (spin && spinVal) {
    spinVal.textContent = angleText(Number(spin.value));
  }
  const shake = document.getElementById('shake') as HTMLInputElement | null;
  const shakeVal = document.getElementById('shake-val');
  if (shake && shakeVal) {
    shakeVal.textContent = `×${Number(shake.value).toFixed(1)}`;
  }
}

function angleText(radians: number): string {
  const degrees = Math.round((radians * 180) / Math.PI);
  return `${radians.toFixed(2)} (${degrees}°)`;
}

function show(id: string, visible: boolean): void {
  const node = document.getElementById(id);
  if (node) {
    node.hidden = !visible;
  }
}

function num(id: string, fallback: number): number {
  const input = document.getElementById(id) as HTMLInputElement | null;
  const value = input ? Number(input.value) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

function checked(id: string): boolean {
  const input = document.getElementById(id) as HTMLInputElement | null;
  return Boolean(input?.checked);
}

// Колёсико над холстом: вверх — ближе, вниз — дальше. Шаг как у ползунка.
export function nudgeZoom(deltaY: number): boolean {
  const zoom = document.getElementById('zoom') as HTMLInputElement | null;
  if (!zoom || deltaY === 0) {
    return false;
  }
  const step = Number(zoom.step) || 0.05;
  const min = Number(zoom.min);
  const max = Number(zoom.max);
  const current = Number(zoom.value);
  const next = Math.min(max, Math.max(min, current + (deltaY < 0 ? step : -step)));
  if (next === current) {
    return false;
  }
  zoom.value = String(next);
  return true;
}
