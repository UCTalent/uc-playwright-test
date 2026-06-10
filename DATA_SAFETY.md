# 🔐 E2E Tests - Data Safety & Authentication Guide

## ✅ Safety Guarantee

**All E2E tests in this suite are READ-ONLY operations.**

- ❌ **No data writes** to database
- ❌ **No form submissions** that modify state
- ❌ **No destructive operations** (create, update, delete)
- ✅ **Only verification tests** that check UI visibility and data readability

## 🚀 Setup Instructions

### Step 1: Configure Test Account Credentials

Add your admin account to `.env` file:

```bash
# playwright-tests/.env
TEST_GOOGLE_EMAIL = yugodevbc@uctalent.io
TEST_GOOGLE_PASSWORD = your-secure-password
FRONTEND_URL = https://uctalent.dev
```

**Requirements:**
- Account must have admin/reviewer permissions
- Account can access `/review-jobs` page
- Use a dedicated test account (not personal account)

### Step 2: Auto-Generate Authentication Session

Run the automated login setup:

```bash
cd playwright-tests
node login.setup.js
```

**What happens:**
1. Browser opens automatically
2. Logs in using TEST_GOOGLE_EMAIL + TEST_GOOGLE_PASSWORD
3. Verifies the session can access `/review-jobs`
4. Saves `storageState.json` only after the admin route loads successfully
5. Browser closes automatically
6. Session is now ready for tests

### Step 3: Run Tests with Authenticated Session

```bash
npm test
# or
npx playwright test
```

Tests will use the saved session from `.auth/` - no manual login needed.

---

## 📋 Test Suite Breakdown

### ✅ Read-Only Tests (Safe to Run)

| File | Tests | Operations |
|------|-------|------------|
| `admin-review.spec.ts` | TC 24, TC 31 | View admin portal, check navigation links |
| `applied-referrals.spec.ts` | TC 13, TC 21, TC 22 | View job list, check applications, view referrals |
| `homepage-auth.spec.ts` | TC 1, TC 2, TC 4, TC 5 | Load homepage, check auth options |
| `job-detail.spec.ts` | TC 17-20 | View job details, check apply button |
| `job-search.spec.ts` | TC 14-16, TC 40 | Search jobs, filter by keywords |
| `post-job.spec.ts` | TC 10-12 | Check post job form visibility |
| `rewards-claim.spec.ts` | TC 36 | View earnings page |
| `talent-profile.spec.ts` | Check profile visibility | View talent profile page |
| `user-engagement.spec.ts` | TC 32-35 | Check quest progress, refer & earn UI |
| `ats-management.spec.ts` | TC 37-39 | View ATS, filter candidates |
| `login-google.spec.ts` | Test Google login flow | Verify auth options |

### ⚠️ Important Notes

1. **Session Persistence**
   - Sessions expire after ~24 hours
   - Re-run `node login.setup.js` if tests fail with auth errors
   - Check `.auth/` folder exists before running tests
   - If `storageState.json` is missing, `global.setup.ts` failed the admin access check and did not save a guest session

2. **Environment Variables**
   - `.env` should NEVER be committed to version control
   - Add `.env` to `.gitignore`
   - Use `.env.example` as template for CI/CD

3. **Database Safety**
   - Tests connect as read-only account when possible
   - No INSERT, UPDATE, DELETE operations executed
   - Safe to run against production environment (with caution)

---

## 🔍 Verification Checklist

Before deploying tests to CI/CD:

- [ ] `.env` file contains TEST_GOOGLE_EMAIL & TEST_GOOGLE_PASSWORD
- [ ] Test account has admin/reviewer role in UCTalent
- [ ] Test account can access `/review-jobs` page
- [ ] `.auth/` directory exists (run `node login.setup.js` if missing)
- [ ] Run local test: `npm test` passes successfully
- [ ] No data changes observed in admin dashboard after test run

---

## 🛡️ Database Safety Policies

### What Tests CAN Do
- ✅ Navigate pages
- ✅ Check element visibility
- ✅ Perform searches (read-only)
- ✅ Click navigation links
- ✅ Verify data display

### What Tests MUST NEVER Do
- ❌ Submit forms that create/modify data
- ❌ Call API endpoints with POST/PUT/DELETE
- ❌ Modify local storage or session storage
- ❌ Delete or archive records
- ❌ Change account settings

### Audit Trail
All test runs are logged with:
- Timestamp
- Test account used
- Test suite executed
- Pass/fail results
- Duration

Review logs regularly to ensure no unauthorized modifications.

---

## 🚨 Troubleshooting

### Tests fail with "Cannot find element"
```bash
# Refresh authentication session
rm -rf playwright-tests/.auth/
node login.setup.js
npm test
```

### "TEST_GOOGLE_EMAIL not set" error
```bash
# Add credentials to .env
echo "TEST_GOOGLE_EMAIL=your@email.com" >> .env
echo "TEST_GOOGLE_PASSWORD=your-password" >> .env
```

### Tests timeout on `/review-jobs`
- Check test account has admin permissions
- Verify account can manually access `/review-jobs`
- Check internet connection
- Try: `node login.setup.js` again
- If `global.setup.ts` fails, it now means login did not produce an admin session and the saved auth state was intentionally removed

---

## 📞 Support

For questions about test setup or data safety:
1. Check this document first
2. Review test file comments
3. Check `.env` configuration
4. Contact team lead with specific error

---

**Last Updated:** June 9, 2026  
**Version:** 1.0  
**Status:** ✅ All tests are READ-ONLY and safe
