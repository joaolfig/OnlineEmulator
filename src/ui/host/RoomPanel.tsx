import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'preact/hooks';
import type { HostSession } from '../../app/host/hostSession';
import { t } from '../strings';

/** Link para o convidado. Em desenvolvimento, ?lan=IP:porta troca o host do link (para testar no celular). */
function guestLink(code: string): string {
  const lan = import.meta.env.DEV ? new URLSearchParams(location.search).get('lan') : null;
  const base = new URL('play.html', location.href);
  if (lan) base.host = lan;
  base.searchParams.set('r', code);
  return base.toString();
}

export function RoomPanel({ session }: { session: HostSession }) {
  const code = session.roomCode.value;
  const status = session.status.value;
  const link = useMemo(() => (code ? guestLink(code) : null), [code]);
  const qrUrl = useMemo(() => {
    if (!link) return null;
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    return qr.createDataURL(4, 2);
  }, [link]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section class="panel stack">
      <h2>{t.host.room}</h2>
      {status === 'opening' && <p class="muted">{t.host.openingRoom}</p>}
      {status === 'error' && <p class="err">{t.host.roomError}</p>}
      {code && link && (
        <>
          <div class="room-code mono" data-testid="room-code">
            {code}
          </div>
          <p class="muted">{t.host.shareLink}</p>
          <div class="row">
            <a href={link} target="_blank" rel="noopener">
              {link}
            </a>
            <button onClick={() => void copy()}>{copied ? t.host.copied : t.host.copy}</button>
          </div>
          {qrUrl && <img class="qr" src={qrUrl} alt="QR code do link da sala" />}
        </>
      )}
    </section>
  );
}
