// Build-time only: loads a font from public/fonts on disk so pages can render lettering as static SVG.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadFont, type FontKey, type LoadedFont } from './fontshape';

export function loadFontFromDisk(key: FontKey): Promise<LoadedFont> {
  return loadFont(key, async (url) => {
    const b = await readFile(join(process.cwd(), 'public', url));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  });
}
