import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`public Aurora ignores saved account theme at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('shift-hours-dark-mode', 'true');
      localStorage.setItem('shift-hours-theme-color', '#000000');
    });
    await page.goto('/');
    const home = page.getByTestId('intro');
    await expect(home).toBeVisible();
    await page.getByTestId('intro-lang').selectOption('pt');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expect(await home.evaluate(el => getComputedStyle(el).getPropertyValue('--primary-color').trim())).toBe('#2455f5');
    await expect(home.locator('h1')).toHaveText('Seu trabalho flui.Seu dia ganha vida.');
    await expect(page.getByTestId('intro-tools').locator('article')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`aurora-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Mudar tema', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Mudar tema', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('shift-hours-dark-mode'))).toBe('true');
    expect(await page.evaluate(() => localStorage.getItem('shift-hours-theme-color'))).toBe('#000000');
    for (const [language, title] of [['en', 'Your work flows.'], ['es', 'Tu trabajo fluye.']]) {
      await page.getByTestId('intro-lang').selectOption(language);
      await expect(home.locator('h1')).toContainText(title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}
