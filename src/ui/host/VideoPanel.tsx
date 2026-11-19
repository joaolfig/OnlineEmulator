import { useEffect, useRef, useState } from 'preact/hooks';
import type { HostSession } from '../../app/host/hostSession';
import { config } from '../../config';
import { t } from '../strings';

export function VideoPanel({ session, stream }: { session: HostSession; stream: MediaStream }) {
  const settings = session.videoSettings.value;
  const [showPreview, setShowPreview] = useState(true);
  const video = useRef<HTMLVideoElement>(null);

  // Desligado, o preview não consome nada: o <video> fica sem stream.
  useEffect(() => {
    if (video.current) video.current.srcObject = showPreview ? stream : null;
  }, [showPreview, stream]);

  return (
    <section class="panel stack">
      <h2>{t.host.video}</h2>
      <div class="row">
        <label class="check">
          {t.host.bitrate}
          <select
            value={String(settings.maxBitrate)}
            onChange={(e) =>
              session.setVideoSettings({ ...settings, maxBitrate: Number(e.currentTarget.value) })
            }
          >
            {config.video.bitrateOptions.map((b) => (
              <option key={b} value={String(b)}>
                {(b / 1_000_000).toLocaleString('pt-BR')} Mbps
              </option>
            ))}
          </select>
        </label>
        <label class="check">
          {t.host.fps}
          <select
            value={String(settings.maxFramerate)}
            onChange={(e) =>
              session.setVideoSettings({ ...settings, maxFramerate: Number(e.currentTarget.value) })
            }
          >
            {config.video.fpsOptions.map((fps) => (
              <option key={fps} value={String(fps)}>
                {fps}
              </option>
            ))}
          </select>
        </label>
        <label class="check muted">
          <input
            type="checkbox"
            checked={showPreview}
            onChange={(e) => setShowPreview(e.currentTarget.checked)}
          />
          {t.host.showPreview}
        </label>
      </div>
      <video
        ref={video}
        class="screen"
        hidden={!showPreview}
        muted
        playsInline
        autoplay
        aria-label={t.host.preview}
      />
    </section>
  );
}
