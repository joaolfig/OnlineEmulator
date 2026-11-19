// Gera src/data/n64-catalog.json (SHA-1 da ROM em ordem .z64 → nome oficial No-Intro)
// a partir do banco de dados do libretro. Uso: npm run catalog:update
//
// Fonte: https://github.com/libretro/libretro-database (CC-BY-SA-4.0)

import { writeFile } from 'node:fs/promises';

const SOURCE_URL =
  'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/no-intro/Nintendo%20-%20Nintendo%2064.dat';
const OUTPUT = new URL('../src/data/n64-catalog.json', import.meta.url);

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Falha ao baixar o catálogo: HTTP ${response.status}`);
const dat = await response.text();

const version = /^\s*version "([^"]+)"/m.exec(dat)?.[1] ?? 'desconhecida';
const games = {};
// Cada entrada: game ( name "..." ... rom ( name "....z64" ... sha1 XXXX ... ) )
for (const block of dat.split(/^game \(/m).slice(1)) {
  const name = /^\s*name "([^"]+)"/m.exec(block)?.[1];
  const rom = /rom \( name "[^"]+\.z64" .*?sha1 ([0-9A-F]{40})/.exec(block);
  if (name && rom?.[1]) games[rom[1].toLowerCase()] = name;
}

const count = Object.keys(games).length;
if (count < 500) throw new Error(`Catálogo suspeito: só ${count} jogos encontrados`);

const catalog = {
  source: 'https://github.com/libretro/libretro-database',
  license: 'CC-BY-SA-4.0',
  version,
  games: Object.fromEntries(Object.entries(games).sort(([a], [b]) => a.localeCompare(b))),
};
await writeFile(OUTPUT, `${JSON.stringify(catalog)}\n`);
console.log(`Catálogo N64 ${version}: ${count} jogos → ${OUTPUT.pathname}`);
