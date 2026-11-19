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
