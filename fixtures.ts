/**
 * ✅ Playwright Standard Test Fixtures
 * 
 * Authentication is handled globally by:
 * 1. global.setup.ts - Runs ONCE before all tests to save auth state
 * 2. storageState.json - Loaded by playwright.config.ts for each test
 * 3. No persistent context needed - storageState is cleaner & more standard
 * 
 * Each test gets a fresh page with authenticated state already applied
 */

import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const diagnostics: string[] = [];
    const pushDiagnostic = (message: string) => {
      diagnostics.push(`[${new Date().toISOString()}] ${message}`);
      if (diagnostics.length > 80) {
        diagnostics.shift();
      }
    };

    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        pushDiagnostic(`console.${message.type()}: ${message.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      pushDiagnostic(`pageerror: ${error.message}`);
    });

    page.on('requestfailed', (request) => {
      pushDiagnostic(`requestfailed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'unknown error'}`);
    });

    page.on('response', (response) => {
      if (response.status() >= 500) {
        pushDiagnostic(`response ${response.status()}: ${response.url()}`);
      }
    });

    try {
      await use(page);
    } finally {
      if (diagnostics.length > 0) {
        await testInfo.attach('runtime-diagnostics.log', {
          body: diagnostics.join('\n'),
          contentType: 'text/plain',
        });
      }

      if (testInfo.status !== testInfo.expectedStatus && diagnostics.length > 0) {
        console.error(`\nRuntime diagnostics for ${testInfo.title}:\n${diagnostics.join('\n')}\n`);
      }
    }
  },
});

export { expect } from '@playwright/test';
