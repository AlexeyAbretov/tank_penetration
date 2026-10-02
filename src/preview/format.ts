// Текст константы для src/gfx/looks.ts. Порядок ключей — как в файле, не как в браузере.

export type Paint = Record<string, number | boolean>;

export function formatLook(name: string, defaults: Paint, paint: Paint): string {
  const lines = Object.keys(defaults).map((key) => {
    const value = paint[key];
    const shown = typeof value === 'boolean' ? String(value) : hex(value);
    return `  ${key}: ${shown},`;
  });
  return `export const ${name} = {\n${lines.join('\n')}\n};`;
}

function hex(value: number | boolean): string {
  const color = typeof value === 'number' ? value : 0;
  return `0x${color.toString(16).padStart(6, '0')}`;
}

export function cssHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export function parseHex(raw: string): number | null {
  const hex = raw.trim().replace(/^#/, '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  return Number.parseInt(hex, 16);
}
