import { expect, test } from '@playwright/test';

test('convidado escolhe boneco e manda reação pelo teclado; host e convidado veem o balão', async ({
  browser,
}) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('host.html?teste');
  await host.getByRole('button', { name: 'Modo teste (sem ROM)' }).click();
  const roomCode = host.getByTestId('room-code');
  await expect(roomCode).toHaveText(/^[A-Z2-9]{6}$/, { timeout: 30_000 });

  await guest.goto(`play.html?r=${(await roomCode.textContent()) ?? ''}`);
  await guest.getByLabel('Seu nome').fill('Ana');
  await guest.getByRole('button', { name: 'Boneco 🦖' }).click();
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await expect(guest.getByTestId('who')).toHaveText('Você é o P2', { timeout: 30_000 });

  // O host vê o boneco na lista de jogadores.
  await expect(host.getByTestId('players')).toContainText('🦖');

  // Tecla ` abre as reações; 1 manda a primeira ("Kkkkkk").
  await guest.keyboard.press('Backquote');
  await expect(guest.getByRole('menu')).toBeVisible();
  await guest.keyboard.press('Digit1');
  await expect(guest.getByRole('menu')).toHaveCount(0);

  for (const page of [host, guest]) {
    const bubble = page.locator('.reaction-bubble').first();
    await expect(bubble).toContainText('🦖');
    await expect(bubble).toContainText('Ana');
    await expect(bubble).toContainText('Kkkkkk');
  }
});
