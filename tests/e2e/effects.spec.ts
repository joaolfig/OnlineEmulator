import { expect, test, type Page } from '@playwright/test';

const toggle = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

// Efeitos visuais são escolha de cada aparelho (vários ao mesmo tempo) e não mudam nada nos outros.
test('convidado e host ligam efeitos visuais, inclusive os três juntos, sem erro', async ({ browser }) => {
  const errors: string[] = [];
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  for (const page of [host, guest]) {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  }

  await host.goto('host.html');
  await host.getByRole('button', { name: 'Modo teste (sem ROM)' }).click();
  const roomCode = host.getByTestId('room-code');
  await expect(roomCode).toHaveText(/^[A-Z2-9]{6}$/, { timeout: 30_000 });

  await guest.goto(`play.html?r=${(await roomCode.textContent()) ?? ''}`);
  await guest.getByLabel('Seu nome').fill('Ana');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await expect(guest.getByTestId('who')).toHaveText('Você é o P2', { timeout: 30_000 });

  // Começa sem efeito; o painel abre pelo botão ✨.
  await expect(guest.getByTestId('effect-layer')).toHaveCount(0);
  await guest.getByRole('button', { name: 'Efeitos visuais' }).click();
  for (const name of ['Inclinação dinâmica', 'TV de tubo', 'Relevo com luz']) {
    await toggle(guest, name);
    // Sempre um único desenho, com quantos efeitos estiverem ligados.
    await expect(guest.getByTestId('effect-layer').locator('canvas')).toHaveCount(1, { timeout: 15_000 });
  }
  expect(await guest.evaluate(() => localStorage.getItem('onlemu:effects'))).toBe('tilt,crt,relief');
  for (const name of ['Inclinação dinâmica', 'TV de tubo', 'Relevo com luz']) await toggle(guest, name);
  await expect(guest.getByTestId('effect-layer')).toHaveCount(0);

  // O host não foi afetado; ele liga os dele.
  await expect(host.getByTestId('effect-layer')).toHaveCount(0);
  await toggle(host, 'TV de tubo');
  await expect(host.getByTestId('effect-layer').locator('canvas')).toHaveCount(1, { timeout: 15_000 });

  expect(errors).toEqual([]);
});
