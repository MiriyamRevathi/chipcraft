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
  const fallbackPaths = [
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const candidate of fallbackPaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
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
    baseURL: E2E_BASE_URL,
    viewport: { width: 1440, height: 900 },
    headless: true,
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: `node ./node_modules/tsx/dist/cli.mjs server.ts --port ${E2E_PORT} --host 127.0.0.1`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === 'true',
    timeout: 30_000,
  },
});
