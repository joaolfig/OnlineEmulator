import { useEffect, useState } from 'preact/hooks';
import { n64BoxArtUrl } from '../../adapters/catalog/n64Catalog';
import { initials } from '../../core/catalog/thumbnails';

interface Props {
  readonly title: string;
  readonly catalogName: string | null | undefined;
  /** Capa escolhida pelo usuário (tem prioridade sobre a do catálogo). */
  readonly custom: Blob | undefined;
}

/** Capa do jogo: personalizada > catálogo do libretro > iniciais. */
export function Cover({ title, catalogName, custom }: Props) {
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!custom) return setCustomUrl(null);
    const url = URL.createObjectURL(custom);
    setCustomUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [custom]);

  useEffect(() => setFailed(false), [catalogName, customUrl]);

  const src = customUrl ?? (catalogName ? n64BoxArtUrl(catalogName) : null);
  if (!src || failed) {
    return (
      <div class="cover cover-placeholder" aria-hidden="true">
        {initials(title)}
      </div>
    );
  }
  return (
    <img
      class="cover"
      src={src}
      alt={`Capa de ${title}`}
      loading="lazy"
      referrerpolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
