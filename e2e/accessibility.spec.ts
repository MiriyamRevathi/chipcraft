import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('ChipCraft Accessibility Regression Suite', () => {
  test('Home, Circuit Studio, Settings, and Command Palette have no critical or serious WCAG violations', async ({
    page,
  }) => {
    const assertClean = async (label: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(
        blocking,
        `Accessibility violations in ${label}: ${JSON.stringify(
          blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
        )}`
      ).toEqual([]);
    };

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Engineering Workspace' })).toBeVisible();
    await assertClean('Home');

    await page.getByRole('button', { name: 'Circuit Studio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Circuit Studio', exact: true })).toBeVisible();
    await expect(page.getByLabel('Circuit name')).toBeVisible();
    await assertClean('Circuit Studio');

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Workspace Preferences' })).toBeVisible();
    await assertClean('Settings');

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeVisible();
    await assertClean('Command Palette');
  });
});
