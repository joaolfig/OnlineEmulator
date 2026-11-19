import { useEffect, useState } from 'preact/hooks';
import { initials } from '../../core/catalog/thumbnails';

interface Props {
  readonly title: string;
  /** Capa do catálogo do libretro, quando houver. */
  readonly url: string | null;
}

/** Capa do jogo: a do catálogo do libretro ou, sem ela, as iniciais do título. */
export function Cover({ title, url }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <div class="cover cover-placeholder" aria-hidden="true">
        {initials(title)}
      </div>
    );
  }
  return (
    <img
      class="cover"
      src={url}
      alt={`Capa de ${title}`}
      loading="lazy"
      referrerpolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
