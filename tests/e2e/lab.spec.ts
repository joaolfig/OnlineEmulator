import { expect, test } from '@playwright/test';

const EXPERIMENTS = ['flat', 'tilt', 'crt', 'relief', 'all'];

// O laboratório é experimental, mas não pode quebrar: cada efeito precisa abrir e desenhar sem erros.
test('laboratório de visual: todos os efeitos abrem e desenham sem erro', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  for (const exp of EXPERIMENTS) {
    await page.goto(`lab.html?exp=${exp}`);
    await expect(page.getByTestId('lab-stage').locator('canvas')).toBeVisible();
    await expect(page.getByTestId('lab-fps')).not.toHaveText('0 fps', { timeout: 15_000 });
  }
  expect(errors).toEqual([]);
});

test('o app principal não tem link para o laboratório', async ({ page }) => {
  for (const path of ['', 'host.html', 'play.html']) {
    await page.goto(path);
    await expect(page.locator('a[href*="lab"]')).toHaveCount(0);
  }
});
