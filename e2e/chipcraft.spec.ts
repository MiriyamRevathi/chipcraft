import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Helper: drag a real wire between two rendered SVG pin circles using their bounding boxes.
 */
async function dragWireBetweenPins(
  page: Page,
  fromNodeSelector: string,
  fromPinId: string,
  toNodeSelector: string,
  toPinId: string
) {
  const fromPin = page.locator(`${fromNodeSelector} [data-pin-id="${fromPinId}"]`).first();
  const toPin = page.locator(`${toNodeSelector} [data-pin-id="${toPinId}"]`).first();
  await expect(fromPin).toBeVisible();
  await expect(toPin).toBeVisible();

  const fromBox = await fromPin.boundingBox();
  const toBox = await toPin.boundingBox();
  if (!fromBox || !toBox) {
    throw new Error(`Could not resolve pin bounding boxes (${fromPinId} -> ${toPinId})`);
  }

  const startX = fromBox.x + fromBox.width / 2;
  const startY = fromBox.y + fromBox.height / 2;
  const endX = toBox.x + toBox.width / 2;
  const endY = toBox.y + toBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 6 });
  await page.mouse.move(endX, endY, { steps: 6 });
  await page.mouse.up();
}

test.describe('ChipCraft Production End-to-End Suite', () => {
  const createdProjectIds: string[] = [];
  const createdCustomIcIds: string[] = [];

  test.afterAll(async ({ request }) => {
    // Clean up any E2E-created projects and custom ICs from local disk storage
    for (const id of createdProjectIds) {
      await request.delete(`/api/projects/${encodeURIComponent(id)}`);
    }
    for (const id of createdCustomIcIds) {
      await request.delete(`/api/custom-ics/${encodeURIComponent(id)}`);
    }
  });

  test('1. Application startup, live Home Half Adder, and workspace navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Engineering Workspace' })).toBeVisible();
    await expect(page.getByText('Live Half Adder Simulation')).toBeVisible();

    // Toggle input A on the live Home Half Adder SVG (initial A=1, B=1 => S=0, C=1; click A => A=0, B=1 => S=1, C=0)
    await expect(page.getByText('1 + 1 = 10₂')).toBeVisible();
    await page.getByRole('button', { name: 'Toggle input A' }).click();
    await expect(page.getByText('0 + 1 = 01₂')).toBeVisible();

    // Navigate across primary workspaces via sidebar
    await page.getByRole('button', { name: 'Logic Gate Lab', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Logic Gate Lab' })).toBeVisible();

    await page.getByRole('button', { name: 'Chip Explorer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Chip Explorer' })).toBeVisible();

    await page.getByRole('button', { name: 'Documentation', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Documentation', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    // Command palette shortcut (Ctrl+K)
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeVisible();
    await expect(page.getByPlaceholder(/Jump to workspace/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeHidden();
  });

  test('2 & 3. Circuit creation, editing, gate placement, and real pin-to-pin wire connections', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Circuit Studio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Circuit Studio', exact: true })).toBeVisible();

    // Load a blank circuit (starts with starter switches A, B and LED Y) & rename it
    await page.getByLabel('Load example circuit').selectOption('__blank__');
    const nameInput = page.getByLabel('Circuit name');
    await nameInput.fill('E2E Wired AND Gate');

    await expect(page.locator('[data-node-type="TOGGLE_SWITCH"]')).toHaveCount(2);
    await expect(page.locator('[data-node-type="LED"]')).toHaveCount(1);

    // Place an AND gate and an extra NOT gate from palette, then verify Undo / Redo
    await page.locator('[data-palette-component="AND"]').click();
    await expect(page.locator('[data-node-type="AND"]')).toHaveCount(1);

    await page.locator('[data-palette-component="NOT"]').click();
    await expect(page.locator('[data-node-type="NOT"]')).toHaveCount(1);
    await page.getByTitle('Undo (Ctrl+Z)').click();
    await expect(page.locator('[data-node-type="NOT"]')).toHaveCount(0);
    await page.getByTitle('Redo (Ctrl+Y)').click();
    await expect(page.locator('[data-node-type="NOT"]')).toHaveCount(1);
    await page.getByTitle('Undo (Ctrl+Z)').click();
    await expect(page.locator('[data-node-type="NOT"]')).toHaveCount(0);

    // Wire starter in_a.out -> AND.a, in_b.out -> AND.b, AND.y -> out_y.in
    const andGate = page.locator('[data-node-type="AND"]').first();
    const andId = await andGate.getAttribute('data-node-id');

    await dragWireBetweenPins(page, '[data-node-id="in_a"]', 'out', `[data-node-id="${andId}"]`, 'a');
    await dragWireBetweenPins(page, '[data-node-id="in_b"]', 'out', `[data-node-id="${andId}"]`, 'b');
    await dragWireBetweenPins(page, `[data-node-id="${andId}"]`, 'y', '[data-node-id="out_y"]', 'in');

    // Open Truth Table tab on our newly wired circuit and verify 4 rows (AND truth table)
    await page.getByRole('tab', { name: 'Truth Table' }).click();
    await expect(page.getByText('Evaluated deterministically across 4 switch states.')).toBeVisible();
    await expect(page.locator('aside table tbody tr')).toHaveCount(4);
  });

  test('4 & 12. Save, Save As, load from Project Library, Export JSON, and verify local disk persistence', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Circuit Studio', exact: true }).click();
    await page.getByLabel('Load example circuit').selectOption('ex-half-adder');

    const projName = `E2E Saved Half Adder ${Date.now()}`;
    const copyName = `${projName} Copy`;
    await page.getByLabel('Circuit name').fill(projName);

    // Save
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(`Saved "${projName}" locally`)).toBeVisible();

    // Save As
    await page.getByTitle('Save a copy under a new name').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('New circuit name').fill(copyName);
    await page.getByRole('button', { name: 'Save Copy' }).click();
    await expect(page.getByText(`Saved "${copyName}" locally`)).toBeVisible();

    // Export JSON download check
    const downloadPromise = page.waitForEvent('download');
    await page.getByTitle('Export JSON').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.chipcraft.json');

    // Verify backend persistence via /api/projects AND physical files in ./data/projects
    const apiRes = await request.get('/api/projects');
    expect(apiRes.ok()).toBeTruthy();
    const { projects } = (await apiRes.json()) as {
      projects: Array<{ id: string; name: string }>;
    };
    const savedMain = projects.find((p) => p.name === projName);
    const savedCopy = projects.find((p) => p.name === copyName);
    expect(savedMain).toBeDefined();
    expect(savedCopy).toBeDefined();
    if (savedMain) createdProjectIds.push(savedMain.id);
    if (savedCopy) createdProjectIds.push(savedCopy.id);

    // Check actual disk file exists on local filesystem
    const diskPath = path.resolve(process.cwd(), 'data', 'projects', `${savedMain!.id}.json`);
    const diskContent = await fs.readFile(diskPath, 'utf-8');
    expect(diskContent).toContain(projName);

    // Navigate to Project Library and load the saved project back into Circuit Studio
    await page.getByRole('button', { name: 'Project Library', exact: true }).click();
    await expect(page.getByText(projName, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: projName, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Circuit Studio', exact: true })).toBeVisible();
    await expect(page.getByLabel('Circuit name')).toHaveValue(projName);
  });

  test('5. Live Truth Table generation in Circuit Studio', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Circuit Studio', exact: true }).click();
    await page.getByLabel('Load example circuit').selectOption('ex-full-adder');
    await page.getByRole('tab', { name: 'Truth Table' }).click();

    await expect(page.getByText('Live Circuit Truth Table')).toBeVisible();
    await expect(page.getByText('Evaluated deterministically across 8 switch states.')).toBeVisible();
    // 8 rows in tbody
    await expect(page.locator('aside table tbody tr')).toHaveCount(8);
  });

  test('6. Signal Analyzer Web Worker burst capture', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Circuit Studio', exact: true }).click();
    await page.getByLabel('Load example circuit').selectOption('ex-4bit-counter');

    await page.getByRole('button', { name: 'Signal Analyzer' }).last().click();
    await expect(page.getByRole('heading', { name: 'Signal Analyzer', exact: true })).toBeVisible();

    // Pause live auto-clock if active, clear buffer to 1 sample, then run 16-tick Web Worker burst
    const pauseBtn = page.getByRole('button', { name: 'Pause Auto' });
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }
    await page.getByRole('button', { name: 'Clear Buffer' }).click();
    await expect(page.getByText(/· 1 samples/)).toBeVisible();

    await page.getByRole('button', { name: 'Capture 16 Ticks (Worker)' }).click();
    await expect(page.getByText(/· 17 samples/)).toBeVisible();
  });

  test('7. CPU Architect assembly and instruction execution', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'CPU Architect', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'CPU Architect', exact: true })).toBeVisible();

    await expect(page.getByText(/Cycle 0/)).toBeVisible();
    await page.getByRole('button', { name: 'Step Instruction' }).click();
    await expect(page.getByText(/Cycle 1/)).toBeVisible();
    await page.getByRole('button', { name: 'Step Instruction' }).click();
    await expect(page.getByText(/Cycle 2/)).toBeVisible();
  });

  test('8. Memory Lab read and write operations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Memory Lab', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Memory Lab', exact: true })).toBeVisible();

    // Set data input to 171 (0xAB), enable WE, execute write, then read back
    await page.getByLabel('Data input decimal value').fill('171');
    const weBtn = page.getByRole('button', { name: /WE \(Write En\)/ });
    const weText = await weBtn.textContent();
    if (weText?.includes(': 0')) {
      await weBtn.click();
    }
    await page.getByRole('button', { name: 'Execute Write' }).click();
    await page.getByRole('button', { name: 'Execute Read' }).click();

    await expect(page.getByText('0xAB (10101011₂)')).toBeVisible();
  });

  test('9. HDL Studio parsing, truth table evaluation, and synthesis into Circuit Studio', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'HDL Studio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'HDL Studio', exact: true })).toBeVisible();
    await expect(page.getByText(/Valid Module/)).toBeVisible();

    await page.getByRole('button', { name: /Synthesize to Circuit Studio/ }).click();
    await expect(page.getByRole('heading', { name: 'Circuit Studio', exact: true })).toBeVisible();
    await expect(page.getByText(/Synthesized module/)).toBeVisible();
  });

  test('10. Challenge Lab completion via wiring and deterministic verification', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Challenge Lab', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Challenge Lab', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Build an AND Gate Circuit' })).toBeVisible();

    // Add an AND gate using the quick-add strip
    await page.getByRole('button', { name: 'AND', exact: true }).click();
    const andNode = page.locator('[data-node-type="AND"]').first();
    await expect(andNode).toBeVisible();
    const andId = await andNode.getAttribute('data-node-id');

    // Wire starter A.out -> AND.a, starter B.out -> AND.b, AND.y -> starter Y.in
    await dragWireBetweenPins(page, '[data-node-id="a"]', 'out', `[data-node-id="${andId}"]`, 'a');
    await dragWireBetweenPins(page, '[data-node-id="b"]', 'out', `[data-node-id="${andId}"]`, 'b');
    await dragWireBetweenPins(page, `[data-node-id="${andId}"]`, 'y', '[data-node-id="y"]', 'in');

    // Verify all 4 test vectors pass
    await page.getByRole('button', { name: 'Verify Circuit' }).click();
    await expect(page.getByText(/Challenge Passed: Build an AND Gate Circuit/)).toBeVisible();
  });

  test('11. Custom IC creation, pin customization, persistence, and multi-instance reuse', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Circuit Studio', exact: true }).click();
    await page.getByLabel('Load example circuit').selectOption('ex-half-adder');

    const icName = `E2E Half Adder Chip ${Date.now()}`;
    await page.getByRole('button', { name: 'Package IC' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Package Subcircuit as Reusable Custom IC')).toBeVisible();

    // Customize IC name, chip label, rename a pin, and assign pin side
    await page.getByLabel('Custom IC Name').fill(icName);
    await page.getByLabel('Custom IC Chip Label').fill('E2EHA');
    await page.getByLabel('Pin side for A').selectOption('top');

    await page.getByRole('button', { name: 'Create Custom IC' }).click();
    await expect(page.getByText(`Packaged Custom IC "${icName}"`)).toBeVisible();

    // Confirm Custom IC was persisted on local disk via /api/custom-ics
    const icRes = await request.get('/api/custom-ics');
    expect(icRes.ok()).toBeTruthy();
    const { customIcs } = (await icRes.json()) as {
      customIcs: Array<{ id: string; name: string }>;
    };
    const savedIc = customIcs.find((c) => c.name === icName);
    expect(savedIc).toBeDefined();
    createdCustomIcIds.push(savedIc!.id);

    const icDiskPath = path.resolve(process.cwd(), 'data', 'custom-ics', `${savedIc!.id}.json`);
    const icDiskContent = await fs.readFile(icDiskPath, 'utf-8');
    expect(icDiskContent).toContain(icName);

    // Open a blank circuit and place TWO instances of our Custom IC from the palette
    await page.getByLabel('Load example circuit').selectOption('__blank__');
    const paletteItem = page.locator(`[data-custom-ic-palette="${savedIc!.id}"]`);
    await expect(paletteItem).toBeVisible();
    await paletteItem.click();
    await paletteItem.click();
    await expect(page.locator('[data-node-type="CUSTOM_IC"]')).toHaveCount(2);

    // Verify Custom IC also appears in Project Library under Reusable Custom ICs
    await page.getByRole('button', { name: 'Project Library', exact: true }).click();
    await expect(page.getByText(icName, { exact: true })).toBeVisible();
  });
});
