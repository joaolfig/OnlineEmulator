import { boxArtUrl } from '../../core/catalog/thumbnails';
import { thumbnailSystem } from '../emulator/systems';
import { romSystem, type RomMeta } from '../storage/romLibrary';

/**
 * Capa da ROM no servidor do libretro. No N64 usa o nome oficial do catálogo; nos outros consoles,
 * o nome do arquivo (funciona quando a ROM tem o nome padrão, ex.: "Super Mario World (USA).sfc").
 */
export function romBoxArtUrl(meta: RomMeta): string | null {
  const system = romSystem(meta);
  const name = meta.catalogName ?? (system.layout === 'n64' ? null : meta.name);
  return name ? boxArtUrl(thumbnailSystem(system, meta.fileName), name) : null;
}
