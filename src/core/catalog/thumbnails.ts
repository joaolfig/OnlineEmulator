// Capas vêm do servidor de thumbnails do libretro (o mesmo usado pelo RetroArch).
// https://docs.libretro.com/guides/roms-playlists-thumbnails/#thumbnail-paths-and-filenames

const THUMBNAILS_BASE = 'https://thumbnails.libretro.com';

/** O libretro troca estes caracteres por "_" nos nomes de arquivo das capas. */
const FORBIDDEN = /[&*/:`<>?\\|"]/g;

export function boxArtUrl(system: string, gameName: string): string {
  const file = `${gameName.replace(FORBIDDEN, '_')}.png`;
  return `${THUMBNAILS_BASE}/${encodeURIComponent(system)}/Named_Boxarts/${encodeURIComponent(file)}`;
}

/** "Mario Party 2 (USA) (Rev 1)" → { title: "Mario Party 2", tags: "USA · Rev 1" } */
export function splitGameName(name: string): { title: string; tags: string } {
  const tags = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' · ');
  const title = name.replace(/\s*\([^)]*\)/g, '').trim();
  return { title: title || name, tags };
}

/** Iniciais para a capa genérica: "Mario Party 2" → "MP2". */
export function initials(title: string): string {
  return (
    title
      .split(/[\s\-:]+/)
      .filter(Boolean)
      .map((word) => (/^\d+$/.test(word) ? word : word[0]))
      .join('')
      .slice(0, 3)
      .toUpperCase() || '?'
  );
}
