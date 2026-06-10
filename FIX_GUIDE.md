# 🔧 Fix Guide - Authentication Session Expired

## ❌ Vấn Đề

Tests TC 24 & TC 31 bị fail vì:
- Page bị redirect từ `/review-jobs` về `/` (homepage)
- Điều này chỉ ra session đã **hết hạn hoặc không hợp lệ**
- Session cũ từ 3-4/6 không còn dùng được

## ✅ Giải Pháp (Follow Step-by-Step)

### **Step 1: Xóa Session Cũ**

```bash
cd /Users/admin/repos/uctalents/playwright-tests
rm -rf .auth
echo "✅ Old session cleared"
```

### **Step 2: Verify Credentials**

Check `.env` file:
```bash
cat .env | grep TEST_GOOGLE_EMAIL
cat .env | grep TEST_GOOGLE_PASSWORD
```

Đảm bảo:
- ✅ Email: `yugodevbc@uctalent.io`
- ✅ Password: không trống
- ✅ FRONTEND_URL: `https://uctalent.dev`

### **Step 3: Run Improved Login Setup**

```bash
node login.setup.js
```

**Điều sẽ xảy ra:**
1. Browser mở (headed mode)
2. Script tự navigate tới signin page
3. Script tự click Google button
4. Script tự fill email + password
5. Đợi Google redirect
6. Verify login thành công
7. Browser đóng → session saved

**⏱️ Dự kiến: 60-90 giây**

### **Step 4: Verify Session Created**

```bash
ls -la .auth/ | wc -l
# Nếu > 10 → session đã được tạo ✅
```

### **Step 5: Run Diagnostic Test**

```bash
node diagnose.js
```

**Output sẽ show:**
- ✅ Configuration check
- ✅ Session access test
- ✅ /review-jobs page check
- ✅ Login indicator verification

### **Step 6: Run Tests**

```bash
npm test
```

Hoặc headed mode (để xem chuyện gì đang xảy ra):

```bash
npm run test:headed
```

---

## 🔍 Troubleshooting

### **Nếu Login Setup Fail (Browser không open hoặc hang)**

```bash
# Kill any hung processes
pkill -f "chromium|chrome"

# Try again with debugging
DEBUG=pw:api node login.setup.js
```

### **Nếu Tests vẫn fail sau session mới**

Chạy diagnostic:
```bash
node diagnose.js
```

Nếu diagnostic show `/review-jobs` bị redirect → account không có permission.

**Verify manually:**
1. Mở browser
2. Go to: https://uctalent.dev/?signin=true
3. Log in with yugodevbc@uctalent.io
4. Navigate to https://uctalent.dev/review-jobs
5. Verify page loads (heading = "Review Jobs")

Nếu manual access OK nhưng test fail → session not persisting issue.

### **Nếu Persistent Context Issue**

Update `fixtures.ts` để explicitly save session:

```bash
# Backup current
cp fixtures.ts fixtures.ts.bak

# Edit fixtures to add session persistence logging
nano fixtures.ts
```

### **Nuclear Option - Rebuild Everything**

```bash
cd /Users/admin/repos/uctalents/playwright-tests

# Clear everything
rm -rf .auth node_modules .playwright

# Reinstall
npm install

# Setup from scratch
node login.setup.js

# Verify
node diagnose.js

# Run tests
npm test
```

---

## 🎯 Expected Results After Fix

### **Successful Flow:**
```
✅ Session created in .auth/
✅ Persistent context loads session
✅ User logged in when test starts
✅ /review-jobs page loads correctly
✅ H1 "Review Jobs" element found
✅ TC 24 & TC 31 PASS ✅
```

### **Failed Flow (If Still Happening):**
```
⚠️ Session created
⚠️ Test runs
❌ Page redirects to /
❌ Element not found
❌ Test fails
→ Run: node diagnose.js
```

---

## 📊 Test Results Expected

After fresh session:

```
Running 36 tests using 1 worker

✅ TC 24: Review Jobs - Visibility Check         PASS
✅ TC 31: Admin portal navigation links           PASS
✅ 27 other tests                                  PASS
⏭️  7 tests skipped                              SKIP

Total: 36 tests
Passed: 29 ✅
Skipped: 7 ⏭️
Failed: 0 ❌
```

---

## 🛡️ Prevention - Keep Session Fresh

Add to your **automation/CI/CD:**

```bash
#!/bin/bash
# refresh-session.sh - Run once per day

cd playwright-tests

# Session expires after 24h, refresh if old
if [ -d ".auth" ]; then
  AUTH_AGE=$(($(date +%s) - $(stat -f%m .auth | head -1)))
  if [ $AUTH_AGE -gt 86400 ]; then  # 24 hours
    rm -rf .auth
    node login.setup.js
  fi
fi

npm test
```

---

## 📞 Still Having Issues?

1. ✅ Follow all 6 steps above
2. ✅ Run `node diagnose.js` and check output
3. ✅ Check `.env` credentials are correct
4. ✅ Try `rm -rf .auth && node login.setup.js` once more
5. ✅ Check FRONTEND_URL environment variable

If still failing → Check backend logs or contact team.

---

## 📝 Summary

| Issue | Fix |
|-------|-----|
| Session expired | `rm -rf .auth && node login.setup.js` |
| Tests timeout on /review-jobs | Same as above |
| H1 element not found | Session issue (see above) |
| Page redirects to / | Account auth problem OR session issue |
| Diagnostic shows redirect | Account may lack /review-jobs permission |

---

**Last Updated:** June 9, 2026
**Status:** Ready to Fix ✅
