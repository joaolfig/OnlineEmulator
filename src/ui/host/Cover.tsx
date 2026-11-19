import { useEffect, useState } from 'preact/hooks';
import { initials } from '../../core/catalog/thumbnails';

interface Props {
  readonly title: string;
  /** Capa do catálogo do libretro, quando houver. */
  readonly url: string | null;
  /** Capa escolhida pelo usuário (tem prioridade sobre a do catálogo). */
  readonly custom: Blob | undefined;
}

/** Capa do jogo: personalizada > catálogo do libretro > iniciais. */
export function Cover({ title, url, custom }: Props) {
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!custom) return setCustomUrl(null);
    const objectUrl = URL.createObjectURL(custom);
    setCustomUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [custom]);

  useEffect(() => setFailed(false), [url, customUrl]);

  const src = customUrl ?? url;
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
