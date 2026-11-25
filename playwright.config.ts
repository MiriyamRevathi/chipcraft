import fs from 'node:fs';
import { defineConfig, chromium } from '@playwright/test';

function resolveChromiumExecutable(): string | undefined {
  try {
    const defaultExec = chromium.executablePath();
    if (defaultExec && fs.existsSync(defaultExec)) {
      return defaultExec;
    }
  } catch {
    // Fall through to container headless shell check
  }
  const containerShell = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
  if (fs.existsSync(containerShell)) {
    return containerShell;
  }
  return undefined;
}

const executablePath = resolveChromiumExecutable();

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 900 },
    headless: true,
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
