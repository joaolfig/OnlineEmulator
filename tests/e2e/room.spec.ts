import { expect, test } from '@playwright/test';

// Fluxo completo com WebRTC real (via servidor público do PeerJS) e o emulador falso do modo teste,
// para não precisar de ROM no CI.
test('convidado entra na sala, recebe vídeo, controla o P2 e pode virar P1', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto('host.html');
  await host.getByRole('button', { name: 'Modo teste (sem ROM)' }).click();
  const roomCode = host.getByTestId('room-code');
  await expect(roomCode).toHaveText(/^[A-Z2-9]{6}$/, { timeout: 30_000 });
  const code = (await roomCode.textContent()) ?? '';

  await guest.goto(`play.html?r=${code}`);
  await guest.getByLabel('Seu nome').fill('Convidado');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await expect(guest.getByTestId('who')).toHaveText('Você é o P2', { timeout: 30_000 });

  // O vídeo do host chega e toca.
  await expect
    .poll(() => guest.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 })
    .toBeGreaterThan(0);

  // O host vê o convidado na lista e troca ele para o P1.
  await expect(host.getByTestId('players')).toContainText('Convidado');
  await host.getByLabel('Porta de Convidado').selectOption({ label: 'P1' });
  await expect(guest.getByTestId('who')).toHaveText('Você é o P1');

  await hostContext.close();
  await guestContext.close();
});

test('celular "só controle" ganha porta sem receber vídeo; aparelho "só assistir" vira tela', async ({
  browser,
}) => {
  const host = await (await browser.newContext()).newPage();
  await host.goto('host.html');
  await host.getByRole('button', { name: 'Modo teste (sem ROM)' }).click();
  const roomCode = host.getByTestId('room-code');
  await expect(roomCode).toHaveText(/^[A-Z2-9]{6}$/, { timeout: 30_000 });
  const code = (await roomCode.textContent()) ?? '';

  const join = async (name: string, mode: string) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`play.html?r=${code}`);
    await page.getByLabel('Seu nome').fill(name);
    await page.getByRole('radio', { name: new RegExp(mode) }).check();
    await page.getByRole('button', { name: 'Entrar' }).click();
    return page;
  };

  const phone = await join('Celular', 'Só controle');
  await expect(phone.getByTestId('who')).toHaveText('Você é o P2', { timeout: 30_000 });
  await expect(phone.locator('video')).toHaveCount(0);

  const tv = await join('TV', 'Só assistir');
  await expect(tv.getByTestId('who')).toHaveText('Espectador', { timeout: 30_000 });
  await expect
    .poll(() => tv.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 })
    .toBeGreaterThan(0);

  await expect(host.getByTestId('players')).toContainText('só controle');
  await expect(host.getByTestId('players')).toContainText('tela');
});
