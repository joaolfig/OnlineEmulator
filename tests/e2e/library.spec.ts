import { expect, test } from '@playwright/test';

test('a biblioteca não mostra o modo teste (só existe para os testes automáticos)', async ({ page }) => {
  await page.goto('host.html');
  await expect(page.getByRole('button', { name: 'Adicionar ROM' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Modo teste/ })).toHaveCount(0);
  await expect(page.getByText(/Trocar capa/)).toHaveCount(0);
});
