import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  // 🔐 Global Setup - Runs authentication ONCE before all tests
  globalSetup: require.resolve('./global.setup.ts'),

  use: {
    baseURL: process.env.BASE_URL || 'https://uctalent.dev',
    trace: 'on-first-retry',
    // 💾 Use saved authentication state for all tests
    storageState: path.join(__dirname, 'storageState.json'),
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
