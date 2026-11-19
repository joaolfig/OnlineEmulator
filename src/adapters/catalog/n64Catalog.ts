import { boxArtUrl } from '../../core/catalog/thumbnails';
import { toZ64 } from '../../core/rom/n64';
import { sha1Hex } from '../storage/hash';

const SYSTEM = 'Nintendo - Nintendo 64';

let catalog: Promise<Readonly<Record<string, string>>> | null = null;

/** O catálogo (~100 KB) só é baixado quando alguém precisa identificar um jogo. */
function loadCatalog(): Promise<Readonly<Record<string, string>>> {
  catalog ??= import('../../data/n64-catalog.json').then((m) => m.default.games);
  return catalog;
}

/** Nome oficial (No-Intro) da ROM, ou null se não for N64 ou não estiver no catálogo. */
export async function identifyN64Rom(rom: Blob): Promise<string | null> {
  const z64 = toZ64(new Uint8Array(await rom.arrayBuffer()));
  if (!z64) return null;
  const [games, hash] = await Promise.all([loadCatalog(), sha1Hex(z64)]);
  return games[hash] ?? null;
}

export const n64BoxArtUrl = (catalogName: string): string => boxArtUrl(SYSTEM, catalogName);
