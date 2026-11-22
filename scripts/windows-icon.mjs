// Собирает icon.ico из PNG игры. В репозитории ICO нет: обе Windows-сборки делают его сами.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function writeWindowsIcon(pngPath, icoPath) {
  const png256 = path.join(tmpdir(), `tank-penetration-icon-${process.pid}.png`);
  execFileSync(
    'ffmpeg',
    ['-y', '-hide_banner', '-loglevel', 'error', '-i', pngPath, '-vf', 'scale=256:256', png256],
    { stdio: 'inherit' },
  );
  const png = readFileSync(png256);
  rmSync(png256, { force: true });
  // Байт ширины 0 в каталоге ICO значит 256. Внутри PNG: так Windows читает иконку с Vista.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);
  entry.writeUInt8(0, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  mkdirSync(path.dirname(icoPath), { recursive: true });
  writeFileSync(icoPath, Buffer.concat([header, entry, png]));
}
