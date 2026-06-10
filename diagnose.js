#!/usr/bin/env node
/**
 * 🔍 E2E Tests - Diagnostic & Debug Script
 * 
 * This script helps diagnose authentication and access issues
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const userDataDir = path.join(__dirname, '.auth');
const baseURL = process.env.FRONTEND_URL || 'https://uctalent.dev';
const email = process.env.TEST_GOOGLE_EMAIL;

async function runDiagnostics() {
  console.log('\n🔍 UCTalent E2E - Diagnostic Report');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check 1: Configuration
  console.log('📋 Step 1: Configuration Check');
  console.log('─────────────────────────────────────────────────────────');
  console.log('✅ BASE_URL:', baseURL);
  console.log('✅ Test Email:', email ? `${email.split('@')[0]}@...` : '❌ NOT SET');
  console.log('✅ .auth directory exists:', fs.existsSync(userDataDir) ? 'YES' : 'NO');
  
  if (fs.existsSync(userDataDir)) {
    const files = fs.readdirSync(userDataDir);
    console.log('✅ .auth contains', files.length, 'items');
  }
  console.log('');

  // Check 2: Test with saved session
  console.log('📋 Step 2: Testing with Saved Session');
  console.log('─────────────────────────────────────────────────────────');

  if (!fs.existsSync(userDataDir)) {
    console.log('❌ No saved session found in .auth/');
    console.log('   → Run: node login.setup.js\n');
    return;
  }

  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      baseURL,
      headless: true,
    });

    const page = await context.newPage();

    console.log('🌐 Testing access to /review-jobs...');
    await page.goto('/review-jobs', { waitUntil: 'domcontentloaded' });

    const currentUrl = page.url();
    console.log('📍 Current URL after navigation:', currentUrl);

    // Check if page is accessible
    const heading = await page.locator('h1, h2, .page-title').first().textContent();
    console.log('📄 Page heading:', heading || '[none found]');

    // Check for auth elements
    const isLoggedIn = await page.locator('button:has-text("Logout"), button:has-text("Disconnect"), [data-testid*="profile"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    console.log('🔐 Logged in indicator:', isLoggedIn ? '✅ YES' : '❌ NO');

    // Check for specific "Review Jobs" element
    const reviewJobsHeading = await page.locator('h1:has-text("Review Jobs")').first().isVisible({ timeout: 2000 }).catch(() => false);
    console.log('📋 "Review Jobs" heading found:', reviewJobsHeading ? '✅ YES' : '❌ NO');

    // List all h1 elements
    const allHeadings = await page.locator('h1').allTextContents();
    if (allHeadings.length > 0) {
      console.log('📝 All H1 elements on page:');
      allHeadings.forEach(h => console.log('   -', h));
    }

    // Check if page was redirected
    if (!currentUrl.includes('/review-jobs')) {
      console.log('⚠️  Page was redirected from /review-jobs');
      console.log('   → Possible reasons:');
      console.log('     1. Session not saved properly');
      console.log('     2. Account lacks permissions');
      console.log('     3. Token expired');
    }

    // Check HTML structure
    const html = await page.content();
    const hasAuthCheck = html.includes('auth') || html.includes('login') || html.includes('signin');
    console.log('🔏 Page has auth-related content:', hasAuthCheck ? 'YES' : 'NO');

    await context.close();
    console.log('\n✅ Session test completed');

  } catch (error) {
    console.error('❌ Error during diagnostic:', error.message);
    console.log('   Possible causes:');
    console.log('   - Session is corrupted, try: rm -rf .auth && node login.setup.js');
    console.log('   - Browser version mismatch, try: npm install');
    console.log('   - Network issue, check connectivity\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📌 Recommendations:');
  console.log('');
  console.log('IF tests still fail after this diagnostic:');
  console.log('  1. Clear and recreate session:');
  console.log('     rm -rf .auth');
  console.log('     node login.setup.js');
  console.log('');
  console.log('  2. Verify account manually:');
  console.log('     - Open browser and go to', baseURL);
  console.log('     - Log in with', email);
  console.log('     - Navigate to /review-jobs');
  console.log('     - Verify you can see the page');
  console.log('');
  console.log('  3. Check test output:');
  console.log('     npm run test:headed  # Run in browser you can see');
  console.log('');
}

runDiagnostics().catch(console.error);
